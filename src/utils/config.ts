/**
 * Config Management
 * Handles ~/.config/trench/config.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, statSync } from 'fs';
import { CONFIG_DIR, CONFIG_FILE, PERSONAS_DIR, DEFAULT_CONFIG, COLORS } from './constants';

export interface TrenchConfig {
  anthropic_api_key: string;
  twitter: {
    auth_token: string;
    ct0: string;
    bearer_token: string;
  };
  defaults: {
    persona: string;
    port: number;
  };
  scan: {
    targets: string[];
    keywords: string[];
  };
}

/**
 * Ensure config directory exists
 */
export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  if (!existsSync(PERSONAS_DIR)) {
    mkdirSync(PERSONAS_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Check if config exists
 */
export function configExists(): boolean {
  return existsSync(CONFIG_FILE);
}

/**
 * Load config from disk
 */
export function loadConfig(): TrenchConfig {
  ensureConfigDir();

  if (!existsSync(CONFIG_FILE)) {
    return DEFAULT_CONFIG as TrenchConfig;
  }

  try {
    const raw = readFileSync(CONFIG_FILE, 'utf8');
    const config = JSON.parse(raw);
    // Merge with defaults to ensure all keys exist
    return { ...DEFAULT_CONFIG, ...config } as TrenchConfig;
  } catch (e) {
    console.error(`${COLORS.red}Error reading config:${COLORS.reset}`, e);
    return DEFAULT_CONFIG as TrenchConfig;
  }
}

/**
 * Save config to disk
 */
export function saveConfig(config: TrenchConfig): void {
  ensureConfigDir();

  try {
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
  } catch (e) {
    console.error(`${COLORS.red}Error saving config:${COLORS.reset}`, e);
  }
}

/**
 * Check config file permissions (should be 600)
 */
export function checkConfigPermissions(): boolean {
  if (!existsSync(CONFIG_FILE)) return true;

  try {
    const stats = statSync(CONFIG_FILE);
    const mode = stats.mode & 0o777;

    if (mode !== 0o600) {
      console.warn(`${COLORS.yellow}Warning: Config file has loose permissions (${mode.toString(8)}).${COLORS.reset}`);
      console.warn(`${COLORS.yellow}Run: chmod 600 ${CONFIG_FILE}${COLORS.reset}`);
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

/**
 * Get a specific config value by dot-notation key
 */
export function getConfigValue(key: string): unknown {
  const config = loadConfig();
  const keys = key.split('.');
  let value: unknown = config;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Set a specific config value by dot-notation key
 */
export function setConfigValue(key: string, value: unknown): void {
  const config = loadConfig();
  const keys = key.split('.');
  let obj: Record<string, unknown> = config as unknown as Record<string, unknown>;

  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (!(k in obj) || typeof obj[k] !== 'object') {
      obj[k] = {};
    }
    obj = obj[k] as Record<string, unknown>;
  }

  const finalKey = keys[keys.length - 1];

  // If value is already the right type, use it directly
  if (typeof value !== 'string') {
    obj[finalKey] = value;
    saveConfig(config);
    return;
  }

  // Try to preserve type (number, boolean, array) from string
  if (value === 'true') {
    obj[finalKey] = true;
  } else if (value === 'false') {
    obj[finalKey] = false;
  } else if (!isNaN(Number(value)) && value !== '') {
    obj[finalKey] = Number(value);
  } else if (value.startsWith('[') && value.endsWith(']')) {
    try {
      obj[finalKey] = JSON.parse(value);
    } catch {
      obj[finalKey] = value;
    }
  } else {
    obj[finalKey] = value;
  }

  saveConfig(config);
}

/**
 * Redact sensitive values for display
 */
export function redactConfig(config: TrenchConfig): Record<string, unknown> {
  const redacted = JSON.parse(JSON.stringify(config));

  if (redacted.anthropic_api_key) {
    redacted.anthropic_api_key = redacted.anthropic_api_key.slice(0, 10) + '...[REDACTED]';
  }
  if (redacted.twitter?.auth_token) {
    redacted.twitter.auth_token = redacted.twitter.auth_token.slice(0, 8) + '...[REDACTED]';
  }
  if (redacted.twitter?.ct0) {
    redacted.twitter.ct0 = redacted.twitter.ct0.slice(0, 8) + '...[REDACTED]';
  }
  if (redacted.twitter?.bearer_token) {
    redacted.twitter.bearer_token = '[DEFAULT]';
  }

  return redacted;
}
