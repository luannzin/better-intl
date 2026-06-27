import { watch as chokidarWatch } from "chokidar";
import { basename } from "pathe";
import { LEAF_FILENAME } from "../scanner/walk.js";
import type { I18nConfig } from "../types.js";
import { runGenerate } from "./generate.js";

export { runGenerate };

/** Coalesce bursts (a rename fires unlink+add) into one regen. */
const DEBOUNCE_MS = 75;

/** True only for an actual `t.ts` leaf — not `list.ts`, `component.ts`, etc. */
function isLeaf(path: string): boolean {
	return basename(path) === LEAF_FILENAME;
}

/**
 * Watch the scan root and regenerate when a `t.ts` leaf changes. Used by the
 * dev server (`i18n-gen --watch` and the Next plugin). Returns a disposer that
 * stops the watcher.
 */
export async function watch(config: I18nConfig): Promise<() => Promise<void>> {
	const regen = async (reason: string) => {
		try {
			const locales = await runGenerate(config);
			console.log(`[i18n] regenerated (${reason}) -> ${locales.join(", ")}`);
		} catch (err) {
			console.error(`[i18n] generation failed: ${(err as Error).message}`);
		}
	};

	await regen("initial");

	let timer: ReturnType<typeof setTimeout> | undefined;
	let reason = "";
	const schedule = (event: string, path: string) => {
		if (!isLeaf(path)) return; // ignore every non-leaf file event
		reason = `${event} ${path}`;
		clearTimeout(timer);
		timer = setTimeout(() => regen(reason), DEBOUNCE_MS);
	};

	// Leaf add/unlink already covers new/removed feature folders (chokidar emits
	// file events for them), so directory events need no separate handler.
	const watcher = chokidarWatch(config.root, {
		ignoreInitial: true,
		ignored: (path) => path.endsWith("~"),
	});

	watcher
		.on("add", (p) => schedule("add", p))
		.on("change", (p) => schedule("change", p))
		.on("unlink", (p) => schedule("remove", p));

	return async () => {
		clearTimeout(timer);
		await watcher.close();
	};
}
