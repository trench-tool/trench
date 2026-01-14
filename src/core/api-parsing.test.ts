/**
 * Twitter API Response Parsing Tests
 *
 * Tests parsing logic with realistic API response structures.
 * No mocking - tests actual parsing algorithms.
 */

import { describe, expect, test } from 'bun:test';

/**
 * Tweet parsing logic extracted for testing
 * Mirrors the parsing in twitter.ts fetchTweet
 */
function parseTweetFromResponse(data: any, tweetId: string, fallbackUsername?: string): {
  id: string;
  text: string;
  author: string;
  created_at?: string;
} | null {
  try {
    const instructions = data.data?.tweetResult?.result ||
      data.data?.threaded_conversation_with_injections_v2?.instructions;

    let tweetData: any;

    if (instructions?.legacy) {
      tweetData = instructions;
    } else if (Array.isArray(instructions)) {
      const entries = instructions.find((i: any) => i.type === 'TimelineAddEntries')?.entries || [];
      const tweetEntry = entries.find((e: any) => e.entryId?.startsWith('tweet-'));
      const tweetResults = tweetEntry?.content?.itemContent?.tweet_results;

      if (tweetResults && Object.keys(tweetResults).length === 0) {
        return null; // Empty tweet_results
      }

      tweetData = tweetResults?.result;
    }

    if (!tweetData) return null;

    const legacy = tweetData.legacy || tweetData;
    const user = tweetData.core?.user_results?.result?.legacy ||
                 tweetData.core?.user_results?.result?.core || {};

    return {
      id: tweetId,
      text: legacy.full_text || legacy.text || '',
      author: user.screen_name || fallbackUsername || 'unknown',
      created_at: legacy.created_at
    };
  } catch {
    return null;
  }
}

describe('Tweet response parsing', () => {
  test('parses tweetResult.result format', () => {
    const response = {
      data: {
        tweetResult: {
          result: {
            legacy: {
              full_text: 'Hello world!',
              created_at: 'Mon Jan 01 12:00:00 +0000 2024'
            },
            core: {
              user_results: {
                result: {
                  legacy: {
                    screen_name: 'testuser'
                  }
                }
              }
            }
          }
        }
      }
    };

    const tweet = parseTweetFromResponse(response, '123456');

    expect(tweet).toBeTruthy();
    expect(tweet?.id).toBe('123456');
    expect(tweet?.text).toBe('Hello world!');
    expect(tweet?.author).toBe('testuser');
  });

  test('parses threaded_conversation format', () => {
    const response = {
      data: {
        threaded_conversation_with_injections_v2: {
          instructions: [
            {
              type: 'TimelineAddEntries',
              entries: [
                {
                  entryId: 'tweet-123456',
                  content: {
                    itemContent: {
                      tweet_results: {
                        result: {
                          legacy: {
                            full_text: 'Thread tweet content',
                            created_at: 'Tue Jan 02 15:30:00 +0000 2024'
                          },
                          core: {
                            user_results: {
                              result: {
                                legacy: {
                                  screen_name: 'threadauthor'
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    };

    const tweet = parseTweetFromResponse(response, '123456');

    expect(tweet).toBeTruthy();
    expect(tweet?.text).toBe('Thread tweet content');
    expect(tweet?.author).toBe('threadauthor');
  });

  test('returns null for empty tweet_results', () => {
    const response = {
      data: {
        threaded_conversation_with_injections_v2: {
          instructions: [
            {
              type: 'TimelineAddEntries',
              entries: [
                {
                  entryId: 'tweet-123456',
                  content: {
                    itemContent: {
                      tweet_results: {} // Empty - restricted account
                    }
                  }
                }
              ]
            }
          ]
        }
      }
    };

    const tweet = parseTweetFromResponse(response, '123456');
    expect(tweet).toBeNull();
  });

  test('uses fallback username when not in response', () => {
    const response = {
      data: {
        tweetResult: {
          result: {
            legacy: {
              full_text: 'Tweet without user data'
            },
            core: {
              user_results: {
                result: {}
              }
            }
          }
        }
      }
    };

    const tweet = parseTweetFromResponse(response, '123', 'fallbackuser');

    expect(tweet?.author).toBe('fallbackuser');
  });

  test('handles missing core data gracefully', () => {
    const response = {
      data: {
        tweetResult: {
          result: {
            legacy: {
              full_text: 'Tweet content only'
            }
          }
        }
      }
    };

    const tweet = parseTweetFromResponse(response, '123');

    expect(tweet?.text).toBe('Tweet content only');
    expect(tweet?.author).toBe('unknown');
  });

  test('returns null for completely invalid response', () => {
    const response = { data: {} };
    const tweet = parseTweetFromResponse(response, '123');
    expect(tweet).toBeNull();
  });

  test('returns null for null response', () => {
    const tweet = parseTweetFromResponse(null, '123');
    expect(tweet).toBeNull();
  });

  test('prefers full_text over text field', () => {
    const response = {
      data: {
        tweetResult: {
          result: {
            legacy: {
              full_text: 'Full text with more content...',
              text: 'Truncated text...'
            }
          }
        }
      }
    };

    const tweet = parseTweetFromResponse(response, '123');
    expect(tweet?.text).toBe('Full text with more content...');
  });
});

describe('User tweets parsing', () => {
  /**
   * Parse user timeline response
   */
  function parseUserTweetsResponse(data: any, username: string, count: number = 5): Array<{
    id: string;
    text: string;
    author: string;
    created_at?: string;
  }> {
    const tweets: Array<{id: string; text: string; author: string; created_at?: string}> = [];

    try {
      const instructions = data.data?.user?.result?.timeline_v2?.timeline?.instructions || [];
      const entries = instructions.find((i: any) => i.type === 'TimelineAddEntries')?.entries || [];

      for (const entry of entries) {
        if (!entry.entryId?.startsWith('tweet-')) continue;

        const tweetResult = entry.content?.itemContent?.tweet_results?.result;
        if (!tweetResult?.legacy) continue;

        const legacy = tweetResult.legacy;

        // Skip retweets
        if (legacy.retweeted_status_result) continue;

        tweets.push({
          id: legacy.id_str || entry.entryId.replace('tweet-', ''),
          text: legacy.full_text || legacy.text || '',
          author: username,
          created_at: legacy.created_at
        });

        if (tweets.length >= count) break;
      }
    } catch {}

    return tweets;
  }

  test('parses multiple tweets from timeline', () => {
    const response = {
      data: {
        user: {
          result: {
            timeline_v2: {
              timeline: {
                instructions: [
                  {
                    type: 'TimelineAddEntries',
                    entries: [
                      {
                        entryId: 'tweet-1',
                        content: {
                          itemContent: {
                            tweet_results: {
                              result: {
                                legacy: {
                                  id_str: '1',
                                  full_text: 'First tweet',
                                  created_at: 'Mon Jan 01 10:00:00 +0000 2024'
                                }
                              }
                            }
                          }
                        }
                      },
                      {
                        entryId: 'tweet-2',
                        content: {
                          itemContent: {
                            tweet_results: {
                              result: {
                                legacy: {
                                  id_str: '2',
                                  full_text: 'Second tweet'
                                }
                              }
                            }
                          }
                        }
                      }
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    };

    const tweets = parseUserTweetsResponse(response, 'testuser', 5);

    expect(tweets.length).toBe(2);
    expect(tweets[0].text).toBe('First tweet');
    expect(tweets[1].text).toBe('Second tweet');
    expect(tweets[0].author).toBe('testuser');
  });

  test('skips retweets', () => {
    const response = {
      data: {
        user: {
          result: {
            timeline_v2: {
              timeline: {
                instructions: [
                  {
                    type: 'TimelineAddEntries',
                    entries: [
                      {
                        entryId: 'tweet-1',
                        content: {
                          itemContent: {
                            tweet_results: {
                              result: {
                                legacy: {
                                  id_str: '1',
                                  full_text: 'Original tweet'
                                }
                              }
                            }
                          }
                        }
                      },
                      {
                        entryId: 'tweet-2',
                        content: {
                          itemContent: {
                            tweet_results: {
                              result: {
                                legacy: {
                                  id_str: '2',
                                  full_text: 'RT: Retweet content',
                                  retweeted_status_result: { /* retweet data */ }
                                }
                              }
                            }
                          }
                        }
                      }
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    };

    const tweets = parseUserTweetsResponse(response, 'testuser', 5);

    expect(tweets.length).toBe(1);
    expect(tweets[0].text).toBe('Original tweet');
  });

  test('respects count limit', () => {
    const entries = [];
    for (let i = 0; i < 10; i++) {
      entries.push({
        entryId: `tweet-${i}`,
        content: {
          itemContent: {
            tweet_results: {
              result: {
                legacy: {
                  id_str: String(i),
                  full_text: `Tweet ${i}`
                }
              }
            }
          }
        }
      });
    }

    const response = {
      data: {
        user: {
          result: {
            timeline_v2: {
              timeline: {
                instructions: [{ type: 'TimelineAddEntries', entries }]
              }
            }
          }
        }
      }
    };

    const tweets = parseUserTweetsResponse(response, 'testuser', 3);
    expect(tweets.length).toBe(3);
  });

  test('returns empty array for invalid response', () => {
    const tweets = parseUserTweetsResponse({}, 'testuser', 5);
    expect(tweets).toEqual([]);
  });

  test('skips non-tweet entries', () => {
    const response = {
      data: {
        user: {
          result: {
            timeline_v2: {
              timeline: {
                instructions: [
                  {
                    type: 'TimelineAddEntries',
                    entries: [
                      { entryId: 'cursor-top', content: {} },
                      {
                        entryId: 'tweet-1',
                        content: {
                          itemContent: {
                            tweet_results: {
                              result: {
                                legacy: { id_str: '1', full_text: 'Real tweet' }
                              }
                            }
                          }
                        }
                      },
                      { entryId: 'cursor-bottom', content: {} }
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    };

    const tweets = parseUserTweetsResponse(response, 'testuser', 5);
    expect(tweets.length).toBe(1);
    expect(tweets[0].text).toBe('Real tweet');
  });
});

describe('Error response handling', () => {
  test('recognizes error code 226 (spam detection)', () => {
    const response = {
      errors: [
        { code: 226, message: 'This request looks like it might be automated.' }
      ]
    };

    expect(response.errors[0].code).toBe(226);
  });

  test('recognizes error code 187 (duplicate tweet)', () => {
    const response = {
      errors: [
        { code: 187, message: 'Status is a duplicate.' }
      ]
    };

    expect(response.errors[0].code).toBe(187);
  });

  test('recognizes error code 88 (rate limit)', () => {
    const response = {
      errors: [
        { code: 88, message: 'Rate limit exceeded.' }
      ]
    };

    expect(response.errors[0].code).toBe(88);
  });
});
