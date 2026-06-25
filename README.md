<div align="center">

# 🌐 internationalization

**Filesystem-driven i18n for TypeScript.**

Your folder structure becomes a fully typed, statically-generated translation object — with zero runtime overhead.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

</div>

---

## Why?

Most i18n libraries force you into JSON files, key-based lookups, and runtime overhead.
**internationalization** takes a different approach:

- 📂 **Folders are namespaces** — your file tree _is_ your translation structure
- 🔒 **Fully typed** — generated TypeScript gives you autocomplete and compile-time safety
- ⚡ **Zero runtime** — translations are inlined at build time, no lookups or parsing
- 🔄 **Placeholder interpolation** — `"Hello {name}"` becomes a typed function automatically
- 👀 **Watch mode** — regenerates instantly on every file change during development

---

## Installation

```bash
pnpm add internationalization
```

> **Peer dependency:** `esbuild` is required for loading `.ts` leaf files at generation time.

---

## Quick Start

### 1. Create your translation folders

```
translations/
├── en/
│   └── homepage/
│       └── hero/
│           └── t.ts
└── pt/
    └── homepage/
        └── hero/
            └── t.ts
```

Each `t.ts` file exports a plain object:

```ts
// translations/en/homepage/hero/t.ts
export const t = {
  title: "Hello {name}",
  subtitle: "Welcome to our platform",
} as const;
```

```ts
// translations/pt/homepage/hero/t.ts
export const t = {
  title: "Olá {name}",
  subtitle: "Bem-vindo à nossa plataforma",
} as const;
```

### 2. Generate

```bash
npx i18n-gen
```

This scans `translations/` and generates a fully typed module:

```ts
// src/i18n/generated.ts  (auto-generated — do not edit)

export const t = {
  en: {
    homepage: {
      hero: {
        title: (v: { name: string }) => `Hello ${v.name}`,
        subtitle: "Welcome to our platform",
      },
    },
  },
  pt: {
    homepage: {
      hero: {
        title: (v: { name: string }) => `Olá ${v.name}`,
        subtitle: "Bem-vindo à nossa plataforma",
      },
    },
  },
} as const;

export type Locale = keyof typeof t; // "en" | "pt"
```

Strings with `{token}` placeholders become typed arrow functions. Plain strings stay as literals.

### 3. Use it

```ts
import { t } from "./i18n/generated";

t.en.homepage.hero.title({ name: "World" }); // "Hello World"
t.pt.homepage.hero.title({ name: "Mundo" }); // "Olá Mundo"
t.en.homepage.hero.subtitle;                  // "Welcome to our platform"
```

Dynamic locale:

```ts
import { t, type Locale } from "./i18n/generated";

const locale: Locale = "pt";

t[locale].homepage.hero.title({ name: "Mundo" }); // "Olá Mundo"
```

---

## Development — Watch Mode

During development, run the watcher alongside your dev server. It watches your `translations/` folder and **regenerates `generated.ts` instantly** on every file change — new translations, edits, deleted files, new folders, everything.

```json
{
  "scripts": {
    "dev": "concurrently 'i18n-gen --watch' 'next dev'",
    "i18n:watch": "i18n-gen --watch"
  }
}
```

```bash
pnpm i18n:watch
# [i18n] generated src/i18n/generated.ts -> en, pt
# [i18n] watching translations/ ...
```

Edit a translation → save → the generated file updates → your dev server picks up the change via HMR. No restarts, no manual steps.

> **Tip:** Use [`concurrently`](https://www.npmjs.com/package/concurrently) to run the watcher and dev server in parallel.

---

## Production — Build

For production, run generation **before** your build step. This ensures `generated.ts` is up-to-date when your bundler compiles the app.

```json
{
  "scripts": {
    "build": "i18n-gen && next build"
  }
}
```

```bash
pnpm build
# [i18n] generated src/i18n/generated.ts -> en, pt, es
# ▲ Next.js 15.x
# ✓ Compiled successfully
```

That's it. The generated file is a plain `.ts` module — your bundler (Next.js, Vite, whatever) handles it like any other source file. No plugins, no loaders, no special config.

---

## Configuration

Create an optional `i18n.config.ts` at your project root:

```ts
import { defineConfig } from "internationalization";

export default defineConfig({
  root: "./translations",        // where your locale folders live
  defaultLocale: "en",           // canonical locale
  locales: ["en", "pt", "es"],   // explicit allow-list (optional)
  out: "./src/i18n/generated.ts" // output path
});
```

All fields are optional — sensible defaults are applied:

| Option          | Default                      | Description                                    |
|-----------------|------------------------------|------------------------------------------------|
| `root`          | `"./translations"`           | Directory containing locale folders            |
| `defaultLocale` | `"en"`                       | The canonical locale                            |
| `locales`       | _auto-detected from folders_ | Explicit locale allow-list                      |
| `out`           | `"./src/i18n/generated.ts"`  | Output path for the generated module            |

---

## Usage with Next.js

### Project structure

```
my-app/
├── translations/
│   ├── en/
│   │   ├── common/
│   │   │   └── t.ts
│   │   └── homepage/
│   │       └── hero/
│   │           └── t.ts
│   └── pt/
│       ├── common/
│       │   └── t.ts
│       └── homepage/
│           └── hero/
│               └── t.ts
├── src/
│   ├── i18n/
│   │   ├── generated.ts       ← auto-generated
│   │   └── context.tsx         ← locale provider
│   └── app/
│       └── [locale]/
│           ├── layout.tsx
│           └── page.tsx
├── i18n.config.ts
└── package.json
```

### Locale context

A thin context that shares the locale string — components import `t` directly:

```tsx
// src/i18n/context.tsx
"use client";

import { createContext, useContext } from "react";
import { type Locale } from "./generated";

const LocaleContext = createContext<Locale | null>(null);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  const locale = useContext(LocaleContext);
  if (!locale) throw new Error("useLocale must be used within <LocaleProvider>");
  return locale;
}
```

### Layout

```tsx
// src/app/[locale]/layout.tsx
import { type Locale, t } from "@/i18n/generated";
import { LocaleProvider } from "@/i18n/context";

export function generateStaticParams() {
  return (Object.keys(t) as Locale[]).map((locale) => ({ locale }));
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: Locale };
}) {
  return (
    <html lang={params.locale}>
      <body>
        <LocaleProvider locale={params.locale}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
```

### Server Component

```tsx
// src/app/[locale]/page.tsx
import { type Locale, t } from "@/i18n/generated";

export default function HomePage({ params }: { params: { locale: Locale } }) {
  return (
    <section>
      <h1>{t[params.locale].homepage.hero.title({ name: "World" })}</h1>
      <p>{t[params.locale].homepage.hero.subtitle}</p>
    </section>
  );
}
```

### Client Component

```tsx
// src/components/Navbar.tsx
"use client";

import Link from "next/link";
import { t } from "@/i18n/generated";
import { useLocale } from "@/i18n/context";

export function Navbar() {
  const locale = useLocale();

  return (
    <nav>
      <Link href="/">{t[locale].common.nav.home}</Link>
      <Link href="/about">{t[locale].common.nav.about}</Link>
      <Link href="/contact">{t[locale].common.nav.contact}</Link>
    </nav>
  );
}
```

### Scripts

```json
{
  "scripts": {
    "dev": "concurrently 'i18n-gen --watch' 'next dev'",
    "build": "i18n-gen && next build"
  }
}
```

---

## How It Works

```
translations/           ← you write these
├── en/
│   └── homepage/
│       └── hero/
│           └── t.ts    ← export const t = { title: "Hello {name}" }
└── pt/
    └── ...

      ↓  i18n-gen

src/i18n/generated.ts   ← fully typed, auto-generated
```

1. **Scan** — walks `translations/` collecting every `t.ts` file
2. **Load** — evaluates each leaf via `esbuild`
3. **Emit** — generates a single TypeScript module with typed interpolation

The result is a plain `.ts` file. Your bundler handles the rest.

---

## License

[ISC](LICENSE)
