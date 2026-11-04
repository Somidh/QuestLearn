// Checks that every resource on the current quest still resolves.
// Run before recording: pnpm check-links
const API = process.env.QUESTLEARN_URL ?? 'http://localhost:8787';
const TIMEOUT_MS = 10_000;

type Resource = { kind: string; url: string; title: string };
type State = { quest: { goal: string; nodes: { title: string; resources: Resource[] }[] } | null };

const { quest } = (await (await fetch(`${API}/api/state`)).json()) as State;
if (!quest) {
  console.error('There is no quest to check.');
  process.exit(1);
}

async function isLive({ kind, url }: Resource): Promise<boolean> {
  const target =
    kind === 'video'
      ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`
      : url;
  const response = await fetch(target, {
    headers: { 'User-Agent': 'QuestLearn/0.1 (link check)' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);
  return response?.status === 200;
}

let total = 0;
let dead = 0;
let empty = 0;

for (const node of quest.nodes) {
  if (node.resources.length === 0) empty += 1;
  const results = await Promise.all(node.resources.map(isLive));
  node.resources.forEach((resource, index) => {
    total += 1;
    if (!results[index]) {
      dead += 1;
      console.log(`DEAD  ${node.title}: ${resource.url}`);
    }
  });
}

console.log(`"${quest.goal}": ${total} links, ${dead} dead, ${empty} checkpoints with no links.`);
process.exit(dead > 0 ? 1 : 0);
