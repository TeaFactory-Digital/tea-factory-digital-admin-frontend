/**
 * Do the copies of `@tfd/domain` still match this one?
 *
 *   node scripts/domain-drift.mjs [path-to-backend-checkout] [path-to-app-checkout]
 *
 * The backend and the supplier app both copy `packages/domain/src` from this repository
 * (`npm run vendor:pull`) and fail their own builds on a local edit (`vendor:check`). What
 * they cannot see from their side is this repository moving on: a rule changed here that
 * the API or the app still runs the old way. This asks the question from this side, so a
 * change to the shared package says at once who has a `vendor:pull` to do.
 *
 * Compared by **content, line endings ignored**: a checkout may have CRLF files (a Windows
 * checkout) holding the same text, and a byte compare would call all of them changed and
 * hide the few that really are.
 *
 * The paths default to the sibling checkouts, `../tea-factory-digital-backend` and
 * `../tea-factory-digital-mobile-frontend`. A **named** checkout that is missing is an error
 * (exit 2); a default one that is missing is skipped, so CI, which clones only the backend,
 * checks the backend. Exits 1 when a copy differs (each file named).
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OURS = join(ROOT, 'packages', 'domain', 'src');
const COPIES = [
  { label: 'backend', path: process.argv[2], fallback: join(ROOT, '..', 'tea-factory-digital-backend') },
  { label: 'app', path: process.argv[3], fallback: join(ROOT, '..', 'tea-factory-digital-mobile-frontend') },
];

function walk(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, base, out);
    else out.push(relative(base, full).split(sep).join('/'));
  }
  return out;
}

const text = (file) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

let failed = false;
let checked = 0;
for (const copy of COPIES) {
  const checkout = resolve(copy.path ?? copy.fallback);
  const theirs = join(checkout, 'packages', 'domain', 'src');
  if (!existsSync(theirs)) {
    if (copy.path) {
      console.error(`No ${copy.label} checkout at ${checkout} (looked for packages/domain/src).`);
      process.exit(2);
    }
    console.log(`domain:drift skipped the ${copy.label}: no checkout at ${checkout}.`);
    continue;
  }
  checked += 1;
  const ours = new Set(walk(OURS));
  const files = new Set(walk(theirs));
  const changes = [];
  for (const file of ours) {
    if (!files.has(file)) changes.push(`  only here       ${file}`);
    else if (text(join(OURS, file)) !== text(join(theirs, file))) changes.push(`  differs         ${file}`);
  }
  for (const file of files) {
    if (!ours.has(file)) changes.push(`  only ${copy.label.padEnd(10)} ${file}`);
  }
  if (changes.length === 0) {
    console.log(`domain:drift ok, the ${copy.label}'s copy matches (${ours.size} files).`);
  } else {
    failed = true;
    console.error(`The ${copy.label}'s copy of @tfd/domain differs in ${changes.length} files:`);
    console.error(changes.join('\n'));
    console.error(`If this repository is ahead, the ${copy.label} runs \`npm run vendor:pull\`.\n`);
  }
}

if (checked === 0) {
  console.error('No copy of @tfd/domain found to compare. Pass the paths: node scripts/domain-drift.mjs <backend> <app>');
  process.exit(2);
}
if (failed) process.exit(1);
