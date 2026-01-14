/**
 * Twitter API Unit Tests
 *
 * Tests URL parsing and response handling.
 * No mocking - tests actual logic.
 */

import { describe, expect, test } from 'bun:test';
import { extractTweetId, extractUsername } from './twitter';

describe('extractTweetId', () => {
  test('extracts ID from twitter.com URL', () => {
    expect(extractTweetId('https://twitter.com/elonmusk/status/1234567890123456789')).toBe('1234567890123456789');
  });

  test('extracts ID from x.com URL', () => {
    expect(extractTweetId('https://x.com/elonmusk/status/1234567890123456789')).toBe('1234567890123456789');
  });

  test('extracts ID from URL with query params', () => {
    expect(extractTweetId('https://x.com/user/status/1234567890?s=20')).toBe('1234567890');
  });

  test('extracts ID from URL with trailing slash', () => {
    expect(extractTweetId('https://x.com/user/status/1234567890/')).toBe('1234567890');
  });

  test('extracts ID from mobile URL', () => {
    expect(extractTweetId('https://mobile.twitter.com/user/status/1234567890')).toBe('1234567890');
  });

  test('returns null for invalid URL', () => {
    expect(extractTweetId('https://twitter.com/profile')).toBeNull();
  });

  test('returns null for random string', () => {
    expect(extractTweetId('not a url')).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(extractTweetId('')).toBeNull();
  });

  test('handles URL with photo path', () => {
    expect(extractTweetId('https://x.com/user/status/1234567890/photo/1')).toBe('1234567890');
  });

  test('handles different usernames', () => {
    expect(extractTweetId('https://x.com/_underscore_user/status/123')).toBe('123');
    expect(extractTweetId('https://x.com/CamelCaseUser/status/456')).toBe('456');
    expect(extractTweetId('https://x.com/user123/status/789')).toBe('789');
  });
});

describe('extractUsername', () => {
  test('extracts username from twitter.com status URL', () => {
    expect(extractUsername('https://twitter.com/elonmusk/status/123')).toBe('elonmusk');
  });

  test('extracts username from x.com status URL', () => {
    expect(extractUsername('https://x.com/elonmusk/status/123')).toBe('elonmusk');
  });

  test('extracts username from profile URL', () => {
    expect(extractUsername('https://twitter.com/elonmusk')).toBe('elonmusk');
    expect(extractUsername('https://x.com/elonmusk')).toBe('elonmusk');
  });

  test('extracts username from profile URL with trailing slash', () => {
    expect(extractUsername('https://x.com/elonmusk/')).toBe('elonmusk');
  });

  test('returns null for invalid URL', () => {
    expect(extractUsername('https://twitter.com/')).toBeNull();
  });

  test('returns null for random string', () => {
    expect(extractUsername('not a url')).toBeNull();
  });

  test('handles usernames with underscores', () => {
    expect(extractUsername('https://x.com/_test_user_/status/123')).toBe('_test_user_');
  });

  test('handles usernames with numbers', () => {
    expect(extractUsername('https://x.com/user123/status/456')).toBe('user123');
  });
});
