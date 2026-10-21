# pstack in Pi

pstack skills use Cursor names. In Pi, read this file once per session, then map each Cursor name in a skill with the tables below. `<pstack>` means the folder that holds `skills/` and `docs/`; the pi-pstack extension states its absolute path in the system prompt. If a Cursor field has no row, drop it and say so. Never pass a field or value the tool schema rejects.

This adapter assumes the Pi packages `@tintinweb/pi-subagents` (the `Agent` tool), `pi-ask-user` (`ask_user`), and `@tintinweb/pi-tasks` (`TaskCreate`, `TaskUpdate`, `TaskList`). When one is missing, use the fallback in its row.

## Tools

| Cursor | Pi |
| --- | --- |
| `Task` | `Agent` (`subagent_type`, `prompt`, `description`). Read a background result with `get_subagent_result`; redirect a running agent with `steer_subagent`. Never spawn a pstack subagent with pi-tasks' `TaskExecute`: it takes no `thinking`, `isolation`, or `resume`, so it drops the role's reasoning level. Without the `Agent` tool, do the work inline and say so. |
| `AskQuestion` | `ask_user`, one question per call. In `pi -p` mode it is absent, so ask in plain text. |
| Open a todolist | `TaskCreate` for each item and `TaskUpdate` as each phase finishes; `TaskList` to show it. These pi-tasks tools are unrelated to Cursor's `Task`. Without them, keep the list in your reply and update it at each phase. |
| Run another pstack skill (`/name` or "the **name** skill") | `read` `<pstack>/skills/<name>/SKILL.md` and follow it. When you tell the user to type it, write `/skill:<name>`. |
| `Grep`, `Glob` | `grep`, `find`. Fall back to `bash` with `rg` when the session has neither. |

## Subagent fields

| Cursor | Pi `Agent` |
| --- | --- |
| `subagent_type: generalPurpose` | `subagent_type: "general-purpose"` |
| `poteto-agent`, `comment-sicko` | `subagent_type: "poteto-agent"`, `subagent_type: "comment-sicko"`. pi-pstack ships both, plus `pstack-readonly`, so they are listed with no prefix. |
| `readonly: true` | `subagent_type: "pstack-readonly"`. It has only read-only tools plus `bash`, so also write "do not edit files" in the prompt, and check `git status` afterward. Do not use `Explore`: its model is pinned to a small fast model, so your `model` is ignored, and it reads only excerpts. |
| `readonly: false` | `general-purpose`, or the named agent. |
| `environment: "cloud"` | `isolation: "worktree"`. Name the branch or commit the worker checks out. |
| `environment: "local"` | Omit. |
| `cloud_base_branch: <b>` | Tell the worker to check out `<b>` first. |
| `run_in_background: true` | `run_in_background: true`, which is also the default. `false` blocks and returns the result inline. |
| `resume` | `resume: "<agent id>"`, or `steer_subagent` while it still runs. |
| `file_attachments` | List the paths in the prompt. |

## Models

| Cursor | Pi `Agent` |
| --- | --- |
| `claude-<family>-<version>-<effort>[-fast]`, such as `claude-opus-5-5-xhigh` | `model: "anthropic/claude-<family>-<version>"` and `thinking: "<effort>"`. Drop `-fast`. Use a model that `pi --list-models` shows; otherwise omit `model` and say so. |
| A `grok-*`, `gpt-*`, or other non-Claude slug | Use the role's line in `pstack-models.md` when it names a Pi model. Otherwise omit `model` so the agent runs on the session model, and say so. |
| `auto` or `inherit-parent` | Omit `model`. |
| The `pstack-models.mdc` rule, `~/.cursor/rules/pstack-models.mdc` | `~/.pi/agent/pstack-models.md`. The pi-pstack extension appends it to every session's system prompt, so its role lines are already in context. If they are not, read the file. If the file or the role's line is missing, use the skill's default slug. |
| A role value `<provider>/<model> <thinking>`, such as `anthropic/claude-opus-5-5 high` | `model: "anthropic/claude-opus-5-5"` and `thinking: "high"`. |

## setup-pstack

Follow its steps with these changes:

- Detect. Run `pi --list-models`; it lists the models this machine can use. Write a real model as `<provider>/<model> <thinking>`, such as `anthropic/claude-opus-5-5 xhigh`. The thinking level is the last token, so the budget step works as written. Thinking levels are `minimal`, `low`, `medium`, `high`, `xhigh`, `max`; Pi clamps a level the model does not support.
- Defaults. `claude-opus-5-5-xhigh` is `anthropic/claude-opus-5-5 xhigh`. `grok-4.7-xhigh-fast` has no Pi equivalent. Offer the user's non-Anthropic models for it so panels keep a second model family, else `inherit-parent`.
- Write. Write `~/.pi/agent/pstack-models.md` with no frontmatter, then the comment lines, the `# budget` line, and one line per role from step 5. Overwrite the whole file. Never put the role lines in `AGENTS.md`.
- Confirm. Tell the user it applies to new Pi sessions.

## Paths

| Cursor | Pi |
| --- | --- |
| `.cursor/skills/`, `~/.cursor/skills/` | `.pi/skills/` or `.agents/skills/`, and `~/.pi/agent/skills/` |
| `~/.cursor/plugins/`, `.cursor-plugin/plugin.json` | The pi-pstack package. `<pstack>` is the path the extension states; `pi list` shows the package source. |
| `.cursor/rules/*.mdc`, always-applied rules | `AGENTS.md` in the project, or `~/.pi/agent/AGENTS.md` for every project. Pi never reads `.mdc` files. The model rule is the exception. See Models. |
| `https://github.com/cursor/plugins/blob/main/pstack/<path>` | `<pstack>/<path>` when that file exists. The package ships the skills, `docs/guide/`, and `README.md`. Read the local copy and never fetch it. Give the user the URL when they need a link. |
| Transcripts in `~/.cursor/projects/<slug>/agent-transcripts/` | `~/.pi/agent/sessions/--<slug>--/*.jsonl`. The slug is the workspace path without its leading `/`, with each `/` changed to `-`, so `/Users/you/proj` is `--Users-you-proj--`. The newest `.jsonl` in that folder is the current session. A subagent's transcript is the `.output` path its `Agent` result names, or read it with `get_subagent_result`. Read only this workspace's folder. |

## Cursor built-ins and cursor-team-kit

| Cursor | Pi |
| --- | --- |
| `/loop [interval] <prompt>` | The pi-pstack `/loop` command, with the same shape: it re-sends the prompt to this session as a new user turn every interval (`30s`, `5m`, `2h`, `1d`; 10s minimum), or with no interval as a dynamic loop where you choose each next delay with `loop_next`. "until X" is part of the prompt, so call `loop_stop` with the evidence when X holds. When a step tells you to arm a loop, call `loop_start` with the tick prompt and interval; Pi slash commands are typed by the user. A loop lives only as long as the Pi session. It does not survive a restart. |
| `cursor-team-kit` skills `deslop`, `control-cli`, `control-ui` | pi-pstack ships these three. Read `<pstack>/skills/<name>/SKILL.md`, or tell the user `/skill:<name>`. pi-pstack ships no other `cursor-team-kit` skill. Skip a step that needs one with the Cursor-only line below. |

## Cursor-only features

Pi has no Cursor Automations, Bugbot, Cursor cloud agents, or built-in PR tool. When a step needs one, put one line in your reply, `Skipped in Pi: <step>. <reason>.`, then go on to the next step. Do not stop, ask, or retry. When a later step needs what the skipped step made, such as a URL or a key, leave a placeholder and name it in the line.

| Cursor | Pi |
| --- | --- |
| Cursor Automations: routines, `update_state` routine calls, `api2.cursor.sh/automations` webhooks, routine wakes, and `SendToUser` secret requests | Skip with the line. |
| Bugbot | Bugbot comments on a GitHub PR are ordinary review threads, so triage them with the forge command that the step gives. Skip a step that starts, waits for, or configures Bugbot when the PR has no Bugbot check or comment. |
| Cursor cloud agents | `environment: "cloud"` maps to a worktree, as in Subagent fields. Skip a step that needs the cloud agent itself, such as its dashboard status or its own machine. |
| A built-in PR tool | Use the forge command that the step gives, such as `gh pr create`. That is not a skip, so write no line. |

### PR status in Pi

A forge command shows only what you ask it for. `gh pr checks` reports CI and nothing about reviews. Before you report a PR's status, call it ready, enqueue it, or offer to merge it, read all of these for the current head:

- CI: `gh pr checks <number>`.
- Review state: `gh pr view <number> --json headRefOid,reviewDecision,mergeStateStatus,reviews`.
- Unresolved review threads: the GraphQL `reviewThreads` connection, outdated threads included. `gh pr view` does not expose them.

A `CHANGES_REQUESTED` review or an unresolved thread blocks the PR the same way a failing check does, including one from a review bot. Check again after every push, because a new head can dismiss an approval or bring new comments. If the repository documents its own merge-readiness rules, follow them.
