#!/usr/bin/env node
/**
 * scripts/check-use-client.js
 *
 * CI guard. Fails the build if a `page.tsx` in a route group starts
 * with `"use client"` but uses no client-side features. This is the
 * pattern that caused the Vercel ENOENT error on
 * `app/(marketing)/page_client-reference-manifest.js` after the
 * Next.js 15.5 upgrade.
 *
 *   $ node scripts/check-use-client.js
 *   $ exit 0 = ok
 *   $ exit 1 = found bad pages
 *
 * Add to package.json:
 *   "scripts": { "prebuild": "node scripts/check-use-client.js" }
 */
const fs = require("node:fs")
const path = require("node:path")

const ROOT = process.cwd()
const APP_DIR = path.join(ROOT, "app")
const RE_EXCLUDE = /(node_modules|\.next|out|build)/

const CLIENT_FEATURE = /\b(useState|useEffect|useReducer|useContext|useRef|useMemo|useCallback|useLayoutEffect|useImperativeHandle|useDebugValue|useTransition|useDeferredValue|useId|useSyncExternalStore|useInsertionEffect|useSearchParams|usePathname|useRouter|useSelectedLayoutSegment|useSelectedLayoutSegments|useParams|useFormStatus|useFormState|useActionState|onClick|onChange|onSubmit|onFocus|onBlur|onMouseEnter|onMouseLeave|onKeyDown|onKeyUp|onPointerDown|onPointerUp|onTouchStart|onTouchEnd|addEventListener|new EventSource|new WebSocket|setInterval|setTimeout|requestAnimationFrame|cancelAnimationFrame)\b/

function* walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (RE_EXCLUDE.test(name)) continue
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) yield* walk(full)
    else if (name === "page.tsx" || name === "page.jsx" || name === "page.js") yield full
  }
}

let bad = 0
if (!fs.existsSync(APP_DIR)) {
  console.log("No app/ directory — skipping.")
  process.exit(0)
}

for (const file of walk(APP_DIR)) {
  const text = fs.readFileSync(file, "utf8")
  const firstLines = text.split("\n").slice(0, 5).join("\n")
  if (!/^"use client"|^'use client'/.test(firstLines.trim())) continue
  // Client page — make sure it actually has client features
  if (!CLIENT_FEATURE.test(text)) {
    bad++
    console.error(`\n  ✗ ${path.relative(ROOT, file)}`)
    console.error(`      declares "use client" but has no client features.`)
    console.error(`      Next.js 15.5 will fail the Vercel build with`)
    console.error(`      "ENOENT: ... page_client-reference-manifest.js".`)
    console.error(`      Fix: remove "use client" from the top of this file.\n`)
  }
}

if (bad > 0) {
  console.error(`[check-use-client] ${bad} bad page${bad === 1 ? "" : "s"} found.`)
  process.exit(1)
}
console.log("[check-use-client] OK — every client page actually needs to be client.")
