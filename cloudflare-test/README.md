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
