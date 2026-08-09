/**
 * Regenerates the Sri Lankan bank and branch catalogue for the console.
 *
 *   node scripts/generate-banks.mjs
 *
 * **Source:** https://github.com/samma89/Sri-Lanka-Bank-and-Branch-List — the SLIPS
 * participant list, 45 institutions and ~3,700 branches, each carrying the code the
 * clearing system actually routes on.
 *
 * This is a generator rather than a paste because the list *moves*: branches open, close
 * and merge, and finance companies join SLIPS. A hand-edited 4,000-line data file is one
 * nobody dares refresh, and a bank list that is eighteen months stale is one where a
 * supplier cannot find their own branch and gives up on the payout screen.
 *
 * ## One output, not two
 *
 * The app does **not** bundle this list. It reads `banks` from `GET /config`, which the
 * console serves from `client_config` — so the catalogue lives here, on the server side
 * of that call, and a correction reaches every phone at the next config fetch rather than
 * at the next app-store release.
 *
 * That is also why the codes stay: the console generates the payout file, and a bank
 * routes it on the numeric bank and branch code rather than on a spelling.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ADMIN = resolve(HERE, '..');

const REPO = 'samma89/Sri-Lanka-Bank-and-Branch-List';
const RAW = `https://raw.githubusercontent.com/${REPO}/master`;

/**
 * Collapse runs of whitespace.
 *
 * Not cosmetic. The source has `'Hongkong   Shanghai Bank'`, where an ampersand has been
 * lost and left three spaces behind — and eight branch names carry doubled spaces. Two
 * options that look identical in a dropdown but compare unequal is the kind of thing that
 * is only ever noticed as "the branch I picked did not save".
 */
const clean = (value) => value.replace(/\s+/g, ' ').trim();

/** A TypeScript string literal, single-quoted, for names like `People's Leasing`. */
const quote = (value) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/**
 * Codes as zero-padded strings, never as numbers.
 *
 * The source is inconsistent — 169 branch codes arrive as `'001'` and the other 3,539 as
 * `1`, with three banks using both forms in one list. Emitted verbatim these become
 * *octal literals* in TypeScript, which is how this was caught; emitted as numbers, the
 * padding is lost, and a payout file written to a fixed-width column would carry `1`
 * where the bank expects `001`.
 *
 * A code is an identifier and not a quantity: nothing adds two of them together, and the
 * leading zero is part of it. Branch codes run 0–999 and bank codes 7010–8004, so three
 * and four digits cover the range.
 */
const code = (value, width) => String(value).padStart(width, '0');

async function fetchJson(name) {
  const response = await fetch(`${RAW}/${name}`);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  return response.json();
}

const [banks, branchesByBank] = await Promise.all([
  fetchJson('banks.json'),
  fetchJson('branches.json'),
]);

/**
 * Every bank must have a branch list and every branch list a bank.
 *
 * Checked rather than assumed: a silent mismatch would produce a bank whose branch
 * dropdown is permanently empty, which reads to a supplier as a broken screen and to the
 * office as a supplier who "won't fill in their details".
 */
const orphans = banks.filter((bank) => !branchesByBank[String(bank.ID)]);
if (orphans.length > 0) {
  throw new Error(`banks with no branches: ${orphans.map((one) => one.name).join(', ')}`);
}

let duplicatesDropped = 0;

const catalogue = banks
  .map((bank) => {
    const seen = new Set();
    const branches = [];

    for (const branch of branchesByBank[String(bank.ID)]) {
      const name = clean(branch.name);
      /**
       * Two branches under one name — "Head Office" at fourteen banks, and a handful of
       * genuine repeats like DFCC's two Katugastotas. The first code wins.
       *
       * A dropdown offering the same word twice cannot be chosen from: whichever is
       * picked, the supplier cannot tell whether they got it right, and neither can the
       * clerk checking the form afterwards. The dropped code stays in the source if a
       * payout file ever needs to disambiguate.
       */
      if (seen.has(name)) {
        duplicatesDropped += 1;
        continue;
      }
      seen.add(name);
      branches.push({ code: code(branch.ID, 3), name });
    }

    branches.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    return { code: code(bank.ID, 4), name: clean(bank.name), branches };
  })
  // Alphabetical, because the source order is by clearing code — meaningful to a bank and
  // meaningless to a supplier scrolling for their own.
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));

const branchCount = catalogue.reduce((total, bank) => total + bank.branches.length, 0);

/**
 * The header both files carry.
 *
 * `where` is spelled out per repository rather than shared: the generator lives in the
 * admin repo and writes into both, so a mobile developer told to "re-run
 * `scripts/generate-banks.mjs`" would look for a script that is not in their checkout.
 */
const provenance = (note = '') =>
  [
    ' * Generated by `scripts/generate-banks.mjs` — do not edit by hand.' + note,
    ' *',
    ` * Source: https://github.com/${REPO} (SLIPS participants).`,
    ` * ${catalogue.length} institutions, ${branchCount} branches.`,
    ' *',
    ' * Re-run the generator to refresh; branches open and close, and a stale list is one',
    ' * where a supplier cannot find their own branch.',
  ].join('\n');

/* ── @tfd/domain: names and the codes a payout file routes on ─────────────────── */

const domainFile = `/**
 * The Sri Lankan bank and branch catalogue.
 *
${provenance()}
 *
 * Carries the **clearing codes** as well as the names, because the console generates the
 * payout file and a bank routes that on the numeric bank and branch code rather than on a
 * spelling. Nothing reads the codes yet; they are here because they are the part that
 * cannot be reconstructed from a name later.
 */

export interface BankBranchRef {
  /**
   * Three-digit branch code, unique within its bank and not globally.
   *
   * A string because the leading zero is part of it — \`'007'\` is Bank of Ceylon's
   * Panadura branch, and \`7\` is not the same value to a bank reading a fixed-width
   * column.
   */
  code: string;
  name: string;
}

export interface BankRef {
  /** Four-digit SLIPS bank code, e.g. \`'7010'\` for Bank of Ceylon. */
  code: string;
  name: string;
  branches: BankBranchRef[];
}

export const SRI_LANKA_BANKS: readonly BankRef[] = [
${catalogue
  .map(
    (bank) =>
      `  {\n    code: ${quote(bank.code)},\n    name: ${quote(bank.name)},\n    branches: [\n${bank.branches
        .map((branch) => `      { code: ${quote(branch.code)}, name: ${quote(branch.name)} },`)
        .join('\n')}\n    ],\n  },`,
  )
  .join('\n')}
];

/**
 * The same catalogue in the shape \`client_config.banks\` holds.
 *
 * The config is edited by the office and served to the app, so it stays names-only — a
 * factory that banks with four of these should be able to cut the list down to four
 * without also having to keep clearing codes correct by hand.
 */
export const SRI_LANKA_BANK_OPTIONS: Array<{ name: string; branches: string[] }> =
  SRI_LANKA_BANKS.map((bank) => ({
    name: bank.name,
    branches: bank.branches.map((branch) => branch.name),
  }));
`;

/* ── the backend's seed ───────────────────────────────────────────────────────── */

/**
 * The same catalogue as portable JSON, for whoever loads `client_config.banks`.
 *
 * The console's copy is a stopgap: the catalogue belongs in the database, and the
 * TypeScript module above is deleted once there is a backend to hold it (see
 * `docs/v2/bank-catalogue.md`). This file is what that backend seeds itself from, so it
 * is emitted now rather than reconstructed by hand later from a compiled module.
 *
 * It keeps the clearing codes even though nothing reads them today. `client_config.banks`
 * is names-only by decision, and a name is recoverable from a code where the reverse is
 * not — dropping them here would mean re-running this generator against whatever the
 * upstream list says on the day a payout file finally needs them, rather than against the
 * list the factory was actually seeded with.
 */
const seedJson = JSON.stringify(
  {
    source: `https://github.com/${REPO}`,
    banks: catalogue.length,
    branches: branchCount,
    catalogue,
  },
  null,
  2,
);

const outputs = [
  [resolve(ADMIN, 'packages/domain/src/data/sriLankaBanks.ts'), domainFile],
  [resolve(ADMIN, 'docs/v2/sri-lanka-banks.seed.json'), seedJson],
];

for (const [path, contents] of outputs) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
  console.log(`${(contents.length / 1024).toFixed(0).padStart(4)} KB  ${path}`);
}

console.log(
  `\n${catalogue.length} banks, ${branchCount} branches ` +
    `(${duplicatesDropped} duplicate names dropped).`,
);
