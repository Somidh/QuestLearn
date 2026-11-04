# QuestLearn technical plan

## Context

QuestLearn replaces CareerOS as the Flip the Switch hackathon entry (Track 2 + Code with Wispr, solo). You type a learning goal, and five AI agents coordinating through a Switch room build a game-style road of checkpoints. The road rebuilds itself when you struggle.

The deadline is **Nov 7, 11:59 PM IST**. The repo `flip-the-switch-demo/` is empty apart from `.git` and an uncommitted README deletion, so this is a greenfield build.

**Plan approved Nov 4. Gate 0 passed Nov 4** on a live Switch 0.31.0 server. Results:

- Console's default local server has no Gateway pages, so registration keys can't be created there. The project runs its own Docker Compose stack instead (`infra/`): API on 8000, Gateway on 3000, Mattermost on 8065.
- Agent to agent delivery took 154 ms and a round trip 282 ms, so the rebuild wait comes from the LLM calls, not Switch.
- A person's `@curriculum-agent` post in Mattermost reached the agent in 127 ms.
- `create_room` works and bridges to Mattermost. A room document created by one agent can be read by another, including after an update.

## Spec changes

| Spec says | Problem | Plan |
|---|---|---|
| `docs.flintai.dev/mcp` | The docs moved | Use `docs.switchagents.ai/mcp` |
| Agents receive events by SSE | SSE is deprecated | Use WebSocket |
| Deadline is Nov 7 | The page says 11:59 PM IST | Submit by 8 PM IST |
| Learner only uses the web app | Rules need one agent and one person to complete a task **in team chat** | Add chat paths: start a quest and answer the Coach in Mattermost |
| "Multiple quests running" (flow step 8) | The MVP list excludes it | One quest |
| Game Master is an agent like the others | XP and unlocks should be exact and instant | Rule-based agent with no LLM |
| Seed a full quest, but type the goal live | Passing a seed off as live would mislead judges | Record a real live build and cut the waiting. The seed is a fallback and supplies XP and streak history, labeled as sample data |
| Use Wispr on Day 4 | The prize is for building by voice | Use Wispr from today |
| Reuse existing Mattermost setup | The agent workflow must be built during the hackathon | Keep Mattermost, create a new room and agents, don't reuse `director-agent` |

`frontend-design` isn't installed as a skill, but its file exists in the plugin marketplace. I've read it, and I'll re-read it before UI work.

## 1. Folder structure and tech stack

```text
flip-the-switch-demo/
├─ README.md                  # leads with how Switch is used
├─ .env.example
├─ pnpm-workspace.yaml
├─ apps/
│  ├─ web/src/                # React + Vite
│  │  ├─ features/map/        # QuestMap, Road, Station, Vehicle, Camera, roadGeometry.ts
│  │  ├─ features/node/       # NodeSheet, VideoCard, DocCard
│  │  ├─ features/quiz/       # QuizGate, GateResult
│  │  ├─ features/hud/        # Hud, XpBar, LevelBadge, Streak, ProgressCount
│  │  ├─ features/team/       # TeamFeed, BuildOverlay
│  │  ├─ features/celebrate/  # confetti, sound
│  │  ├─ features/goal/       # GoalScreen
│  │  └─ store/               # Zustand store fed by the event stream
│  └─ server/src/             # one Node process
│     ├─ http/                # Hono routes + event stream to the browser
│     ├─ agents/              # curriculum, scout, quiz-master, coach, game-master
│     ├─ prompts/             # one .md per agent
│     └─ search/              # tavily.ts, verify.ts
├─ packages/
│  ├─ switch-client/          # register, WebSocket, ops, handoff line
│  ├─ core/                   # Zod schemas, gameRules, applyRoadPatch, LLM adapter
│  └─ db/                     # Drizzle schema and queries
├─ scripts/                   # bootstrap.ts, seed.ts, smoke.ts, check-links.ts
├─ seed/                      # system-design quest and sample progress
└─ docs/                      # architecture diagram, Wispr scorecard
```

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript, pnpm workspace | Node 22 and pnpm are installed, Python isn't |
| Frontend | React, Vite, Tailwind, `motion` (Framer Motion), Zustand | As the spec recommends |
| Backend | Hono, in one Node process with the agent clients | One writer to the database and one thing to start |
| Database | SQLite with Drizzle | Nothing to install for a clone |
| LLM | `LLM_PROVIDER` in `.env`: free Gemini while building, Claude Haiku 5.5 (`claude-haiku-5-5`) for the recording | Your choice |
| Search | Tavily, plus YouTube oEmbed checks | One free key (see section 7) |

## 2. The five agents on the Switch protocol

Use **custom clients on the documented protocol**, not Console-run Claude Code sessions. They give validated JSON, code-level rules and a repo others can clone. `packages/switch-client` implements it, since Switch ships no client library.

| Agent name | Type | Job |
|---|---|---|
| `curriculum-agent` | LLM | Goal to ordered checkpoints, and writes road patches |
| `resource-scout` | Search + LLM picker | Real video and docs per checkpoint |
| `quiz-master` | LLM | Quiz per checkpoint |
| `coach` | LLM | Decides how to adapt |
| `game-master` | Rules only | XP, unlocks, triggers, and the app's voice in the room |

- **Registration:** `POST /agents` once per agent with a Gateway registration key. Body: `name`, `display_name`, `description`, `connector_type: "questlearn"`, and `integration_profile` with `connection_model: "always_on"`, `message_exchange: true` and the three mediation arrays empty. The `{id, api_key}` response is saved to a gitignored file. Same-owner agents can address each other by default.
- **Connection:** open `/agents/{id}/connection/ws?connection_id=<uuid>&rooms=<id>`, answer each `ping` with `{"type":"pong","cursor":n}` before any other work, then call `connect_to_room`. Resume with `start_from` and `expected_generation`, and stop completely on `taken_over`.
- **Acting:** act only when `payload.addressed` is true, and skip duplicate `message_id`s. `game-master` uses `filter=all` so it can mirror the room to the UI; the rest use `filter=addressed`.
- **Handoffs:** `send_targeted_message(body, target_names, thread_id)`, checking `target_statuses`. Posts stay under about 1,500 characters because the Mattermost bridge caps posts at 4,000.
- **Shared context:** room Instructions hold the team rules. `curriculum-agent` owns one `quest-<id>` room document (only the creator can edit it), which others read with `load_internal_documents`.
- **Boundary:** agents never call each other in-process or read each other's rows. Only the browser's link to `game-master` is local, so passing a gate feels instant. All agent coordination stops if Switch stops.

Handoff format, with a hop cap of 8 enforced in code:

```text
@resource-scout @quiz-master Road planned: 8 checkpoints for "system design".
[questlearn v1 type=quest.planned quest=q_12 doc=<document_id> rev=1 hop=2]
```

**Build flow:** goal arrives from the web (through `game-master`) or from `@curriculum-agent` in Mattermost. Curriculum posts the plan, then Scout and Quiz Master work in parallel and report each checkpoint to `game-master`. A checkpoint is ready when it has both resources and a quiz, and stations appear on the road as they're ready.

## 3. Quest data model

```ts
Quest      { id, goal, status: building|active|complete, revision, switchDocId, createdAt }
Node       { id, questId, slot, title, summary, icon, difficulty: 1-5,
             status: building|locked|current|completed|skipped,
             origin: curriculum|coach, insertedFor?: nodeId }
Resource   { id, nodeId, kind: video|doc, url, title, source, thumbnailUrl?, verifiedAt }
Question   { id, nodeId, prompt, options: string[4], correctIndex, explanation }
Attempt    { id, nodeId, score, total, passed, answers, createdAt }
Progress   { xp, level, streakDays, lastActiveDate, questId, currentNodeId }
RoadRevision { id, questId, revision, requestId, action, reason, patch, createdAt }
Activity   { id, sender, senderName, body, timestamp }     // mirror of the room
```

`correctIndex` and `explanation` never reach the browser until the attempt is graded on the server. Each quiz has 5 questions, a retake reshuffles them, and passing needs 4 of 5.

## 4. How the Coach rebuilds the road

1. `game-master` applies fixed triggers: 2 failures on one checkpoint, or 3 perfect first-try passes in a row.
2. It addresses `@coach` with the attempt numbers.
3. Coach reads the quest document and picks one allowed action, posting its reasoning to the room.
4. Coach sends the adaptation request to `@curriculum-agent`, which returns a `RoadPatch`.
5. `applyRoadPatch()` in `packages/core` validates it and applies it in one transaction. `quest.revision` goes up by one and a `RoadRevision` records why. The request ID makes retries safe.
6. The browser receives `road.patched`, and the new station appears under construction.
7. `@resource-scout` and `@quiz-master` fill it. When both report, the station opens.

| Action | Effect | Priority |
|---|---|---|
| `insert_prerequisite` | Adds an easier checkpoint before the failed one | Demo critical |
| `skip_ahead` | Offers a jump, and **you decide** in the app or by `@coach yes` in chat | Must have |
| `swap_resource` | Scout replaces a resource with a simpler one | Should have |
| `add_practice` | Adds a practice checkpoint | Cut first |

Code enforces these limits: completed checkpoints never change, at most 2 inserts per checkpoint and 4 per quest, and 14 checkpoints in total. The chat approval only counts if the sender matches your linked account.

Scout, Quiz Master and Coach all run in this chain, so a rebuild may take 20-40 seconds. The under-construction station makes that wait part of the moment, and Gate 0 measures the real number.

## 5. Agent system prompts

Shared preamble for the LLM agents:

```text
You are {name} on the QuestLearn tutor team in #quest-build.
Work only from the quest document and message you were given.
Never invent links, sources or learner results.
If something is missing, say so. Return only JSON matching the schema.
Keep "summary" under 600 characters. It is posted to the team room.
```

- **Curriculum Agent:** "Turn the goal into 6-10 ordered checkpoints, from first principles to applied skill. Each teaches one idea, builds on the last, and gets a short title, one-sentence summary, difficulty 1-5 and icon keyword. For an adaptation request, return a RoadPatch only: the smallest change that fixes the stated difficulty, leaving completed checkpoints alone."
- **Resource Scout (picker only):** "From the numbered candidates, choose the best video and 1-2 best docs for this checkpoint. Prefer official docs and well-known educators, and match the difficulty. Return candidate numbers only, never URLs. If none fit, return an empty list."
- **Quiz Master:** "Write 5 multiple-choice questions testing understanding, not recall: use scenarios, trade-offs and 'what happens if'. Give 4 plausible options, exactly one correct, and a one-sentence explanation. Match the difficulty."
- **Coach:** "You receive a learner's attempt numbers and the road. Choose one action: insert_prerequisite, skip_ahead, swap_resource or add_practice. Name the likely gap from the missed questions and give one encouraging sentence addressed to the learner. Prefer the smallest change that gets them moving."
- **Game Master:** no prompt. Its posts are fixed templates such as "Gate passed: Caching. +150 XP."

## 6. Quest map UI and animation

**Design direction, "Night drive":** a camper van travels a glowing road through a dusk landscape, with stations as roadside beacons. The road is the single bold element and everything else stays quiet.

| Token | Value | Use |
|---|---|---|
| Dusk | `#1B1340` | Background |
| Plum | `#2E1F5E` | Terrain, panels |
| Road glow | `#FFB72B` | Road, completed stations |
| Mint | `#2EE6A6` | Passing, XP |
| Coral | `#FF5C7A` | Failing, streak |
| Sky | `#7FD4FF` | Coach's changes |

Type is Fredoka for display and Figtree for body text. I'll do the two-pass design review from the skill before coding, then critique from screenshots. Desktop only per the spec, with keyboard focus and reduced motion respected.

| Component | Job |
|---|---|
| `QuestMap` | Holds the scene and listens to the store |
| `Road` | One SVG path: glow layer, base road, lit progress layer |
| `Station` | Completed, current, locked and building states |
| `Vehicle` | Follows the road on a spring |
| `Camera` | Pans the scene to keep the van in view |
| `NodeSheet`, `QuizGate` | Resources, then the quiz |
| `Hud` | XP bar, level, streak, progress |
| `TeamFeed` | Live mirror of the Switch room |
| `BuildOverlay` | Shows agents working during the build |

**Three animation choices keep this achievable:**

1. **Fixed road, moving stations.** `roadGeometry.ts` builds one winding path with 16 slots, and each station sits at a slot. The path never needs morphing.
2. **Van on a spring.** A `useSpring` value drives progress, and `getPointAtLength` gives its position and rotation, so it follows the curve.
3. **Rebuild without path changes.** Stations from the failed one onward slide one slot forward along the road, and the new station pops in under the van, which stays still. The road's lit end extends, and a Sky-colored pulse travels the changed stretch.

Passing a gate plays the van's move, then `canvas-confetti`, the XP fill and an optional sound, as one orchestrated sequence.

## 7. How resources are found

Links come from search results, never from the model, so fabricating one isn't possible by design.

1. Run two Tavily searches per checkpoint: docs and articles, then video with `include_domains: ["youtube.com"]`.
2. Filter candidates in code. Videos must pass YouTube's oEmbed check, which also returns the title and thumbnail. Docs must return HTTP 200 with a matching title.
3. Give the verified candidates to the LLM, which returns only their numbers.
4. Code looks up the URLs by number and saves them.
5. If nothing survives, retry once with a broader query, then show "No resource found" rather than inventing one.

A quest of 8 checkpoints uses about 16 credits. Tavily's free plan reports 1,000 credits a month with no card required. Results are cached by query, and at most 3 run at once.

## 8. Day-by-day plan

**Gate 0, first thing:** two bare agents hand off in `#quest-build` and it shows in Mattermost. The same test confirms what the docs don't fully cover: `GET /ops` argument shapes, `create_room`, whether a new room document loads, and handoff latency. If documents can't be loaded, handoffs stay in Switch and only large payloads move to SQLite, which the README will state.

| Day | First half | Second half | Must be true by the end |
|---|---|---|---|
| **Nov 4** (rest of today) | Gate 0, scaffold, switch client, bootstrap script | Curriculum Agent, goal screen, static road | A goal becomes stations on the map through Switch |
| **Nov 5** | Resource Scout, search and verification, NodeSheet | Road glow, van spring animation, HUD, TeamFeed | Road, Curriculum and Scout work end to end |
| **Nov 6** | Quiz Master, QuizGate, Game Master rules | Coach, `applyRoadPatch`, rebuild animation | Failing twice inserts a checkpoint live |
| **Nov 7** | UI polish, celebrations, seed, README, fresh-clone test | Record by 4 PM IST, submit by 8 PM IST | Submitted with about 4 hours spare |

Quiz and Coach work doesn't start until Nov 5's end condition passes. If time runs short, cut in this order: `add_practice`, sound, `swap_resource`, `skip_ahead`. Real Switch traffic, the van animation and `insert_prerequisite` are never cut.

## 9. Demo seed data

- **Quest:** "Learn system design" with 8 checkpoints: Client-server basics, Scaling, Load balancing, Caching, Databases, Sharding, Message queues, Design a URL shortener.
- **Resources and quizzes:** all real and checked by `check-links.ts` on the day of recording.
- **Fail path:** Caching has hard questions. Coach inserts "What is a cache?" live.
- **Progress:** a level and a 5-day streak so the HUD looks lived-in, labeled as sample data in the README.

Recording uses a real live build. The seed is the fallback if a live run fails, and in that case the video says so.

## 10. Submission checklist

**Track 2**
- [ ] Public repo passes a fresh-clone test
- [ ] README covers how Switch is used, the architecture, setup and which data is sample
- [ ] Video shows real agent traffic in Mattermost
- [ ] Video shows a person and an agent completing a task in chat
- [ ] You can explain the code, as the rules require

**Code with Wispr**
- [ ] Prompts, agent instructions and docs dictated throughout
- [ ] Scorecard screenshot from Insights in the Wispr Flow desktop app

**Optional:** Best Blog and #HowISwitch can reuse the README, if there's time.

## Your setup steps

1. Open Switch Console so the server starts.
2. Create a registration key under **API Keys** in the Gateway.
3. Check your Mattermost account is linked to Switch, or your agents will ignore you.
4. Get a free Gemini key and a free Tavily key now, and Anthropic credit by Nov 7.

Keys go in `.env`, not in chat.

## First steps after approval

1. Re-add `switch-docs` at user scope. It's saved under `D:/Workspace/hackathon`, so it disappears when a session opens as `d:`.
2. Update memory: QuestLearn replaces CAREEROS.
3. Save this plan as `PLAN.md` in the repo, then start Gate 0.

## Verification

- **Unit tests (Vitest):** `applyRoadPatch` limits, `gameRules` XP and streaks, quiz grading, handoff line parsing.
- **`scripts/smoke.ts`:** runs a goal through to a ready road and asserts the expected messages appear via `read_context`.
- **Switch dependency test:** stop the Switch server and confirm no quest builds.
- **Adaptation test:** fail one gate twice and confirm a new station, revision and Coach post in Mattermost.
- **Link test:** `check-links.ts` passes for every saved resource.
- **Answer leak test:** the quiz API response contains no `correctIndex`.
- **Visual check:** screenshots of each station state, and a run with reduced motion on.
- **Fresh clone:** follow the README from an empty folder.

## Sources

- [Switch agent protocol](https://docs.switchagents.ai/switch-rooms/internals/agent-protocol), [agent connection](https://docs.switchagents.ai/switch-rooms/internals/agent-connection), [agent events](https://docs.switchagents.ai/switch-rooms/internals/agent-events), [shared context](https://docs.switchagents.ai/switch-rooms/using/shared-context)
- [Switch source](https://github.com/sandbox-quantum/switch): operation signatures and the Mattermost post limit
- [Hackathon page](https://www.wemakedevs.org/hackathons/switch)
- [Tavily pricing](https://help.tavily.com/articles/8816424538-pricing): free credits, to confirm when signing up
