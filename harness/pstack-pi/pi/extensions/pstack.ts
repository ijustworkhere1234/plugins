// pi-pstack: tells every Pi session where pstack lives, points it at the Pi adapter,
// carries the user's per-role model choices (the Pi version of pstack-models.mdc),
// and provides /loop, the Pi version of Cursor's built-in /loop command.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PSTACK = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODELS = join(process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent"), "pstack-models.md");
const INTERVAL = /^(\d+)(s|m|h|d)$/;
const UNIT_MS = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;
const MIN_DELAY_MS = 10_000;
const TICK_MARKER = "[/loop tick";

function parseDelay(text: string): number | undefined {
	const match = INTERVAL.exec(text.trim());
	if (!match) return undefined;
	const ms = Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS];
	return ms >= MIN_DELAY_MS ? ms : undefined;
}

// `/loop 5m <prompt>`, `/loop <prompt> every 5m`, or `/loop <prompt>` (dynamic: the agent picks each delay).
function parseLoop(args: string): { intervalMs?: number; prompt: string } {
	const words = args.trim().split(/\s+/);
	const leading = parseDelay(words[0] ?? "");
	if (leading) return { intervalMs: leading, prompt: words.slice(1).join(" ") };
	const trailing = /^(.*?)\s+every\s+(\d+[smhd])$/i.exec(args.trim());
	const intervalMs = trailing ? parseDelay(trailing[2]) : undefined;
	if (trailing && intervalMs) return { intervalMs, prompt: trailing[1] };
	return { prompt: args.trim() };
}

type Loop = { prompt: string; intervalMs?: number; tick: number; timer?: ReturnType<typeof setTimeout>; queued: boolean };

export default function pstack(pi: ExtensionAPI) {
	let loop: Loop | undefined;
	// Tracked from lifecycle events so timers and tools need no context object.
	let busy = false;

	const stop = () => {
		if (loop?.timer) clearTimeout(loop.timer);
		loop = undefined;
	};

	const fire = () => {
		if (!loop) return;
		loop.timer = undefined;
		// The previous tick has not run yet. Try again later instead of stacking ticks.
		if (loop.queued) return schedule(loop.intervalMs ?? MIN_DELAY_MS);
		loop.tick += 1;
		loop.queued = true;
		const how = loop.intervalMs
			? `This loop repeats every ${Math.round(loop.intervalMs / 1000)}s.`
			: "This loop is dynamic: call loop_next with the delay before your next wake, or the loop ends after this turn.";
		const text = `${TICK_MARKER} ${loop.tick}] ${loop.prompt}\n\n${how} Call loop_stop when the prompt's stop condition is met.`;
		if (!busy) pi.sendUserMessage(text);
		else pi.sendUserMessage(text, { deliverAs: "followUp" });
		if (loop.intervalMs) schedule(loop.intervalMs);
	};

	const schedule = (ms?: number) => {
		if (!loop || ms === undefined) return;
		if (loop.timer) clearTimeout(loop.timer);
		loop.timer = setTimeout(fire, ms);
	};

	pi.registerCommand("loop", {
		description: "Re-send a prompt to this session on an interval. /loop [30s|5m|2h|1d] <prompt> | /loop <prompt> every 5m | /loop <prompt> (agent picks each delay) | /loop stop | /loop status",
		handler: async (args, ctx) => {
			const text = args.trim();
			if (text === "stop") {
				ctx.ui.notify(loop ? `Loop stopped after ${loop.tick} tick(s).` : "No loop is running.", "info");
				return stop();
			}
			if (text === "" || text === "status") {
				ctx.ui.notify(
					loop
						? `Loop: tick ${loop.tick}, ${loop.intervalMs ? `every ${loop.intervalMs / 1000}s` : "dynamic"}: ${loop.prompt}`
						: "No loop is running. Usage: /loop [interval] <prompt>",
					"info",
				);
				return;
			}
			const parsed = parseLoop(text);
			if (!parsed.prompt) return ctx.ui.notify("Usage: /loop [interval] <prompt>. Intervals are 10s or more, like 30s, 5m, 2h, 1d.", "warning");
			ctx.ui.notify(arm(parsed), "info");
			fire();
		},
	});

	const arm = (parsed: { intervalMs?: number; prompt: string }) => {
		stop();
		loop = { ...parsed, tick: 0, queued: false };
		return parsed.intervalMs ? `Loop armed every ${parsed.intervalMs / 1000}s. /loop stop to end.` : "Dynamic loop armed. /loop stop to end.";
	};

	// The agent arms a loop itself when a pstack step says to arm `/loop`, since Pi slash commands are user-typed.
	pi.registerTool(
		defineTool({
			name: "loop_start",
			description:
				"Arm a /loop: re-send `prompt` to this session as a new user turn, every `interval` (like 5m, 1h; 10s minimum), or with no interval as a dynamic loop where you call loop_next to pick each delay. Replaces any running loop. The first tick runs after `interval`, or after the current turn for a dynamic loop.",
			label: "Loop start",
			parameters: Type.Object({
				prompt: Type.String({ description: "The tick prompt, including its stop condition" }),
				interval: Type.Optional(Type.String({ description: "Fixed interval such as 1h. Omit for a dynamic loop." })),
			}),
			async execute(_id, params) {
				const intervalMs = params.interval ? parseDelay(params.interval) : undefined;
				const reply = (text: string) => ({ content: [{ type: "text" as const, text }], details: {} });
				if (params.interval && !intervalMs) return reply("Invalid interval. Use 10s or more, like 30s, 5m, 2h, 1d.");
				const armed = arm({ intervalMs, prompt: params.prompt });
				if (intervalMs) schedule(intervalMs);
				else fire();
				return reply(armed);
			},
		}),
	);

	pi.registerTool(
		defineTool({
			name: "loop_next",
			label: "Loop next",
			description: "In a dynamic /loop (started without an interval), schedule the next wake of this session. Delay like 30s, 5m, 2h, 1d (10s minimum).",
			parameters: Type.Object({ delay: Type.String({ description: "Delay before the next tick, such as 5m" }) }),
			async execute(_id, params) {
				const ms = parseDelay(params.delay);
				const reply = (text: string) => ({ content: [{ type: "text" as const, text }], details: {} });
				if (!loop) return reply("No /loop is running.");
				if (loop.intervalMs) return reply("This loop has a fixed interval. Its next tick is already scheduled.");
				if (!ms) return reply("Invalid delay. Use 10s or more, like 30s, 5m, 2h, 1d.");
				schedule(ms);
				return reply(`Next tick in ${params.delay}.`);
			},
		}),
	);

	pi.registerTool(
		defineTool({
			name: "loop_stop",
			label: "Loop stop",
			description: "Stop the running /loop when its stop condition is met.",
			parameters: Type.Object({ reason: Type.String({ description: "Why the loop is done, with the evidence" }) }),
			async execute(_id, params) {
				const running = loop;
				stop();
				return { content: [{ type: "text" as const, text: running ? `Loop stopped after ${running.tick} tick(s): ${params.reason}` : "No /loop is running." }], details: {} };
			},
		}),
	);

	pi.on("before_agent_start", async (event) => {
		if (loop && typeof event.prompt === "string" && event.prompt.startsWith(TICK_MARKER)) loop.queued = false;
		const lines = [
			"## pstack",
			"",
			`pstack is installed. \`<pstack>\` is \`${PSTACK}\`. Before you follow a pstack skill, read \`${PSTACK}/docs/harness/pi.md\` once per session. It maps the Cursor names in pstack skills to Pi.`,
		];
		const models = existsSync(MODELS) ? readFileSync(MODELS, "utf8").trim() : "";
		if (models) lines.push("", `pstack model roles, from \`${MODELS}\`:`, "", models);
		return { systemPrompt: `${event.systemPrompt}\n\n${lines.join("\n")}\n` };
	});

	pi.on("agent_start", async () => {
		busy = true;
	});

	// agent_settled means Pi will not continue on its own. A dynamic loop ends here when its tick
	// finished without loop_next arming the next wake.
	// A settled agent has consumed any queued tick, including one delivered as a follow-up inside a run.
	pi.on("agent_settled", async () => {
		busy = false;
		if (!loop) return;
		loop.queued = false;
		if (!loop.intervalMs && !loop.timer) stop();
	});

	pi.on("session_shutdown", async () => stop());
}
