import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const result = spawnSync('bash', ['-lc', 'node --test test/*.test.mjs'], {
  encoding:'utf8',
  maxBuffer:20 * 1024 * 1024,
});

const stdout = String(result.stdout || '');
const stderr = String(result.stderr || '');
process.stdout.write(stdout);
process.stderr.write(stderr);

mkdirSync('artifacts', { recursive:true });
writeFileSync('artifacts/v23-3-round18-match-center.json', JSON.stringify({
  diagnostic:'round51.2-full-test-log',
  status:result.status,
  signal:result.signal || null,
  stdout,
  stderr,
}, null, 2));

process.exit(result.status ?? 1);
