# HOP — Agent Rules & Working Agreement

Source of truth for how agents work on this project. Read this file at the start of every task and follow it.

> **A new agent should also read `HANDOFF.md`** — it carries the repo map, current
> state per world, the art workflow that works, and the rendering/shell gotchas that
> cost real time to learn. This file says *how* to work; `HANDOFF.md` says *what you
> are walking into*.

---

## 1. Vision

HOP is a polished single-page runner game (World 1 → Dusk District → Deep Void, with a coming-soon teaser). We iterate like a game studio: fast polish passes, human-verified gameplay feel, quality over shortcuts.

- **Dev mode (planned, high priority):** an in-game panel to customize anything — change scores, reset the entire game, unlock worlds, tweak values — so testing never requires grinding through gameplay. Agents should keep this in mind when designing test hooks.
- **Size is not a constraint.** One target platform allows 30MB, others are more generous. Do not gate features, assets, or architecture on size.

## 2. Working Agreement

- **Commit after each prompt** in which changes are proposed. Commit message follows repo style: `iter#-fix#: brief summary`.
- **Maintain a commit list**: after every commit, append an entry to `COMMIT_LOG.md` (hash, message, 1-line summary of what changed).
- **Never leave the tree dirty** at the end of a task — commit or explicitly report what remains uncommitted.
- **Quality gates before commit:** `tsc`/typecheck clean and all vitest tests passing. Get the current count from `npx vitest run` — do not trust a number written in this file, it goes stale.

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

- Dev server: `npm run dev` → `http://localhost:3000`. Preview server: `npm run preview` → `http://localhost:4173` (serves the latest `dist/`).
- CDP page name: `HOP (http://localhost:3000/)` (dev) or `HOP (http://localhost:4173/)` (preview).
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

## 7. Shell / PowerShell Safety (Windows 5.1)

Commands can hang indefinitely in this environment. Root causes observed and the rules that prevent them:

- **NEVER run a long-lived server process in the foreground.** `npm run dev`, `npm run preview`, and `vite` never exit — the shell tool blocks until timeout (or forever). Before starting any server, check whether the port is already listening:
  `Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue`
  If it is not running, start it DETACHED and poll until it listens:
  `Start-Process -FilePath "cmd" -ArgumentList "/c npm run preview" -WindowStyle Hidden; Start-Sleep -Seconds 3; Get-NetTCPConnection -LocalPort 4173 -State Listen`
  Never leave the foreground blocked on a server. This also applies to subagents: never instruct `@playtest`/`@screens` to "run npm run preview" in the foreground — tell them to check the port first and start it detached.
- **NEVER truncate native-command output with `Select-Object -First/-Last`** (e.g. `npm test 2>&1 | Select-Object -Last 30`). On Windows PowerShell 5.1, npm/node spawns child processes (vite workers, rollup, esbuild) that inherit the stdout/stderr handles; the pipeline never sees EOF and PowerShell waits forever. The shell tool already captures full output to a file when it exceeds the limit — run commands bare and read the captured file if needed.
- **Avoid `npx` for anything that may need installing** — it can prompt "Ok to proceed? (y)" and hang on stdin. Prefer local binaries (`node_modules/.bin/...`, or `npm exec --no-install`). If `npx` is unavoidable, pass `--no-install` or `-y`.
- **Always pass an explicit `timeout`** to the shell tool for anything that could run long (builds, tests, installs).
