import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "pathe";
import { buildTree } from "../scanner/buildTree.js";
import { walk } from "../scanner/walk.js";
import type { I18nConfig, Leaf, TreeNode } from "../types.js";
import { emit } from "./emit.js";
import { loadLeaf, pruneLeafCache } from "./loadLeaf.js";
import { transpose } from "./transpose.js";

/** Scan, load leaves, and build the in-memory feature tree (no file written). */
async function scan(config: I18nConfig): Promise<TreeNode> {
	const files = await walk(config.root);
	if (files.length === 0) {
		throw new Error(
			`No t.ts files found under "${config.root}". Check the \`root\` config.`,
		);
	}

	pruneLeafCache(files);

	const leaves: Leaf[] = await Promise.all(
		files.map(async (file) => ({ file, value: await loadLeaf(file) })),
	);

	return buildTree(config.root, leaves);
}

/**
 * Run a single generation pass: scan -> transpose -> emit -> write `config.out`.
 * The write is skipped when the output is byte-identical to what's already on
 * disk, so an unrelated save (or a change that doesn't alter output) doesn't
 * touch the file and needlessly trip Next's file watcher into an HMR cycle.
 * Returns the discovered locales for logging.
 */
export async function runGenerate(config: I18nConfig): Promise<string[]> {
	const tree = await scan(config);
	const resolved = transpose(tree, config);
	const source = emit(resolved, config);

	const existing = await readFile(config.out, "utf8").catch(() => null);
	if (existing !== source) {
		await mkdir(dirname(config.out), { recursive: true });
		await writeFile(config.out, source, "utf8");
	}

	return Object.keys(resolved).sort();
}
