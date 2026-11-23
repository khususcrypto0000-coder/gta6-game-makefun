// Neon Shores — the hand-in program for the make.fun "Make GTA 6" bounty.
//
// Node 22, standard library only. It takes the game in this repository
// (game/ plus screenshots/) and hands it to the grader: it copies both
// folders into the output directory and writes /output/dossier.json with
// the kit's buildDossier library, which the scorer runs again byte for
// byte on what is handed in.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The folder this file lives in is the repository root.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));

// The grader gives us a writable /output; everywhere else we take the
// directory the environment names, so a local run can be inspected.
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Copy a folder when it exists, creating parents as needed. Screenshots
// are optional in a local run but always present in the submitted repo.
function copyTree(name: string): void {
  const from = join(repoRoot, name);
  if (!existsSync(from)) return;
  mkdirSync(join(outDir, name), { recursive: true });
  cpSync(from, join(outDir, name), { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyTree('game');
copyTree('screenshots');

// The scorer's own caps, from the bounty: the dossier text holds at most
// 160 KiB of source, at most 4 screenshots of at most 256 KiB each, and
// game/ holds at most 993 files and 48 MiB in all. buildDossier refuses
// an entry the scorer would refuse, so a local run that writes a dossier
// here is one the grader will accept on those caps.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`Neon Shores handed in: ${outDir} (${dossier.length} bytes of dossier)`);
