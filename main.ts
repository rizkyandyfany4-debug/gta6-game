// VICE HEAT: Neon Bay — the gta6-01 entrypoint.
// Copies game/ and screenshots/ beside this file into the output
// directory and writes dossier.json with the vendored make.fun library.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Start from a clean output directory so a previous run can never leak
// stale files into this one — two runs must produce byte-identical output.
// The grader mounts /output as a volume, so the directory itself must
// never be removed — only its contents are cleared.
mkdirSync(out, { recursive: true });
for (const entry of readdirSync(out)) {
  rmSync(join(out, entry), { recursive: true, force: true });
}
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// Report the fingerprint so two runs can be compared by eye: identical
// sha256 means the handoff is deterministic.
const sha = createHash('sha256').update(readFileSync(join(out, 'dossier.json'))).digest('hex');
console.log(`VICE HEAT: Neon Bay handed in to ${out} (dossier.json ${dossier.length} bytes, sha256 ${sha})`);
