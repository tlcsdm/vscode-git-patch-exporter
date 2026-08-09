# Change Log

## [1.0.0] - 2026-08-09

### Added
- Add an **Export Patch** command to the Source Control view context menu that exports the selected
  changed files as a Git `.patch` file, placed in its own menu group with dividers above and below
- Support exporting staged, unstaged, and untracked (new) files, multi-file selections, and whole
  resource groups
- Add a save dialog with an option to open the exported patch, and the
  `tlcsdm.gitPatchExporter.defaultDirectory` setting for the default save location
- Add English, Simplified Chinese, and Japanese localization

### Fixed
- Fix Export Patch command not appearing in the Source Control Changes file and group right-click menus (#3)
