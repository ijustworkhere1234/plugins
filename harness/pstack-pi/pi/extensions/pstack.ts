// pi-pstack: tells every Pi session where pstack lives, points it at the Pi adapter,
// and carries the user's per-role model choices (the Pi version of pstack-models.mdc).
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PSTACK = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODELS = join(process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent"), "pstack-models.md");

export default function pstack(pi: ExtensionAPI) {
	pi.on("before_agent_start", async (event) => {
		const lines = [
			"## pstack",
			"",
			`pstack is installed. \`<pstack>\` is \`${PSTACK}\`. Before you follow a pstack skill, read \`${PSTACK}/docs/harness/pi.md\` once per session. It maps the Cursor names in pstack skills to Pi.`,
		];
		const models = existsSync(MODELS) ? readFileSync(MODELS, "utf8").trim() : "";
		if (models) lines.push("", `pstack model roles, from \`${MODELS}\`:`, "", models);
		return { systemPrompt: `${event.systemPrompt}\n\n${lines.join("\n")}\n` };
	});
}
