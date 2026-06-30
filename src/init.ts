import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "pathe";
import { runGenerate } from "./codegen/run.js";
import { defineConfig } from "./config.js";
import { loadUserConfig } from "./loadConfig.js";

/** `intl.config.ts` written to the project root on `init`. */
const CONFIG_TEMPLATE = `import type { I18nUserConfig } from "better-intl"

export default {
	// Directory scanned for colocated \`t.ts\` files.
	root: "./src",

	// Where the generated module is written.
	out: "./src/i18n/generated.ts",

	// Canonical locale + ultimate fallback.
	defaultLocale: "en",
	locales: ["en", "pt"],

	// "error" | "warn" | "silent" — behaviour when a key misses a locale.
	onMissing: "warn",

	// Where the active locale preference is persisted (cookie is the only store).
	storage: { type: "cookie", key: "locale" },
} satisfies I18nUserConfig
`;

/** Write `file` with `content` unless it already exists. Returns what happened. */
async function writeIfAbsent(
	file: string,
	content: string,
): Promise<"created" | "skipped"> {
	if (existsSync(file)) return "skipped";
	await mkdir(dirname(file), { recursive: true });
	await writeFile(file, content, "utf8");
	return "created";
}

function log(action: "created" | "skipped", rel: string): void {
	const tag = action === "created" ? "+" : "=";
	const note = action === "skipped" ? " (already exists, left as-is)" : "";
	console.log(`[i18n] ${tag} ${rel}${note}`);
}

/**
 * Scaffold a fresh better-intl setup in the current project: write
 * `intl.config.ts`, ensure the scan root exists, generate from any existing
 * `t.ts` leaves, then print the remaining manual wiring (Next plugin + layout).
 * Idempotent — any file that already exists is left untouched, and the generate
 * is skipped (not failed) when there are no leaves yet.
 */
export async function runInit(): Promise<void> {
	const cwd = process.cwd();
	const rel = (p: string) => resolve(p).replace(`${cwd}/`, "");

	const configPath = resolve(cwd, "intl.config.ts");
	log(await writeIfAbsent(configPath, CONFIG_TEMPLATE), "intl.config.ts");

	const config = defineConfig(await loadUserConfig());
	await mkdir(config.root, { recursive: true });

	try {
		const locales = await runGenerate(config);
		console.log(`[i18n] + ${rel(config.out)} -> ${locales.join(", ")}`);
	} catch (err) {
		// No `t.ts` leaves yet — that's expected on a brand-new project, not a
		// failure. Anything else is a real error worth surfacing.
		if (!/No t\.ts files found/.test((err as Error).message)) throw err;
		console.log(`[i18n] no t.ts files yet — add one, then run \`better-intl\``);
	}

	printNextSteps(rel(config.root));
}

function printNextSteps(root: string): void {
	console.log(`
[i18n] Setup ready. Next:

1. Author translations in a colocated t.ts, e.g. ${root}/homepage/t.ts:

   export default {
     title: { en: "Hello {name}", pt: "Olá {name}" },
   }

2. Wrap your Next config:

   // next.config.ts
   import { withInternationalization } from "better-intl/next"
   export default withInternationalization({ /* your config */ })

3. Fill the locale once per request in the root layout:

   // app/layout.tsx
   import { Suspense } from "react"
   import { setLocale } from "@/i18n/generated"

   async function Localized({ children }) {
     await setLocale()
     return children
   }

   export default function RootLayout({ children }) {
     return <html><body><Suspense>{<Localized>{children}</Localized>}</Suspense></body></html>
   }

Then import { t } from "@/i18n/generated" anywhere — sync on client and server.
`);
}
