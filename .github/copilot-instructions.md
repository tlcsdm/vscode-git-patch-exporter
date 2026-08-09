# Copilot Instructions for VS Code Extension Development

## Repository Overview

This repository is a **VS Code extension** written in **TypeScript** and built with **esbuild**.
The extension focuses on **Git patch export** developer experience — it adds an **Export Patch**
action to the Source Control view so changed files can be exported to a `.patch` file that can be
applied with `git apply`. The patterns and conventions here are broadly reusable across VS Code
extension repositories under the `tlcsdm` organization.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict) |
| Bundler | esbuild (`esbuild.mjs`) |
| Linter | ESLint + typescript-eslint (`eslint.config.mjs`) |
| Test runner | `@vscode/test-cli` + Mocha (`@vscode/test-electron`) |
| Packaging | `@vscode/vsce` |
| CI | GitHub Actions (`.github/workflows/`) |
| Localization | `package.nls.json` + `package.nls.{locale}.json` + `l10n/bundle.l10n*.json` |

---

## Project Layout

```
src/                    TypeScript source files
  extension.ts          Entry point — activate() and deactivate()
  git/                  Git patch export feature modules
  test/                 Mocha test suites (run inside VS Code)
images/                 Extension icons and assets
dist/                   Compiled output (git-ignored)
package.json            Extension manifest and contribution points
package.nls.json        English localization strings
package.nls.zh-cn.json  Simplified Chinese strings
package.nls.ja.json     Japanese strings
l10n/                   Runtime (vscode.l10n) message bundles
esbuild.mjs             Build script
eslint.config.mjs       ESLint configuration
tsconfig.json           TypeScript configuration
.github/workflows/      CI workflows (build, test, publish, release)
.github/skills/         Reusable Copilot skill guides (see below)
```

---

## Coordinated Change Rule

> **Whenever you change extension behavior, update ALL of the following that are affected:**
>
> 1. `src/` — TypeScript implementation
> 2. `package.json` — contribution points (commands, configuration, menus)
> 3. `package.nls.json` — English localization keys/values
> 4. `package.nls.zh-cn.json` and other locale files — translated values
> 5. `l10n/bundle.l10n*.json` — runtime string translations used by `vscode.l10n.t(...)`
> 6. `README.md` — user-facing documentation
> 7. `CHANGELOG.md` — release notes entry
> 8. `src/test/` — unit/integration tests

Failing to keep these in sync is the most common source of bugs and broken releases.

---

## Development Workflows

```bash
# Install dependencies
npm install

# Type-check without emitting (fast feedback)
npm run check-types

# Compile for development
npm run compile

# Watch mode
npm run watch

# Lint
npm run lint

# Run tests (requires a display / VS Code instance)
npm run test

# Production bundle (minified, no source maps)
npm run package

# Package as .vsix
npx @vscode/vsce package
```

---

## Coding Conventions

### TypeScript
- All files use **strict TypeScript** (`tsconfig.json` enforces this).
- Prefer `const` and `readonly`; avoid `any`.
- Use `vscode.ExtensionContext.subscriptions.push(...)` for all disposables registered in `activate()`.
- Never store global mutable state; thread context through function parameters or classes.
- Export only what is needed by other modules; keep internals `private` or unexported.

### Naming
- Commands: `<publisher>.<extensionName>.<verb><Object>` — e.g., `tlcsdm.gitPatchExporter.exportPatch`
- Configuration keys: `<publisher>.<extensionName>.<section>.<key>` — e.g., `tlcsdm.gitPatchExporter.defaultDirectory`
- TypeScript classes: `PascalCase`; functions and variables: `camelCase`

### Error Handling
- Surface errors to users via `vscode.window.showErrorMessage(...)`, not bare `console.error`.
- Use `vscode.window.showWarningMessage(...)` for recoverable issues.
- Catch and handle promise rejections; do not let unhandled rejections crash the extension host.

### Localization
- Every user-facing string in `package.json` must use a `%key%` placeholder.
- The key must exist in `package.nls.json` (English), and a best-effort translation in every other locale file.
- Strings inside TypeScript source use `vscode.l10n.t(...)`; add the English source and translations to `l10n/bundle.l10n*.json`.

### Menus and When-Clauses
- Use the narrowest `when` clause possible for menu contributions.
- Prefer built-in context keys (`scmProvider`, `scmResourceGroup`) over custom context keys where sufficient.
- Place a command in its own menu `group` when it should be visually separated from surrounding actions.

### Child Processes and Security
- When spawning `git`, always pass arguments as an array (never build a shell command string) to avoid injection.
- Never execute untrusted user input as shell commands without validation and escaping.
- Do not write to arbitrary file system paths based on user or workspace input without confirmation.
- Avoid `eval` and dynamic `require` inside the extension bundle.

### Commit Messages and PR Title
- Follow the **Angular commit convention** for all commits.
- Use the format: `<type>(<scope>): <subject>` when a scope is helpful, or `<type>: <subject>` when it is not.
- Prefer common types such as `feat`, `fix`, `docs`, `refactor`, `test`, `build`, `ci`, `style` and `chore`.
- Keep the subject concise, imperative, and lowercase where practical.
- Examples:
  - `feat(patch): add export patch command to the SCM view`
  - `fix(git): handle repositories without an initial commit`
  - `docs(readme): document the export patch workflow`

---

## Extension Activation

- `activationEvents` in `package.json` controls when the extension loads.
- Commands contributed in `package.json` implicitly activate the extension when invoked (VS Code ≥ 1.74).
- Keep `activate()` fast: defer expensive work (file system scans, process spawning) until a command runs.

---

## Skills Reference

Detailed, reusable guides are in `.github/skills/`. Consult them when working on these areas:

| Topic | File |
|---|---|
| Extension architecture & patterns | `.github/skills/vscode-extension-architecture/SKILL.md` |
| `package.json` contribution points | `.github/skills/vscode-package-json-and-contributes/SKILL.md` |
| Commands & activation | `.github/skills/vscode-commands-and-activation/SKILL.md` |
| Language features & providers | `.github/skills/vscode-language-features/SKILL.md` |
| Webviews & native VS Code UI | `.github/skills/vscode-webview-and-ui/SKILL.md` |
| Configuration & settings | `.github/skills/vscode-configuration-and-settings/SKILL.md` |
| Testing & debugging | `.github/skills/vscode-testing-and-debugging/SKILL.md` |
| Build, packaging & release | `.github/skills/vscode-build-package-and-release/SKILL.md` |
| i18n & documentation | `.github/skills/vscode-i18n-and-docs/SKILL.md` |
| Performance & compatibility | `.github/skills/vscode-performance-and-compatibility/SKILL.md` |
| Refactoring & maintenance | `.github/skills/vscode-refactor-and-maintenance/SKILL.md` |
