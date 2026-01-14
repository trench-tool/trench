/**
 * Twitter API
 * Direct HTTP calls using cookie-based authentication
 *
 * Query ID management adapted from @steipete/bird (MIT License)
 * https://github.com/steipete/bird
 */

import { getQueryId, refreshQueryIds, isCacheStale } from './query-ids';

interface TwitterAuth {
  auth_token: string;
  ct0: string;
  bearer_token: string;
}

interface Tweet {
  id: string;
  text: string;
  author: string;
  created_at?: string;
}

const GRAPHQL_BASE = 'https://x.com/i/api/graphql';

// Operations we use - for auto-refresh
const OPERATIONS = ['TweetDetail', 'CreateTweet', 'UserTweets', 'UserByScreenName', 'SearchTimeline'];

/**
 * Refresh query IDs if cache is stale (call on startup or after 404s)
 */
export async function ensureFreshQueryIds(): Promise<void> {
  if (isCacheStale()) {
    await refreshQueryIds(OPERATIONS);
  }
}

// Re-export for CLI usage
export { refreshQueryIds } from './query-ids';

/**
 * Generate random transaction ID like bird does
 */
function generateTransactionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Build headers for Twitter API requests
 * Mimics browser behavior to avoid bot detection
 */
function buildHeaders(auth: TwitterAuth): Record<string, string> {
  return {
    'authorization': `Bearer ${auth.bearer_token}`,
    'cookie': `auth_token=${auth.auth_token}; ct0=${auth.ct0}`,
    'x-csrf-token': auth.ct0,
    'x-twitter-auth-type': 'OAuth2Session',
    'x-twitter-active-user': 'yes',
    'x-twitter-client-language': 'en',
    'x-client-uuid': crypto.randomUUID(),
    'x-client-transaction-id': generateTransactionId(),
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'origin': 'https://x.com',
    'referer': 'https://x.com/',
    'content-type': 'application/json',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };
}

/**
 * Extract tweet ID from URL
 */
export function extractTweetId(url: string): string | null {
  const patterns = [
    /twitter\.com\/\w+\/status\/(\d+)/,
    /x\.com\/\w+\/status\/(\d+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Extract username from URL
 */
export function extractUsername(url: string): string | null {
  const patterns = [
    /twitter\.com\/(\w+)\/status/,
    /x\.com\/(\w+)\/status/,
    /twitter\.com\/(\w+)\/?$/,
    /x\.com\/(\w+)\/?$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Fetch a tweet by URL or ID
 */
export async function fetchTweet(urlOrId: string, auth: TwitterAuth): Promise<Tweet> {
  if (!auth.auth_token || !auth.ct0) {
    throw new Error('Twitter authentication not configured. Run: trench init');
  }

  const tweetId = urlOrId.includes('/') ? extractTweetId(urlOrId) : urlOrId;
  const username = extractUsername(urlOrId);

  if (!tweetId) {
    throw new Error('Could not extract tweet ID from URL');
  }

  // Use focalTweetId as expected by the API
  const variables = {
    focalTweetId: tweetId,
    with_rux_injections: false,
    rankingMode: 'Relevance',
    includePromotedContent: true,
    withCommunity: true,
    withQuickPromoteEligibilityTweetFields: true,
    withBirdwatchNotes: true,
    withVoice: true,
  };

  // Complete feature flags from @steipete/bird
  const features = {
    rweb_video_screen_enabled: true,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    responsive_web_profile_redirect_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: false,
    responsive_web_grok_annotations_enabled: false,
    responsive_web_jetfuel_frame: true,
    post_ctas_fetch_enabled: true,
    responsive_web_grok_share_attachment_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    responsive_web_grok_show_grok_translated_post: false,
    responsive_web_grok_analysis_button_from_backend: true,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_imagine_annotation_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: false,
    responsive_web_enhance_cards_enabled: false,
    responsive_web_twitter_article_plain_text_enabled: true,
    responsive_web_twitter_article_seed_tweet_detail_enabled: true,
    responsive_web_twitter_article_seed_tweet_summary_enabled: true,
  };

  // Field toggles for enhanced content
  const fieldToggles = {
    withArticleRichContentState: true,
    withArticlePlainText: false,
    withGrokAnalyze: false,
    withDisallowedReplyControls: false
  };

  const url = `${GRAPHQL_BASE}/${getQueryId('TweetDetail')}/TweetDetail?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(JSON.stringify(features))}&fieldToggles=${encodeURIComponent(JSON.stringify(fieldToggles))}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(auth)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Twitter API error: ${response.status} - ${text.slice(0, 200)}`);
  }

  const data = await response.json();

  // Navigate the complex response structure
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

      // Handle empty tweet_results (common with new/restricted accounts)
      if (tweetResults && Object.keys(tweetResults).length === 0) {
        throw new Error('Tweet content unavailable. This may be due to account restrictions - try using cookies from an established Twitter account.');
      }

      tweetData = tweetResults?.result;
    }

    if (!tweetData) {
      throw new Error('Could not parse tweet data');
    }

    const legacy = tweetData.legacy || tweetData;
    const user = tweetData.core?.user_results?.result?.legacy ||
                 tweetData.core?.user_results?.result?.core || {};

    return {
      id: tweetId,
      text: legacy.full_text || legacy.text || '',
      author: user.screen_name || username || 'unknown',
      created_at: legacy.created_at
    };
  } catch (e) {
    throw new Error(`Failed to parse tweet: ${e}`);
  }
}

/**
 * Fetch recent tweets from a user
 */
export async function fetchUserTweets(username: string, auth: TwitterAuth, count: number = 5): Promise<Tweet[]> {
  if (!auth.auth_token || !auth.ct0) {
    throw new Error('Twitter authentication not configured');
  }

  // First, we need to get the user ID
  const userVariables = { screen_name: username };
  const userFeatures = {
    hidden_profile_subscriptions_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    subscriptions_verification_info_is_identity_verified_enabled: true,
    subscriptions_verification_info_verified_since_enabled: true,
    highlights_tweets_tab_ui_enabled: true,
    responsive_web_twitter_article_notes_tab_enabled: true,
    subscriptions_feature_can_gift_premium: true,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true
  };

  const userResponse = await fetch(`${GRAPHQL_BASE}/${getQueryId('UserByScreenName')}/UserByScreenName?variables=${encodeURIComponent(JSON.stringify(userVariables))}&features=${encodeURIComponent(JSON.stringify(userFeatures))}`, {
    headers: buildHeaders(auth)
  });

  if (!userResponse.ok) {
    throw new Error(`Failed to fetch user: ${userResponse.status}`);
  }

  const userData = await userResponse.json();
  const userId = userData.data?.user?.result?.rest_id;

  if (!userId) {
    throw new Error('Could not find user ID');
  }

  // Now fetch their tweets
  const variables = {
    userId,
    count,
    includePromotedContent: false,
    withQuickPromoteEligibilityTweetFields: false,
    withVoice: false,
    withV2Timeline: true
  };

  // Complete feature flags for UserTweets
  const features = {
    rweb_video_screen_enabled: true,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    responsive_web_profile_redirect_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: false,
    responsive_web_grok_annotations_enabled: false,
    responsive_web_jetfuel_frame: true,
    post_ctas_fetch_enabled: true,
    responsive_web_grok_share_attachment_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    responsive_web_grok_show_grok_translated_post: false,
    responsive_web_grok_analysis_button_from_backend: true,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_imagine_annotation_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: false,
    responsive_web_enhance_cards_enabled: false,
    responsive_web_twitter_article_plain_text_enabled: true,
    responsive_web_twitter_article_seed_tweet_detail_enabled: true,
    responsive_web_twitter_article_seed_tweet_summary_enabled: true,
  };

  const url = `${GRAPHQL_BASE}/${getQueryId('UserTweets')}/UserTweets?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(JSON.stringify(features))}`;

  const response = await fetch(url, {
    headers: buildHeaders(auth)
  });

  if (!response.ok) {
    throw new Error(`Twitter API error: ${response.status}`);
  }

  const data = await response.json();

  // Parse tweets from timeline
  const tweets: Tweet[] = [];

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
  } catch (e) {
    console.error('Error parsing tweets:', e);
  }

  return tweets;
}

/**
 * Post a reply to a tweet
 */
export async function postReply(tweetId: string, text: string, auth: TwitterAuth): Promise<{ success: boolean; tweetId?: string }> {
  if (!auth.auth_token || !auth.ct0) {
    throw new Error('Twitter authentication not configured');
  }

  const variables = {
    tweet_text: text,
    reply: {
      in_reply_to_tweet_id: tweetId,
      exclude_reply_user_ids: []
    },
    dark_request: false,
    media: {
      media_entities: [],
      possibly_sensitive: false
    },
    semantic_annotation_ids: []
  };

  const queryId = getQueryId('CreateTweet');
  const url = `${GRAPHQL_BASE}/${queryId}/CreateTweet`;

  // Complete feature flags for CreateTweet
  const createFeatures = {
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    tweetypie_unmention_optimization_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: false,
    tweet_awards_web_tipping_enabled: false,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_enhance_cards_enabled: false,
    responsive_web_media_download_video_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    rweb_video_screen_enabled: true,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    responsive_web_profile_redirect_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: false,
    responsive_web_grok_annotations_enabled: false,
    responsive_web_jetfuel_frame: true,
    post_ctas_fetch_enabled: true,
    responsive_web_grok_share_attachment_enabled: true,
    articles_preview_enabled: true,
    responsive_web_grok_show_grok_translated_post: false,
    responsive_web_grok_analysis_button_from_backend: true,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_imagine_annotation_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: false,
    responsive_web_twitter_article_plain_text_enabled: true,
    responsive_web_twitter_article_seed_tweet_detail_enabled: true,
    responsive_web_twitter_article_seed_tweet_summary_enabled: true,
    creator_subscriptions_tweet_preview_api_enabled: true,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(auth),
    body: JSON.stringify({
      variables,
      features: createFeatures,
      queryId
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to post reply: ${response.status} - ${text.slice(0, 200)}`);
  }

  const data = await response.json();

  // Handle API errors
  if (data.errors && data.errors.length > 0) {
    const error = data.errors[0];
    if (error.code === 226) {
      throw new Error('Twitter blocked this action as automated. Try using cookies from a more established account, or add random delays between posts.');
    }
    throw new Error(`Twitter API error: ${error.message} (code: ${error.code})`);
  }

  const newTweetId = data.data?.create_tweet?.tweet_results?.result?.rest_id;

  return {
    success: !!newTweetId,
    tweetId: newTweetId
  };
}

interface TwitterUser {
  id: string;
  username: string;
  name: string;
  description?: string;
  followers_count?: number;
  verified?: boolean;
}

/**
 * Get the authenticated user's info using GraphQL Viewer query
 */
export async function fetchMe(auth: TwitterAuth): Promise<TwitterUser> {
  if (!auth.auth_token || !auth.ct0) {
    throw new Error('Twitter authentication not configured');
  }

  // Use settings endpoint which includes viewer info
  const url = 'https://x.com/i/api/1.1/account/settings.json';

  const response = await fetch(url, {
    headers: buildHeaders(auth)
  });

  if (!response.ok) {
    // Fallback: try to get from another endpoint
    const altUrl = 'https://api.x.com/1.1/account/verify_credentials.json';
    const altResponse = await fetch(altUrl, {
      headers: buildHeaders(auth)
    });

    if (!altResponse.ok) {
      throw new Error(`Failed to fetch user info: ${response.status}`);
    }

    const data = await altResponse.json();
    return {
      id: data.id_str,
      username: data.screen_name,
      name: data.name,
      description: data.description,
      followers_count: data.followers_count,
      verified: data.verified
    };
  }

  const data = await response.json();

  // Settings endpoint returns screen_name, need to get full user info
  const screenName = data.screen_name;

  if (!screenName) {
    throw new Error('Could not determine logged in user');
  }

  // Now fetch full user info using UserByScreenName
  const userVariables = { screen_name: screenName };
  const userFeatures = {
    hidden_profile_subscriptions_enabled: true,
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    subscriptions_verification_info_is_identity_verified_enabled: true,
    highlights_tweets_tab_ui_enabled: true,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true
  };

  const userUrl = `${GRAPHQL_BASE}/${getQueryId('UserByScreenName')}/UserByScreenName?variables=${encodeURIComponent(JSON.stringify(userVariables))}&features=${encodeURIComponent(JSON.stringify(userFeatures))}`;

  const userResponse = await fetch(userUrl, {
    headers: buildHeaders(auth)
  });

  if (!userResponse.ok) {
    // Return minimal info from settings
    return {
      id: '',
      username: screenName,
      name: screenName,
    };
  }

  const userData = await userResponse.json();
  const result = userData.data?.user?.result;
  const legacy = result?.legacy || {};

  return {
    id: result?.rest_id || '',
    username: legacy.screen_name || screenName,
    name: legacy.name || screenName,
    description: legacy.description,
    followers_count: legacy.followers_count,
    verified: legacy.verified || result?.is_blue_verified
  };
}

/**
 * Fetch accounts the user is following
 */
export async function fetchFollowing(userId: string, auth: TwitterAuth, count: number = 50): Promise<TwitterUser[]> {
  if (!auth.auth_token || !auth.ct0) {
    throw new Error('Twitter authentication not configured');
  }

  const variables = {
    userId,
    count,
    includePromotedContent: false
  };

  const features = {
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_enhance_cards_enabled: false
  };

  const url = `${GRAPHQL_BASE}/${getQueryId('Following')}/Following?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(JSON.stringify(features))}`;

  const response = await fetch(url, {
    headers: buildHeaders(auth)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch following: ${response.status} - ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const users: TwitterUser[] = [];

  try {
    const instructions = data.data?.user?.result?.timeline?.timeline?.instructions || [];
    const entries = instructions.find((i: any) => i.type === 'TimelineAddEntries')?.entries || [];

    for (const entry of entries) {
      if (!entry.entryId?.startsWith('user-')) continue;

      const userResult = entry.content?.itemContent?.user_results?.result;
      if (!userResult?.legacy) continue;

      const legacy = userResult.legacy;

      users.push({
        id: userResult.rest_id,
        username: legacy.screen_name,
        name: legacy.name,
        description: legacy.description,
        followers_count: legacy.followers_count,
        verified: legacy.verified || userResult.is_blue_verified
      });
    }
  } catch (e) {
    console.error('Error parsing following:', e);
  }

  return users;
}
