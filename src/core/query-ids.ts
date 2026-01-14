/**
 * Twitter GraphQL Query ID Management
 *
 * Adapted from @steipete/bird (MIT License)
 * https://github.com/steipete/bird
 *
 * Twitter's GraphQL query IDs rotate periodically. This module:
 * 1. Provides hardcoded fallback IDs
 * 2. Can scrape Twitter's JS bundles to get fresh IDs
 * 3. Caches discovered IDs to disk
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';

// Fallback query IDs (from bird, updated 2026-01-14)
const FALLBACK_IDS: Record<string, string> = {
  CreateTweet: 'nmdAQXJDxw6-0KKF2on7eA',
  CreateRetweet: 'LFho5rIi4xcKO90p9jwG7A',
  FavoriteTweet: 'lI07N6Otwv1PhnEgXILM7A',
  DeleteBookmark: 'Wlmlj2-xzyS1GN3a6cj-mQ',
  TweetDetail: '_NvJCnIjOW__EP5-RF197A',
  SearchTimeline: '6AAys3t42mosm_yTI_QENg',
  UserTweets: 'Wms1GvIiHXAPBaCr9KblaA',
  UserByScreenName: 'BQ6xjFU6Mgm-WhEP3OiT9w',
  Bookmarks: 'RV1g3b8n_SGOHwkqKYSCFw',
  Following: 'mWYeougg_ocJS2Vr1Vt28w',
  Followers: 'SFYY3WsgwjlXSLlfnEUE4A',
  Likes: 'ETJflBunfqNa1uE1mBPCaw',
};

// Discovery configuration
const DISCOVERY_PAGES = [
  'https://x.com/?lang=en',
  'https://x.com/explore',
  'https://x.com/notifications',
];

const BUNDLE_URL_REGEX = /https:\/\/abs\.twimg\.com\/responsive-web\/client-web(?:-legacy)?\/[A-Za-z0-9.-]+\.js/g;
const QUERY_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

// Regex patterns to extract queryId/operationName pairs from bundles
const OPERATION_PATTERNS = [
  {
    regex: /e\.exports=\{queryId\s*:\s*["']([^"']+)["']\s*,\s*operationName\s*:\s*["']([^"']+)["']/gs,
    operationGroup: 2,
    queryIdGroup: 1,
  },
  {
    regex: /e\.exports=\{operationName\s*:\s*["']([^"']+)["']\s*,\s*queryId\s*:\s*["']([^"']+)["']/gs,
    operationGroup: 1,
    queryIdGroup: 2,
  },
  {
    regex: /operationName\s*[:=]\s*["']([^"']+)["'](.{0,4000}?)queryId\s*[:=]\s*["']([^"']+)["']/gs,
    operationGroup: 1,
    queryIdGroup: 3,
  },
  {
    regex: /queryId\s*[:=]\s*["']([^"']+)["'](.{0,4000}?)operationName\s*[:=]\s*["']([^"']+)["']/gs,
    operationGroup: 3,
    queryIdGroup: 1,
  },
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/json;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

interface QueryIdCache {
  fetchedAt: string;
  ids: Record<string, string>;
}

const CACHE_PATH = homedir() + '/.config/trench/query-ids-cache.json';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let memoryCache: QueryIdCache | null = null;

function loadCache(): QueryIdCache | null {
  if (memoryCache) return memoryCache;

  try {
    if (existsSync(CACHE_PATH)) {
      const raw = readFileSync(CACHE_PATH, 'utf-8');
      const cache = JSON.parse(raw) as QueryIdCache;
      const fetchedAt = new Date(cache.fetchedAt).getTime();
      if (Date.now() - fetchedAt < CACHE_TTL_MS) {
        memoryCache = cache;
        return cache;
      }
    }
  } catch {}
  return null;
}

function saveCache(ids: Record<string, string>): void {
  try {
    const dir = CACHE_PATH.replace(/\/[^/]+$/, '');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const cache: QueryIdCache = {
      fetchedAt: new Date().toISOString(),
      ids,
    };
    writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
    memoryCache = cache;
  } catch {}
}

async function discoverBundles(): Promise<string[]> {
  const bundles = new Set<string>();

  for (const page of DISCOVERY_PAGES) {
    try {
      const response = await fetch(page, { headers: HEADERS });
      if (!response.ok) continue;
      const html = await response.text();
      for (const match of html.matchAll(BUNDLE_URL_REGEX)) {
        bundles.add(match[0]);
      }
    } catch {}
  }
  return [...bundles];
}

function extractFromBundle(
  content: string,
  targets: Set<string>,
  discovered: Map<string, string>
): void {
  for (const pattern of OPERATION_PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(content)) !== null) {
      const operationName = match[pattern.operationGroup];
      const queryId = match[pattern.queryIdGroup];
      if (!operationName || !queryId) continue;
      if (!targets.has(operationName)) continue;
      if (!QUERY_ID_REGEX.test(queryId)) continue;
      if (discovered.has(operationName)) continue;
      discovered.set(operationName, queryId);
      if (discovered.size === targets.size) return;
    }
  }
}

export async function refreshQueryIds(operations: string[]): Promise<Record<string, string>> {
  const targets = new Set(operations);
  const discovered = new Map<string, string>();

  try {
    const bundleUrls = await discoverBundles();
    const CONCURRENCY = 6;

    for (let i = 0; i < bundleUrls.length && discovered.size < targets.size; i += CONCURRENCY) {
      const chunk = bundleUrls.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (url) => {
          if (discovered.size === targets.size) return;
          try {
            const response = await fetch(url, { headers: HEADERS });
            if (!response.ok) return;
            const js = await response.text();
            extractFromBundle(js, targets, discovered);
          } catch {}
        })
      );
    }

    if (discovered.size > 0) {
      const ids = { ...FALLBACK_IDS };
      for (const [name, id] of discovered) {
        ids[name] = id;
      }
      saveCache(ids);
      return ids;
    }
  } catch {}

  return FALLBACK_IDS;
}

export function getQueryId(operationName: string): string {
  const cache = loadCache();
  if (cache?.ids[operationName]) {
    return cache.ids[operationName];
  }
  return FALLBACK_IDS[operationName] || '';
}

export function getAllQueryIds(): Record<string, string> {
  const cache = loadCache();
  return cache?.ids || FALLBACK_IDS;
}

export function isCacheStale(): boolean {
  const cache = loadCache();
  if (!cache) return true;
  const fetchedAt = new Date(cache.fetchedAt).getTime();
  return Date.now() - fetchedAt > CACHE_TTL_MS;
}
