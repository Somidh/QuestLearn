export type SearchResult = { url: string; title: string; content: string };

export type SearchOptions = {
  includeDomains?: string[];
  excludeDomains?: string[];
};

const MAX_RESULTS = 6;

// Quests repeat while building and testing, and every search costs a credit.
const cache = new Map<string, Promise<SearchResult[]>>();

async function request(
  apiKey: string,
  query: string,
  options: SearchOptions,
): Promise<SearchResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      max_results: MAX_RESULTS,
      search_depth: 'basic',
      include_domains: options.includeDomains,
      exclude_domains: options.excludeDomains,
    }),
  });
  if (!response.ok) {
    throw new Error(`Tavily returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  const { results } = (await response.json()) as { results: SearchResult[] };
  return results;
}

export function search(
  apiKey: string,
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const key = JSON.stringify([query, options]);
  const cached = cache.get(key);
  if (cached) return cached;

  const pending = request(apiKey, query, options);
  cache.set(key, pending);
  pending.catch(() => cache.delete(key));
  return pending;
}
