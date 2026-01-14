/**
 * Config Command
 * Manage trench configuration
 */

import { loadConfig, getConfigValue, setConfigValue, redactConfig } from '../utils/config';
import { header, success, error, info } from '../utils/output';
import { COLORS, CONFIG_FILE } from '../utils/constants';

export async function configCommand(action: string, key?: string, value?: string): Promise<void> {
  switch (action) {
    case 'set':
      if (!key || value === undefined) {
        error('Usage: trench config set <key> <value>');
        info('Example: trench config set defaults.persona whisperer');
        process.exit(1);
      }
      setCmd(key, value);
      break;
    case 'get':
      if (!key) {
        error('Usage: trench config get <key>');
        info('Example: trench config get defaults.persona');
        process.exit(1);
      }
      getCmd(key);
      break;
    case 'show':
      showCmd();
      break;
    default:
      error(`Unknown action: ${action}`);
      info('Usage: trench config [set|get|show]');
  }
}

function setCmd(key: string, value: string): void {
  setConfigValue(key, value);
  success(`Set ${key} = ${value}`);
}

function getCmd(key: string): void {
  const value = getConfigValue(key);

  if (value === undefined) {
    error(`Key not found: ${key}`);
    process.exit(1);
  }

  // Redact sensitive values
  if (key.includes('api_key') || key.includes('token') || key.includes('ct0')) {
    const strValue = String(value);
    console.log(`${key} = ${strValue.slice(0, 8)}...[REDACTED]`);
  } else {
    console.log(`${key} = ${JSON.stringify(value)}`);
  }
}

function showCmd(): void {
  header('Trench Configuration');

  const config = loadConfig();
  const redacted = redactConfig(config);

  console.log(JSON.stringify(redacted, null, 2));

  console.log(`\n${COLORS.dim}Location: ${CONFIG_FILE}${COLORS.reset}`);
}
