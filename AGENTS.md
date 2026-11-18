# Agent instructions

<!-- lamsa:start -->
## Design files (lamsa)

UI designs live in `*.lamsa.json` files (see `lamsa.config.json`). They are specs: read the JSON and a render, then implement with this repo's own components and tokens.

- Discover: `lamsa tokens`, `lamsa components`, `lamsa tree`.
- Change: `lamsa add --tree`, `lamsa move`, `lamsa delete`, or edit the JSON directly.
- Check: `lamsa validate`, then `lamsa render <id|file>` and look at the PNG.
- The user's selection in the editor: `lamsa selection --json`.
- Every command takes `--json`. Full guide: `lamsa skill`.
<!-- lamsa:end -->
