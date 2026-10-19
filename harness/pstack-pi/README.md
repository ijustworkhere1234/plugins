# pstack Pi tree

This folder is generated from `pstack/skills`, `pstack/agents`, `pstack/docs/guide`, `pstack/docs/harness/pi.md`, `pstack/README.md`, `pstack/LICENSE`, and `pi/extension.ts`. Do not edit it by hand.

Pi installs it through the root `package.json`. The tree leaves out the rest of `pstack/`, such as `pstack/automations` and `pstack/assets`. A relative link to a pstack file that the tree leaves out points at that file on GitHub `main` instead.

After editing those sources, run `node scripts/generate-pstack-pi-tree.mjs` from the repository root and commit the result. See `FORK.md`.
