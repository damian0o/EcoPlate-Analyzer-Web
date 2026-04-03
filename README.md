# EcoPlate Analyzer Web

A web-based frontend for analyzing EcoPlate experiment data, built entirely by [Claude Code](https://claude.ai/claude-code) (Anthropic's AI coding assistant).

🔗 **Live app:** [damian0o.github.io/EcoPlate-Analyzer-Web](https://damian0o.github.io/EcoPlate-Analyzer-Web/)

🔗 **Original project:** [MSteperska/EcoPlate-Analyzer](https://github.com/MSteperska/EcoPlate-Analyzer)

## What Claude built

This entire web application was created by Claude Code from scratch, based on the original Python-based EcoPlate-Analyzer project. The work includes:

- **App scaffold** — HTML structure, CSS theme, tab-based navigation
- **Data loading** — Remote JSON fetch from GitHub Pages, 8×12 EcoPlate grid visualization, metadata form with validation and duplicate checking
- **Edit tab** — Record CRUD with dataset selector, editable metadata, update and delete functionality
- **Filter tab** — Multi-dimensional filtering with CSV export
- **Statistics** — Pure calculation module for AWCD, SAWCD, Shannon Diversity Index, and Shannon Evenness
- **Tests tab** — Chart.js visualizations (grouped bar and stacked percentage charts), results table, CSV/PNG export
- **Bug fix** — Diagnosed and fixed a production issue where experiment JSON files containing `NaN` values (invalid JSON) caused the app to fail on data load
