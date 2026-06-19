# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

This repository is a fresh scaffold with no application code yet. As of this writing it contains only:

- `README.md` — placeholder (`# Stash`)
- `.gitignore` — the standard GitHub **Node** ignore template
- `LICENSE` — MIT

There is no `package.json`, build system, test runner, or source tree. Consequently there are no project-specific build, lint, or test commands to document yet.

## For the first real change

The `.gitignore` is the Node template (ignores `node_modules/`, `dist`, `.env`, npm/yarn/pnpm artifacts, Vite/Next/Nuxt/SvelteKit output, etc.), which signals this is intended as a JavaScript/TypeScript project. When you scaffold it, expect a Node toolchain (npm/yarn/pnpm + a bundler/framework).

When real code, tooling, and architecture exist, **replace this file** with concrete guidance: the actual build/lint/test commands (including how to run a single test), and the big-picture architecture that spans multiple files.
