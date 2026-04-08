# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Consolidated to single root `.claude-plugin/plugin.json` manifest with custom `skills` paths pointing to plugin subdirectories
- `README.md` — updated structure diagram and local install instructions to use root `--plugin-dir`
- `CONTRIBUTING.md` — updated to reflect single-manifest workflow

### Removed
- `.claude-plugin/` directories from inside each plugin folder (`task-service/`, `engineering-mentor/`)
- Root `plugin.json` — moved into `.claude-plugin/plugin.json` per spec
- `docs/superpowers/` — stale plans from prior refactoring round

## [1.0.0] - 2026-03-29

### Added
- `task-service` plugin — MCP-connected task management, session continuity, and decision logging
- `engineering-mentor` plugin — proactive best-practice guidance and anti-pattern detection
- `.claude-plugin/marketplace.json` — central plugin registry
- `README.md` — installation instructions and plugin documentation
- `CLAUDE.md` — principal software engineer persona and execution protocols
- `LICENSE` — MIT license
- `CONTRIBUTING.md` — guide for adding new plugins
- `.claude/settings.json` — project-level plugin enablement
