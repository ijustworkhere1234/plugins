# About this fork

`ijustworkhere1234/plugins` is a personal fork of `cursor/plugins`. It exists so Pi can install pstack as a package: `pi install git:github.com/ijustworkhere1234/plugins@main`, or the local clone at `~/local/cursor-plugins`.

## Policy: track upstream `main`

- The working branch is `pi`, which is upstream `main` plus our commits.
- The fork's `main` and `pi` must both equal that local branch. The GitHub fork always reflects what Pi installs.
- We never edit upstream files. Every change is a new path, so rebases do not conflict.

## Our commits on top of upstream

All additions; nothing upstream is modified:

1. `pstack/docs/harness/pi.md`: the Cursor-to-Pi adapter, next to upstream's `claude-code.md`. It targets `@tintinweb/pi-subagents` (`Agent`), `pi-ask-user` (`ask_user`), and `@tintinweb/pi-tasks` (`TaskCreate`).
2. `pi/extension.ts`:
   - Adds a short pstack section to every Pi system prompt (the absolute `<pstack>` path, read the adapter) and appends `~/.pi/agent/pstack-models.md` when it exists.
   - `/loop [interval] <prompt>`, `/loop stop`, `/loop status`, and the tools `loop_start`, `loop_next`, `loop_stop`: the Pi version of Cursor's built-in `/loop`. It re-sends the prompt to the same session on a fixed interval, or dynamically when the agent picks each delay. It lasts only as long as the session.
3. `pi/agents/pstack-readonly.md`: the Pi mapping for `readonly: true`. pi-subagents' `Explore` pins its own small model and reads excerpts, so it cannot stand in.
4. `scripts/generate-pstack-pi-tree.mjs`: a fork of upstream's `generate-pstack-harness-trees.mjs`. It builds `harness/pstack-pi/pi/` and **fails if a skill uses a Cursor term the Pi adapter has no row for** (we added `cursor-team-kit` and `/loop` to its terms). It converts the two pstack agents to pi-subagents format, copies `pi/agents/`, and ships the `cursor-team-kit` skills pstack routes to: `deslop`, `control-cli`, `control-ui`.
5. `harness/pstack-pi/`: the generated tree. Never edit it by hand.
6. `package.json`: the Pi manifest (skills, extension, subagents). Upstream has no root `package.json`.

## Updating (pull latest upstream, regenerate, reinstall)

```sh
cd ~/local/cursor-plugins
git fetch upstream
git rebase upstream/main                          # on pi
node scripts/generate-pstack-pi-tree.mjs          # FAIL = upstream added a Cursor term; add a row to pstack/docs/harness/pi.md
node scripts/generate-pstack-pi-tree.mjs --check
git diff --stat upstream/main                     # must show ONLY the paths above (plus FORK.md)
git add -A && git commit -m "chore(pi): regenerate for upstream <sha>"   # if the tree changed
git push --force-with-lease origin HEAD:main
git push --force-with-lease origin pi
git rev-list --count origin/main..upstream/main   # must print 0
```

Bump `version` in `package.json` to `<upstream pstack version>-pi.<n>` when the upstream version changes. A git-installed copy picks up the update with `pi update`; a local-path install picks it up on the next session. Running sessions keep the skills they started with.

## Testing without touching the real Pi config

`/loop` needs an interactive session, so drive the TUI in tmux (`tmux new-session -d ... "PI_CODING_AGENT_DIR=$T pi --no-session"`, then `send-keys` and `capture-pane`). Everything else can use `pi -p`.

Use a throwaway Pi home. Pi here authenticates through the AI Gateway, so no credentials are copied.

```sh
T=$(mktemp -d /tmp/pi-pstack-test.XXXX)
cp ~/.pi/agent/{models.json,models-store.json,meta-model-catalog*.json,meta-muse-model-catalog.json} "$T"/
# settings.json: defaultProvider/defaultModel/enabledModels from the real one, plus
# "packages": [<real npm dir>/@tintinweb/pi-subagents, .../@tintinweb/pi-tasks, .../pi-ask-user, "~/local/cursor-plugins"]
PI_CODING_AGENT_DIR=$T pi -p --no-session "/skill:how ..."
```

## Switching the real Pi config from Compound Engineering to pstack, and back

Switch (back up first):

```sh
cp ~/.pi/agent/settings.json ~/.pi/agent/settings.json.pre-pstack
cp ~/.multimango/worktrees/AGENTS.md ~/.multimango/worktrees/AGENTS.md.pre-pstack
pi remove git:github.com/EveryInc/compound-engineering-plugin
pi install ~/local/cursor-plugins          # or git:github.com/ijustworkhere1234/plugins@main
# then delete the "BEGIN/END COMPOUND PI TOOL MAP" block in ~/.multimango/worktrees/AGENTS.md
```

Back to Compound Engineering:

```sh
cp ~/.pi/agent/settings.json.pre-pstack ~/.pi/agent/settings.json
cp ~/.multimango/worktrees/AGENTS.md.pre-pstack ~/.multimango/worktrees/AGENTS.md
```

Restart Pi sessions after either direction.

## Pitfalls

- Agent frontmatter is YAML. Quote a `description` that contains `: `, or pi-subagents silently skips the agent.
- An agent's `tools:` limits only built-in tools. Extension tools (pi-tasks, pi-goal, loop_*) still load, so `pstack-readonly` denies the state-changing ones with `disallowed_tools`.

- Upstream regenerates `harness/pstack/` (the Claude Code tree) in its CI. Never edit it; ours is `harness/pstack-pi/`.
- After every rebase, check `git diff --stat upstream/main` and understand every file in it.
- 55 of the 56 skills are `disable-model-invocation: true` upstream, so only `setup-pstack` appears in the model's skill list. That is intended: invoke them with `/skill:<name>`, mainly `/skill:poteto-mode`, which routes to the rest.
- `poteto-agent` is pinned to background in its frontmatter, so a caller's `run_in_background: false` is ignored. That matches upstream's `is_background: true`.
- Package agents rank below `~/.pi/agent/agents/` and `.pi/agents/`; a same-named local file shadows ours.
