# HOP — Agent Rules & Working Agreement

Source of truth for how agents work on this project. Read this file at the start of every task and follow it.

---

## 1. Vision

HOP is a polished single-page runner game (World 1 → Dusk District → Deep Void, with a coming-soon teaser). We iterate like a game studio: fast polish passes, human-verified gameplay feel, quality over shortcuts.

- **Dev mode (planned, high priority):** an in-game panel to customize anything — change scores, reset the entire game, unlock worlds, tweak values — so testing never requires grinding through gameplay. Agents should keep this in mind when designing test hooks.
- **Size is not a constraint.** One target platform allows 30MB, others are more generous. Do not gate features, assets, or architecture on size.

## 2. Working Agreement

- **Commit after each prompt** in which changes are proposed. Commit message follows repo style: `iter#-fix#: brief summary`.
- **Maintain a commit list**: after every commit, append an entry to `COMMIT_LOG.md` (hash, message, 1-line summary of what changed).
- **Never leave the tree dirty** at the end of a task — commit or explicitly report what remains uncommitted.
- **Quality gates before commit:** `tsc`/typecheck clean and all vitest tests passing (currently 154).

## 3. Playtesting Policy

- **The human is the playtester.** If something can be tested physically on the user's machine, never simulate a full gameplay run via MCP chrome-devtools — it wastes effort and the agent struggles to simulate runs reliably. Ask the user to playtest and report back.
- **Delegate playtesting/smoke work to subagents** (`@playtest` for smoke checks, `@screens` for visual review) rather than doing it inline in the main build loop.
- **Save-state discipline:** you can always reset progress to bring back the save. Before editing save data via CDP, back up `hop_player_data` (localStorage) to the temp dir and restore it afterwards — never leave the save altered.

## 4. Model & Agent Routing

| Agent | Kind | Model | Use for |
|---|---|---|---|
| `build` | primary (default, Tab) | `opencode/deepseek-v4-flash-free` | Fast daily coding, tests, commits, most tasks |
| `deep` | primary + subagent (`@deep`) | `opencode/mimo-v2.5-free` | Hard logic, architecture, refactors, visual debugging (only primary with image support besides `@screens`) |
| `screens` | subagent (`@screens`) | `opencode/mimo-v2.5-free` | Screenshot/UI review — the only agent that can see images |
| `playtest` | subagent (`@playtest`) | `opencode/deepseek-v4-flash-free` | Smoke checks: console errors, UI states, save-based state verification |

- `build` **automatically delegates**: `@deep` for hard problems, `@screens` for visual verification, `@playtest` for smoke checks — no need to ask the user first.
- `deep` is both Tab-switchable and `@`-invocable, so the build agent can hand off mid-task.
- **No automatic model fallback exists in opencode.** If a model's free quota is exhausted or a request errors, stop and tell the user to switch (Tab between `build`/`deep`, or `/models`). Do not silently retry.

## 5. HOP Technical Notes

- Dev server: `npm run dev` → `http://localhost:3000`.
- CDP page name: `HOP (http://localhost:3000/)`.
- The play button has a 0×0 hit rect — interact via dispatched `pointerdown`/`pointerup` events, not clicks.
- Deterministic lanes for tests: `Math.random = () => 0.5` forces straight lanes.
- Save key: `hop_player_data` (localStorage). `hop_save` is stale/unused — never rely on it.
- World unlocks queue in `UIManager.checkWorldUnlocks()`; the SHOW ME handler captures `pendingUnlockWorld` before closing the unlock dialog.
- Bubble system: themed locked/unlocked copy pools; never show bubbles for the coming-soon far slot.

## 6. Task Workflow

1. Read this file, the repo status, and any relevant context.
2. Analyze the task; delegate to subagents where their specialization fits.
3. Implement; keep changes minimal and idiomatic to the existing code.
4. Verify: typecheck + tests; live-verify in browser when possible (CDP smoke only).
5. Commit (per §2) and append the commit-list entry.
