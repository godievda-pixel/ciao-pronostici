# Ciao, Web! — permanent TEST Worker

This directory is the GitHub-managed TEST frontend for Ciao, Web!.

## Cloudflare Workers Builds settings

- Repository: `godievda-pixel/ciao-pronostici`
- Root directory: `cloudflare-test`
- Branch: `develop`
- Build command: `npm test && npm run build`
- Deploy command: `npm run deploy`
- Worker name: `ciao-web-app-test`

After the first successful deploy, Telegram TEST should permanently point to:

`https://ciao-web-app-test.ciao-web.workers.dev/`

Production `ciao-web-app` is intentionally not managed by this directory yet.

Build trigger: 2026-09-01T14:37+03:00

## v23.2 migration checkpoint

The v23.2 competition model and Tournament Engine are loaded in TEST as inert ES modules under `/v23.2/`. v23.1 remains the visible UI until the next migration milestone explicitly switches a screen.
