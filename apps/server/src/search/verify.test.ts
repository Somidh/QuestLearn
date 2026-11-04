import { describe, expect, it } from 'vitest';
import { titlesMatch, verifyVideo } from './verify';

describe('titlesMatch', () => {
  it('accepts a page whose title shares a real word', () => {
    expect(titlesMatch('Caching - System Design', 'Caching explained | GeeksforGeeks')).toBe(true);
  });

  it('rejects a page that has become something else', () => {
    expect(titlesMatch('Caching - System Design', 'Domain for sale')).toBe(false);
  });

  it('ignores filler words', () => {
    expect(titlesMatch('The guide for caching', 'The guide for gardening')).toBe(false);
  });
});

describe('verifyVideo', () => {
  it('skips anything that is not a watch URL, without a network call', async () => {
    const result = { url: 'https://www.youtube.com/@somechannel', title: 'A', content: '' };
    await expect(verifyVideo(result)).resolves.toBeNull();
  });
});
