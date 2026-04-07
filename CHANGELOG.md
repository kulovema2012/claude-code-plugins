# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `LICENSE` — MIT license
- `CHANGELOG.md` — version history
- `CONTRIBUTING.md` — guide for adding new plugins
- Root `plugin.json` — unified entry point for single-ZIP Claude Desktop install
- `license`, `repository`, and `keywords` fields to all `plugin.json` files

### Changed
- `.gitignore` — expanded to cover secrets, logs, build artifacts, and Claude Code session state
- `.claude/settings.json` — enable task-service and engineering-mentor plugins locally
- `README.md` — updated plugin structure example and ZIP install instructions
- `CLAUDE.md` — trimmed to under 200 lines

### Removed
- Duplicate `.claude-plugin/plugin.json` files from each plugin directory

## [1.0.0] - 2026-03-29

### Added
- `task-service` plugin — MCP-connected task management, session continuity, and decision logging
- `engineering-mentor` plugin — proactive best-practice guidance and anti-pattern detection
- `.claude-plugin/marketplace.json` — central plugin registry
- `README.md` — installation instructions and plugin documentation
- `CLAUDE.md` — principal software engineer persona and execution protocols
