<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Agent Quick Start

- **Project type:** Next.js (App Router), TypeScript, Tailwind CSS.
- **Important files:** `app/layout.tsx`, `app/page.tsx`, `app/globals.css` (global styles).
- **Primary package scripts:**
	- `npm run dev` — start dev server
	- `npm run build` — build for production
	- `npm start` — start production server
	- `npm run lint` — run ESLint
- **Install:** run `npm install` (or your preferred package manager).

## Guidance for AI coding agents

- **Link, don't copy:** Refer to [README.md](README.md) and `package.json` for commands and deployment notes instead of duplicating them.
- **Follow conventions:** This project uses the Next.js app directory and TypeScript. Prefer edits in `app/` and keep types consistent with existing patterns.
- **Check build locally:** Run `npm run build` and `npm run dev` to validate changes before proposing edits that affect runtime behavior.
- **Lint and formatting:** Run `npm run lint` when adding code. Respect existing ESLint rules from `eslint-config-next`.
- **No tests present:** There are no project tests declared in `package.json`; avoid proposing test runs unless you add test scaffolding.

## Where to look for more context

- Project README: [README.md](README.md)
- Package manifest: [package.json](package.json)
- Next.js docs (local): `node_modules/next/dist/docs/`

If you want, I can create a small `.github/copilot-instructions.md` derived from this content or add focused agent instructions for frontend tasks.
