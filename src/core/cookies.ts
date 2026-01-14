/**
 * Browser Cookie Extraction
 *
 * Extracts cookies from Chrome, Firefox, and Safari on macOS.
 * Inspired by: https://github.com/mherod/get-cookie (MIT)
 *
 * Techniques used:
 * - Chrome: Keychain decryption + AES-128-CBC
 * - Firefox: Plain SQLite (no encryption)
 * - Safari: Binary cookie format parsing
 */

import { Database } from 'bun:sqlite';
import { existsSync, readdirSync, readFileSync, copyFileSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { createDecipheriv, pbkdf2Sync } from 'crypto';

interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
}

export interface TwitterCookies {
  auth_token?: string;
  ct0?: string;
}

// Browser base directories (macOS)
const BROWSER_DIRS = {
  chrome: `${homedir()}/Library/Application Support/Google/Chrome`,
  chromeBeta: `${homedir()}/Library/Application Support/Google/Chrome Beta`,
  chromium: `${homedir()}/Library/Application Support/Chromium`,
  brave: `${homedir()}/Library/Application Support/BraveSoftware/Brave-Browser`,
  edge: `${homedir()}/Library/Application Support/Microsoft Edge`,
  arc: `${homedir()}/Library/Application Support/Arc/User Data`,
  firefox: `${homedir()}/Library/Application Support/Firefox/Profiles`,
  safari: `${homedir()}/Library/Cookies/Cookies.binarycookies`,
};

/**
 * Find all Chrome profile cookie databases
 */
function findChromiumCookiePaths(baseDir: string): string[] {
  const paths: string[] = [];

  if (!existsSync(baseDir)) {
    return paths;
  }

  try {
    const entries = readdirSync(baseDir);

    // Check Default profile
    if (entries.includes('Default')) {
      const cookiePath = `${baseDir}/Default/Cookies`;
      if (existsSync(cookiePath)) {
        paths.push(cookiePath);
      }
    }

    // Check numbered profiles (Profile 1, Profile 2, etc.)
    for (const entry of entries) {
      if (entry.startsWith('Profile ')) {
        const cookiePath = `${baseDir}/${entry}/Cookies`;
        if (existsSync(cookiePath)) {
          paths.push(cookiePath);
        }
      }
    }
  } catch {}

  return paths;
}

/**
 * Get Chrome Safe Storage encryption key from macOS Keychain
 * Uses Bun.spawnSync for safe execution
 */
function getChromeEncryptionKey(): Buffer | null {
  try {
    // Use Bun.spawnSync with explicit args (no shell injection)
    const result = Bun.spawnSync({
      cmd: ['security', 'find-generic-password', '-s', 'Chrome Safe Storage', '-w'],
      stdout: 'pipe',
      stderr: 'pipe',
    });

    if (result.exitCode !== 0) {
      return null;
    }

    const password = result.stdout.toString().trim();
    if (!password) {
      return null;
    }

    // Derive the actual encryption key using PBKDF2
    // Chrome uses 1003 iterations with 'saltysalt' as salt
    const key = pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1');
    return key;
  } catch {
    return null;
  }
}

/**
 * Decrypt a Chrome cookie value (macOS)
 * Chrome uses AES-128-CBC with a 16-space IV
 * DB v24+ includes a 32-byte SHA256 hash prefix after decryption
 */
function decryptChromeCookie(encryptedValue: Buffer, key: Buffer): string {
  try {
    // Check for v10 prefix (macOS Chrome encryption marker)
    if (encryptedValue.length < 3) {
      return encryptedValue.toString('utf-8');
    }

    const prefix = encryptedValue.slice(0, 3).toString();
    if (prefix !== 'v10') {
      // Not encrypted, return as-is
      return encryptedValue.toString('utf-8');
    }

    // Remove 'v10' prefix
    const data = encryptedValue.slice(3);

    // IV is 16 spaces
    const iv = Buffer.alloc(16, ' ');

    // Decrypt using AES-128-CBC
    const decipher = createDecipheriv('aes-128-cbc', key, iv);
    decipher.setAutoPadding(false);

    let decrypted = decipher.update(data);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    // Remove PKCS7 padding
    const padding = decrypted[decrypted.length - 1];
    if (padding > 0 && padding <= 16) {
      decrypted = decrypted.slice(0, -padding);
    }

    // Chrome DB v24+ prepends a 32-byte SHA256 hash of the domain
    // We need to skip it to get the actual cookie value
    // Check if the result looks like it has a hash prefix (non-printable chars)
    let result = decrypted.toString('utf-8');

    // If first 32 bytes contain non-printable chars, skip them
    if (decrypted.length > 32) {
      const first32 = decrypted.slice(0, 32);
      const hasNonPrintable = first32.some(b => b < 32 || b > 126);
      if (hasNonPrintable) {
        result = decrypted.slice(32).toString('utf-8');
      }
    }

    return result;
  } catch {
    return '';
  }
}

/**
 * Safely copy a file (browsers lock their DBs)
 */
function safeCopyFile(src: string, dest: string): boolean {
  try {
    copyFileSync(src, dest);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract cookies from a Chromium-based browser
 */
function extractChromiumCookies(dbPath: string, domain: string): Cookie[] {
  if (!existsSync(dbPath)) {
    return [];
  }

  const key = getChromeEncryptionKey();
  if (!key) {
    return [];
  }

  // Chrome locks the database, so we need to copy it
  const tempPath = `/tmp/trench_cookies_${Date.now()}.db`;
  if (!safeCopyFile(dbPath, tempPath)) {
    return [];
  }

  const cookies: Cookie[] = [];

  try {
    const db = new Database(tempPath, { readonly: true });

    // Query for cookies matching domain (twitter.com or x.com)
    const query = db.query(`
      SELECT name, encrypted_value, host_key, path, expires_utc
      FROM cookies
      WHERE host_key LIKE ?
    `);

    const rows = query.all(`%${domain}%`) as any[];

    for (const row of rows) {
      // Bun SQLite returns Uint8Array for blobs - convert to Buffer
      const encryptedBuffer = Buffer.from(row.encrypted_value);
      const decryptedValue = decryptChromeCookie(encryptedBuffer, key);
      if (decryptedValue) {
        cookies.push({
          name: row.name,
          value: decryptedValue,
          domain: row.host_key,
          path: row.path,
          expires: row.expires_utc,
        });
      }
    }

    db.close();
  } catch {
    // Database error - silently continue
  } finally {
    // Clean up temp file
    try {
      unlinkSync(tempPath);
    } catch {}
  }

  return cookies;
}

/**
 * Find the default Firefox profile directory
 */
function findFirefoxProfile(): string | null {
  const profilesDir = BROWSER_DIRS.firefox;

  if (!existsSync(profilesDir)) {
    return null;
  }

  try {
    const entries = readdirSync(profilesDir);
    const profile = entries.find(
      p => p.includes('.default') || p.includes('default-release')
    );

    if (profile) {
      return `${profilesDir}/${profile}`;
    }
  } catch {}

  return null;
}

/**
 * Extract cookies from Firefox (no encryption!)
 */
function extractFirefoxCookies(domain: string): Cookie[] {
  const profileDir = findFirefoxProfile();
  if (!profileDir) {
    return [];
  }

  const dbPath = `${profileDir}/cookies.sqlite`;
  if (!existsSync(dbPath)) {
    return [];
  }

  // Firefox also locks the database
  const tempPath = `/tmp/trench_ff_cookies_${Date.now()}.db`;
  if (!safeCopyFile(dbPath, tempPath)) {
    return [];
  }

  const cookies: Cookie[] = [];

  try {
    const db = new Database(tempPath, { readonly: true });

    const query = db.query(`
      SELECT name, value, host, path, expiry
      FROM moz_cookies
      WHERE host LIKE ?
    `);

    const rows = query.all(`%${domain}%`) as any[];

    for (const row of rows) {
      cookies.push({
        name: row.name,
        value: row.value, // Not encrypted!
        domain: row.host,
        path: row.path,
        expires: row.expiry,
      });
    }

    db.close();
  } catch {
    // Database error - silently continue
  } finally {
    try {
      unlinkSync(tempPath);
    } catch {}
  }

  return cookies;
}

/**
 * Parse Safari's binary cookie format
 * Format: https://github.com/libyal/dtformats/blob/main/documentation/Safari%20Cookies.asciidoc
 */
function extractSafariCookies(domain: string): Cookie[] {
  const cookiePath = BROWSER_DIRS.safari;

  if (!existsSync(cookiePath)) {
    return [];
  }

  const cookies: Cookie[] = [];

  try {
    const data = readFileSync(cookiePath);

    // Check magic bytes: 'cook'
    if (data.slice(0, 4).toString() !== 'cook') {
      return [];
    }

    // Read number of pages (big-endian)
    const numPages = data.readUInt32BE(4);

    let offset = 8;
    const pageSizes: number[] = [];

    // Read page sizes
    for (let i = 0; i < numPages; i++) {
      pageSizes.push(data.readUInt32BE(offset));
      offset += 4;
    }

    // Process each page
    for (const pageSize of pageSizes) {
      const pageStart = offset;
      const pageEnd = offset + pageSize;

      // Page header (little-endian from here)
      const pageHeader = data.readUInt32LE(offset);
      if (pageHeader !== 0x00000100) {
        offset = pageEnd;
        continue;
      }

      // Number of cookies in this page
      const numCookies = data.readUInt32LE(offset + 4);

      // Cookie offsets
      const cookieOffsets: number[] = [];
      let cookieOffsetPos = offset + 8;
      for (let i = 0; i < numCookies; i++) {
        cookieOffsets.push(data.readUInt32LE(cookieOffsetPos));
        cookieOffsetPos += 4;
      }

      // Parse each cookie
      for (const cookieOffset of cookieOffsets) {
        const cookieStart = pageStart + cookieOffset;

        try {
          // String offsets (at fixed positions in cookie record)
          const urlOffset = data.readUInt32LE(cookieStart + 16);
          const nameOffset = data.readUInt32LE(cookieStart + 20);
          const pathOffset = data.readUInt32LE(cookieStart + 24);
          const valueOffset = data.readUInt32LE(cookieStart + 28);

          // Read null-terminated strings
          const readString = (off: number): string => {
            const start = cookieStart + off;
            let end = start;
            while (end < data.length && data[end] !== 0) end++;
            return data.slice(start, end).toString('utf-8');
          };

          const cookieDomain = readString(urlOffset);
          const name = readString(nameOffset);
          const path = readString(pathOffset);
          const value = readString(valueOffset);

          // Check if this cookie matches our domain
          if (cookieDomain.includes(domain)) {
            cookies.push({
              name,
              value,
              domain: cookieDomain,
              path,
              expires: 0,
            });
          }
        } catch {
          // Skip malformed cookie
        }
      }

      offset = pageEnd;
    }
  } catch {
    // Parse error - silently continue
  }

  return cookies;
}

/**
 * Extract Twitter cookies from all available browsers
 */
export async function extractTwitterCookies(): Promise<{
  cookies: TwitterCookies;
  source: string;
} | null> {
  const domains = ['twitter', 'x.com'];

  // Build list of all browser cookie paths to check
  const browserChecks: { name: string; paths: string[] }[] = [
    { name: 'Chrome', paths: findChromiumCookiePaths(BROWSER_DIRS.chrome) },
    { name: 'Arc', paths: findChromiumCookiePaths(BROWSER_DIRS.arc) },
    { name: 'Brave', paths: findChromiumCookiePaths(BROWSER_DIRS.brave) },
    { name: 'Edge', paths: findChromiumCookiePaths(BROWSER_DIRS.edge) },
    { name: 'Chromium', paths: findChromiumCookiePaths(BROWSER_DIRS.chromium) },
  ];

  // Try Chromium-based browsers first
  for (const browser of browserChecks) {
    for (const cookiePath of browser.paths) {
      for (const domain of domains) {
        const cookies = extractChromiumCookies(cookiePath, domain);
        const authToken = cookies.find(c => c.name === 'auth_token')?.value;
        const ct0 = cookies.find(c => c.name === 'ct0')?.value;

        if (authToken && ct0) {
          return {
            cookies: { auth_token: authToken, ct0 },
            source: browser.name,
          };
        }
      }
    }
  }

  // Try Firefox
  for (const domain of domains) {
    const cookies = extractFirefoxCookies(domain);
    const authToken = cookies.find(c => c.name === 'auth_token')?.value;
    const ct0 = cookies.find(c => c.name === 'ct0')?.value;

    if (authToken && ct0) {
      return {
        cookies: { auth_token: authToken, ct0 },
        source: 'Firefox',
      };
    }
  }

  // Try Safari
  for (const domain of domains) {
    const cookies = extractSafariCookies(domain);
    const authToken = cookies.find(c => c.name === 'auth_token')?.value;
    const ct0 = cookies.find(c => c.name === 'ct0')?.value;

    if (authToken && ct0) {
      return {
        cookies: { auth_token: authToken, ct0 },
        source: 'Safari',
      };
    }
  }

  return null;
}

/**
 * List all browsers that have cookie databases present
 */
export function listAvailableBrowsers(): string[] {
  const browsers: string[] = [];

  const chromiumBrowsers = [
    { name: 'Chrome', dir: BROWSER_DIRS.chrome },
    { name: 'Arc', dir: BROWSER_DIRS.arc },
    { name: 'Brave', dir: BROWSER_DIRS.brave },
    { name: 'Edge', dir: BROWSER_DIRS.edge },
    { name: 'Chromium', dir: BROWSER_DIRS.chromium },
  ];

  for (const browser of chromiumBrowsers) {
    const paths = findChromiumCookiePaths(browser.dir);
    if (paths.length > 0) {
      browsers.push(browser.name);
    }
  }

  // Check Firefox separately (needs profile lookup)
  const firefoxProfile = findFirefoxProfile();
  if (firefoxProfile && existsSync(`${firefoxProfile}/cookies.sqlite`)) {
    browsers.push('Firefox');
  }

  // Check Safari
  if (existsSync(BROWSER_DIRS.safari)) {
    browsers.push('Safari');
  }

  return browsers;
}
