import type { FoundResource } from '@questlearn/core';
import type { SearchResult } from './tavily';

const TIMEOUT_MS = 5000;
const WATCH_URL = /^https:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]{11}/;
const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'what', 'how', 'guide', 'tutorial']);

function words(text: string): Set<string> {
  const found = text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  return new Set(found.filter((word) => !STOP_WORDS.has(word)));
}

/** True when a live page's title still shares a word with the search result. */
export function titlesMatch(expected: string, actual: string): boolean {
  const actualWords = words(actual);
  return [...words(expected)].some((word) => actualWords.has(word));
}

function hostname(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '');
}

/** A video is real if YouTube's oEmbed endpoint describes it. */
export async function verifyVideo(result: SearchResult): Promise<FoundResource | null> {
  if (!WATCH_URL.test(result.url)) return null;

  const oembed = new URL('https://www.youtube.com/oembed');
  oembed.searchParams.set('format', 'json');
  oembed.searchParams.set('url', result.url);

  const response = await fetch(oembed, { signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(
    () => null,
  );
  if (!response?.ok) return null;

  const video = (await response.json()) as {
    title: string;
    author_name: string;
    thumbnail_url: string;
  };
  return {
    kind: 'video',
    url: result.url,
    title: video.title,
    source: video.author_name,
    thumbnailUrl: video.thumbnail_url,
  };
}

/** A page is real if it answers 200 with HTML and a title that still matches. */
export async function verifyDoc(result: SearchResult): Promise<FoundResource | null> {
  const response = await fetch(result.url, {
    headers: { 'User-Agent': 'QuestLearn/0.1 (link check)', Accept: 'text/html' },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);

  if (!response || response.status !== 200) return null;
  if (!response.headers.get('content-type')?.includes('text/html')) return null;

  const html = await response.text().catch(() => '');
  const pageTitle = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim();
  if (pageTitle && !titlesMatch(result.title, pageTitle)) return null;

  return {
    kind: 'doc',
    url: result.url,
    title: result.title,
    source: hostname(result.url),
    thumbnailUrl: null,
  };
}
