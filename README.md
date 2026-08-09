# Git Patch Exporter

A VS Code extension that exports selected changed files from the **Source Control** view as a
Git `.patch` file which can be re-applied later with `git apply`.

## Features

- 📤 **Export Patch from the SCM view** — Select one or more changed files in the Source Control
  view, right-click, and choose **Export Patch**. The command entry is placed in its own menu
  group so it is separated from the built-in Git actions by dividers above and below.
- 🧩 **Staged, unstaged and new files** — The generated patch includes staged and unstaged
  changes (relative to `HEAD`) as well as untracked (new) files.
- 🗂️ **Multi-selection & groups** — Export a single file, a multi-selection of files, or a whole
  resource group (for example every change in the working tree) at once.
- 💾 **Save anywhere** — Pick where to save the `.patch` file, then optionally open it right away.
- 🌐 **Internationalization** — English, Simplified Chinese, and Japanese language support.

## Usage

1. Make some changes in a Git repository so files appear under **Source Control** (`Ctrl+Shift+G`).
2. Select the changed file(s) you want to export. You can also right-click a changes group header.
3. Right-click and choose **Export Patch**.
4. Choose a destination and file name in the save dialog.
5. The patch is written to disk. Click **Open Patch** to view it.

Apply the exported patch later from the repository root:

```bash
git apply changes-20260809-041317.patch
```

## Extension Settings

| Setting | Description |
|---|---|
| `tlcsdm.gitPatchExporter.defaultDirectory` | Default directory used when saving exported patch files. If empty, the repository root is used. |

## Requirements

- [Git](https://git-scm.com/) must be installed and available on your `PATH`.

## Development

```bash
npm install        # install dependencies
npm run compile    # type-check and bundle with esbuild
npm run lint       # run ESLint and type checks
npm run test       # run the extension tests (requires a display / VS Code)
```

## License

[MIT](LICENSE)
