/**
 * Does the backend's copy of `@tfd/domain` still match this one?
 *
 *   node scripts/domain-drift.mjs [path-to-backend-checkout]
 *
 * The backend copies `packages/domain/src` from this repository (`vendor:pull`) and fails
 * its own build on a local edit (`vendor:check`). What it cannot see from its side is this
 * repository moving on: a rule changed here that the API still runs the old way. Its own
 * nightly job reports that; this is the same question asked from this side, so a change to
 * the shared package says at once that the backend has a `vendor:pull` to do.
 *
 * Compared by **content, line endings ignored**: the backend's checkout may have CRLF
 * files (a Windows checkout) holding the same text, and a byte compare would call all of
 * them changed and hide the few that really are.
 *
 * Exits 1 when the two differ (each file named), 2 when there is no backend checkout. The
 * path defaults to the sibling checkout, `../tea-factory-digital-backend`.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND = resolve(process.argv[2] ?? join(ROOT, '..', 'tea-factory-digital-backend'));
const OURS = join(ROOT, 'packages', 'domain', 'src');
const THEIRS = join(BACKEND, 'packages', 'domain', 'src');

function walk(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, base, out);
    else out.push(relative(base, full).split(sep).join('/'));
  }
  return out;
}

const text = (file) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

if (!existsSync(THEIRS)) {
  console.error(`No backend checkout at ${BACKEND} (looked for packages/domain/src).`);
  console.error('Pass the path: node scripts/domain-drift.mjs <backend checkout>');
  process.exit(2);
}

const ours = new Set(walk(OURS));
const theirs = new Set(walk(THEIRS));
const changes = [];
for (const file of ours) {
  if (!theirs.has(file)) changes.push(`  only here       ${file}`);
  else if (text(join(OURS, file)) !== text(join(THEIRS, file))) changes.push(`  differs         ${file}`);
}
for (const file of theirs) {
  if (!ours.has(file)) changes.push(`  only backend    ${file}`);
}

if (changes.length === 0) {
  console.log(`domain:drift ok, the backend's copy matches (${ours.size} files).`);
} else {
  console.error(`The backend's copy of @tfd/domain differs in ${changes.length} files:`);
  console.error(changes.join('\n'));
  console.error('');
  console.error('If this repository is ahead, the backend runs `npm run vendor:pull`.');
  process.exit(1);
}
