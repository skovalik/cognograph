# Cognograph Public Repo — Sync Rules

**This file exists because a previous sync violated the sanitization protocol and exposed patent filings, security audits, and internal strategy on a public GitHub repo.**

## NEVER commit these files

- `PATENTS`, `DECISIONS.md`, `FEATURES.md`, `SECURITY.md`, `CHANGELOG.md`, `NORTH_STAR.md`
- `docs/archive/`, `docs/bugs/`, `docs/design/`, `docs/notes/`, `docs/plans/`, `docs/strategy/`, `docs/specs/`
- `docs/guides/PATENT_FILING_GUIDE.md`, `docs/guides/CODE_SIGNING_SETUP.md`, `docs/guides/RELEASE_PROCESS.md`, `docs/guides/SYNC_PROTOCOL.md`, `docs/guides/diagnostic-server.md`
- `docs/qa/*` except `TESTING_CHECKLIST.md`
- `src/web/` (entire directory: auth, billing, landing, Supabase client)
- `public/sitemap.xml`, `public/llms.txt`
- Any file containing patent application numbers, USPTO filing details, or personal paths

## ALLOWED docs

- `docs/guides/PITFALLS.md`
- `docs/guides/Multi-Agent-Coordination.md`
- `docs/qa/TESTING_CHECKLIST.md`

## Before any sync from cognograph_02

1. Check this file
2. Run `scripts/sanitization-check.sh`
3. Review `git diff --staged` for patent numbers, personal paths, internal docs
4. The `.gitignore` blocks the worst paths but is not a substitute for checking

## Before any commit

Run: `bash scripts/sanitization-check.sh`

If it returns nonzero, DO NOT COMMIT. Fix the issues first.
