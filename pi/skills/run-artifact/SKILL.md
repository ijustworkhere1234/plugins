---
name: run-artifact
description: Opt-in: keep one living Meta Artifact per multi-step run (plan, progress, open questions, decisions, resume point) so humans can track and share it from a link. Read when a pstack skill or the Pi adapter sends you here.
disable-model-invocation: true
---

# Run artifact

A run's plan and progress can live where a human can open and share them, not only in local files and this chat. A run the operator opts in keeps one Markdown Meta Artifact, visible to anyone at Meta with the link. Local state stays the source of truth. The artifact is the human view of it.

## Ask before you start

A run gets an artifact only when the operator says so. Settle it before work starts, with the other clarifying questions:

- If the operator already said, in the request or earlier in the session, follow that and do not ask.
- If an artifact for this work already exists (a pickup, or the operator links one), keep updating it and do not ask.
- Otherwise ask once, with `ask_user`, only when the work has a plan or a task list of three or more items, or a playbook will write a plan file, a status page, human gates, a decision trail, or a resume note. Never ask for a single question or a small fix.
- No answer, or no `ask_user`, means no artifact.

The answer holds for the whole run. Do not ask again at later phases.

Only the coordinator, the agent talking to the operator, writes it. Subagents report back and never publish.

## Create it

1. Pick the reference key: `pstack-<repo>-<slug>`, where `<slug>` names the work in a few lowercase words, such as `pstack-smoldata-queue-retries`. Reuse the same key for the whole run, across pauses and pickups.
2. Write the page to a local file, `/tmp/pstack-run-<key>.md`, with the layout below.
3. Run `bash <pstack>/skills/run-artifact/scripts/publish.sh <key> "<title>" /tmp/pstack-run-<key>.md`. It creates the artifact on the first call and appends a version afterwards, then prints the URL.
4. Put the URL in your reply. Also put it in the task list, the plan file, and the PR description of any PR the run opens.

## Update it

Rebuild the whole page from current state and publish again at every checkpoint:

- a task or phase finishes, or the plan changes
- a PR opens, changes state, or lands
- a question for the operator opens or is answered
- an orchestrator drain, a `/loop` tick that changed something, a pause, and the end of the run

Rebuild it from the real state: the task list, the plan file, `git` and `gh`, `units.tsv` and `ledger.tsv`, and the decision log. Never append event narration. The artifact keeps every earlier version, so rewriting the page loses nothing.

If `meta artifacts.comment list --reference-key=<key> --output=json` works on this host, read new comments at each checkpoint and treat them as operator input. It is disabled on laptops. Do not edit or post comments unless the operator asks.

## Page layout

Keep it readable in under a minute. Leave out empty sections.

```markdown
# <Title>

ELI5: <one or two plain sentences on what this run is for>

**Status:** <working | blocked on operator | paused | done> · updated <ISO timestamp> · <repo>@<branch>

## Next
<The one next action, and who it waits on.>

## Questions for the operator
- <question> (options: ..., default if no answer: ...)

## Plan
- [x] <done item> (<PR, commit, or evidence>)
- [ ] <pending item>

## PRs and branches
| PR | State | Head | Verdict |

## Decisions
| When | Decision | Why | Evidence |
<The last ten rows of the decision log, newest first, plus its path.>

## Resume
<What a fresh agent needs: worktree path, branch, state files, gotchas.>
```

## Rules

- No secrets, tokens, credentials, customer data, or private chat. Anyone at Meta can open the link.
- One artifact per run. Find an earlier one with `meta artifacts.artifact describe --reference-key=<key> --if-exists --output=json` before you pick a new key.
- A failed publish never blocks the work. Say so in one line and publish at the next checkpoint.
- Session pickup: open the artifact first (`meta artifacts.artifact content --reference-key=<key>`) to find the resume point, then check it against the real state.
