import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "pathe";

export const LEAF_FILENAME = "t.ts";

/**
 * Directories that never contain authored leaves but are expensive to descend.
 * Skipping them keeps `walk` cheap even if `root` is pointed at a project root.
 */
const IGNORED_DIRS = new Set([
	"node_modules",
	".next",
	".git",
	"dist",
	".turbo",
	".vercel",
]);

/**
 * Recursively walk `dir` and collect absolute paths to every `t.ts` leaf file.
 * Sibling directories are traversed in parallel; heavy build/vendor folders are
 * skipped. Leaf order does not affect output (the tree is keyed by path and
 * emitted in sorted order), so no post-sort is needed.
 */
export async function walk(dir: string): Promise<string[]> {
	let entries: Dirent[];
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		// Missing directory -> no leaves. Caller validates root existence.
		return [];
	}

	const leaves: string[] = [];
	const subdirs: Promise<string[]>[] = [];

	for (const entry of entries) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (!IGNORED_DIRS.has(entry.name)) subdirs.push(walk(full));
		} else if (entry.isFile() && entry.name === LEAF_FILENAME) {
			leaves.push(full);
		}
	}

	for (const found of await Promise.all(subdirs)) leaves.push(...found);
	return leaves;
}
