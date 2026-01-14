/**
 * Query ID Management Tests
 *
 * Tests fallback IDs, cache behavior, and regex patterns.
 */

import { describe, expect, test, beforeEach } from 'bun:test';
import { existsSync, unlinkSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { getQueryId, getAllQueryIds, isCacheStale } from './query-ids';

const CACHE_PATH = homedir() + '/.config/trench/query-ids-cache.json';

describe('getQueryId', () => {
  test('returns fallback ID for TweetDetail', () => {
    const id = getQueryId('TweetDetail');
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  test('returns fallback ID for CreateTweet', () => {
    const id = getQueryId('CreateTweet');
    expect(id).toBeTruthy();
    expect(id.length).toBeGreaterThan(0);
  });

  test('returns fallback ID for UserByScreenName', () => {
    const id = getQueryId('UserByScreenName');
    expect(id).toBeTruthy();
  });

  test('returns fallback ID for UserTweets', () => {
    const id = getQueryId('UserTweets');
    expect(id).toBeTruthy();
  });

  test('returns fallback ID for SearchTimeline', () => {
    const id = getQueryId('SearchTimeline');
    expect(id).toBeTruthy();
  });

  test('returns empty string for unknown operation', () => {
    const id = getQueryId('NonExistentOperation');
    expect(id).toBe('');
  });

  test('returns empty string for empty string input', () => {
    const id = getQueryId('');
    expect(id).toBe('');
  });
});

describe('getAllQueryIds', () => {
  test('returns object with all known operations', () => {
    const ids = getAllQueryIds();

    expect(typeof ids).toBe('object');
    expect(ids.TweetDetail).toBeTruthy();
    expect(ids.CreateTweet).toBeTruthy();
    expect(ids.UserByScreenName).toBeTruthy();
    expect(ids.UserTweets).toBeTruthy();
  });

  test('all IDs match expected format', () => {
    const ids = getAllQueryIds();
    const idRegex = /^[a-zA-Z0-9_-]+$/;

    for (const [name, id] of Object.entries(ids)) {
      expect(idRegex.test(id)).toBe(true);
    }
  });
});

describe('isCacheStale', () => {
  const testCacheDir = homedir() + '/.config/trench';

  beforeEach(() => {
    // Clean up any existing test cache
    if (existsSync(CACHE_PATH)) {
      try { unlinkSync(CACHE_PATH); } catch {}
    }
  });

  test('returns true when no cache exists', () => {
    if (existsSync(CACHE_PATH)) {
      unlinkSync(CACHE_PATH);
    }
    expect(isCacheStale()).toBe(true);
  });

  test('returns boolean for cache check', () => {
    const stale = isCacheStale();
    expect(typeof stale).toBe('boolean');
  });
});

describe('Query ID format validation', () => {
  test('TweetDetail ID is valid GraphQL query ID', () => {
    const id = getQueryId('TweetDetail');
    expect(id).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(id.length).toBeGreaterThanOrEqual(10);
  });

  test('CreateTweet ID is valid GraphQL query ID', () => {
    const id = getQueryId('CreateTweet');
    expect(id).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(id.length).toBeGreaterThanOrEqual(10);
  });
});

describe('Bundle URL regex patterns', () => {
  const BUNDLE_URL_REGEX = /https:\/\/abs\.twimg\.com\/responsive-web\/client-web(?:-legacy)?\/[A-Za-z0-9.-]+\.js/g;

  test('matches standard bundle URL', () => {
    const html = '<script src="https://abs.twimg.com/responsive-web/client-web/main.123abc.js"></script>';
    const matches = html.match(BUNDLE_URL_REGEX);

    expect(matches).toBeTruthy();
    expect(matches?.length).toBe(1);
  });

  test('matches legacy bundle URL', () => {
    const html = '<script src="https://abs.twimg.com/responsive-web/client-web-legacy/main.456def.js"></script>';
    const matches = html.match(BUNDLE_URL_REGEX);

    expect(matches).toBeTruthy();
    expect(matches?.length).toBe(1);
  });

  test('matches multiple bundle URLs', () => {
    const html = `
      <script src="https://abs.twimg.com/responsive-web/client-web/main.123.js"></script>
      <script src="https://abs.twimg.com/responsive-web/client-web/vendor.456.js"></script>
    `;
    const matches = html.match(BUNDLE_URL_REGEX);

    expect(matches?.length).toBe(2);
  });

  test('does not match invalid URLs', () => {
    const html = '<script src="https://example.com/evil.js"></script>';
    const matches = html.match(BUNDLE_URL_REGEX);

    expect(matches).toBeNull();
  });
});

describe('Operation extraction regex patterns', () => {
  const pattern1 = /e\.exports=\{queryId\s*:\s*["']([^"']+)["']\s*,\s*operationName\s*:\s*["']([^"']+)["']/gs;
  const pattern2 = /e\.exports=\{operationName\s*:\s*["']([^"']+)["']\s*,\s*queryId\s*:\s*["']([^"']+)["']/gs;

  test('extracts queryId:operationName format', () => {
    const js = 'e.exports={queryId:"abc123",operationName:"TweetDetail"}';
    pattern1.lastIndex = 0;
    const match = pattern1.exec(js);

    expect(match).toBeTruthy();
    expect(match?.[1]).toBe('abc123');
    expect(match?.[2]).toBe('TweetDetail');
  });

  test('extracts operationName:queryId format', () => {
    const js = 'e.exports={operationName:"CreateTweet",queryId:"xyz789"}';
    pattern2.lastIndex = 0;
    const match = pattern2.exec(js);

    expect(match).toBeTruthy();
    expect(match?.[1]).toBe('CreateTweet');
    expect(match?.[2]).toBe('xyz789');
  });

  test('handles single quotes', () => {
    const js = "e.exports={queryId:'abc123',operationName:'TweetDetail'}";
    pattern1.lastIndex = 0;
    const match = pattern1.exec(js);

    expect(match).toBeTruthy();
    expect(match?.[1]).toBe('abc123');
  });

  test('handles whitespace variations', () => {
    const js = 'e.exports={queryId : "abc123" , operationName : "TweetDetail"}';
    pattern1.lastIndex = 0;
    const match = pattern1.exec(js);

    expect(match).toBeTruthy();
  });
});
