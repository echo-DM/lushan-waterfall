# Repository Guidelines

## Project Structure & Module Organization

`lushan-waterfall/` is an independent Git repository for a planned interactive world inspired by Li Bai’s 《望庐山瀑布》. It currently contains no application source, package manifest, tests, or assets. The scene concept includes sunlit peaks, purple mist, a cliff waterfall, and a deep pool, with distant and upward-looking camera views; see `../poems-list.md`.

When scaffolding, follow the neighboring apps: keep source in `src/`, static assets in `public/`, and acceptance notes and screenshots in `docs/`. Keep poem text and camera presets separate from scene generation. Reserve `dist/` for generated production output.

## Build, Test, and Development Commands

Run commands from this directory. Use `pnpm` for Node dependencies and scripts. No runnable scripts exist yet; define and document them in `package.json` when initializing the app. Suggested scripts matching the surrounding projects are:

- `pnpm install`: install declared dependencies.
- `pnpm dev`: start the development server.
- `pnpm build`: check TypeScript and build production assets.
- `pnpm preview --port 4173`: serve the production build for review.

Use `uv` for Python tooling if introduced. For Haskell, use GHC installed through GHCup and Cabal for dependencies, builds, tests, and the REPL.

## Coding Style & Naming Conventions

For a TypeScript implementation, follow the parent guide: strict typing, ES modules, two-space indentation, and semicolons. Use camelCase for functions and variables and PascalCase for types and components. Choose descriptive camera and scene IDs. No formatter or linter is configured yet.

## Testing Guidelines

No test framework or coverage threshold exists. Once runnable, verify the production build and browser behavior: camera transitions, interrupted navigation, responsive layout, reduced motion, and console errors. Record browser and device coverage in `docs/`; distinguish simulated mobile checks from physical-device tests. Document any automated test command when adding it.

## Commit & Pull Request Guidelines

This repository has no commit history yet. Adopt the parent guide’s Conventional Commits, such as `feat: add waterfall scene` or `docs: describe camera controls`. Keep commits focused. PRs should explain behavior changes, link applicable issues, report validation, and include screenshots for visual changes. Exclude generated output and dependency directories from version control.
