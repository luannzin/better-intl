import { stat } from "node:fs/promises";
import { bundleRequire } from "bundle-require";
import type { TranslationTree } from "../types.js";

/**
 * Memoised leaf values, keyed by absolute path. Evaluating a leaf runs it
 * through esbuild (bundle-require), which is by far the most expensive step in a
 * generation pass — so on the watch path we skip it for files whose mtime hasn't
 * changed. The cache is a process-level singleton: it warms across `watch()`
 * regenerations and is simply cold (then discarded) for one-shot CLI/build runs.
 */
const cache = new Map<
	string,
	{ mtimeMs: number; size: number; value: TranslationTree }
>();

/**
 * Load a `t.ts` leaf at generation time and return its authored translation
 * tree (nested groups whose leaves are locale maps).
 *
 * Accepts either `export const t = {...}` or `export default {...}`. Reuses the
 * cached value when the file's mtime is unchanged, so a regen only re-evaluates
 * the leaves that actually changed.
 */
export async function loadLeaf(file: string): Promise<TranslationTree> {
	const { mtimeMs, size } = await stat(file);
	const cached = cache.get(file);
	if (cached && cached.mtimeMs === mtimeMs && cached.size === size) {
		return cached.value;
	}

	const { mod } = await bundleRequire({ filepath: file });
	const value = mod.t ?? mod.default;

	if (value == null || typeof value !== "object") {
		throw new Error(
			`Leaf "${file}" must export \`t\` or a default object. Got: ${typeof value}`,
		);
	}

	cache.set(file, { mtimeMs, size, value: value as TranslationTree });
	return value as TranslationTree;
}

/** Drop cache entries for files no longer present (called after a scan). */
export function pruneLeafCache(liveFiles: Iterable<string>): void {
	const live = liveFiles instanceof Set ? liveFiles : new Set(liveFiles);
	for (const file of cache.keys()) {
		if (!live.has(file)) cache.delete(file);
	}
}
