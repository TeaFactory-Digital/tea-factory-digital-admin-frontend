# The Bank Catalogue

**Where the list of banks and branches lives, and where it is going.**

| | |
| --- | --- |
| **Today** | Generated into the console's own source, served to the app in `client_config` |
| **After the backend exists** | A database table, seeded once from this repo, edited in M14 |
| **What the app does** | Unchanged either way — it reads `banks` from `GET /config` |

---

## 1. Where it is now

```
scripts/generate-banks.mjs
   │  reads github.com/samma89/Sri-Lanka-Bank-and-Branch-List
   │  45 institutions · 3,682 branches · SLIPS codes
   ├──────────────────────────────► packages/domain/src/data/sriLankaBanks.ts   (161 KB)
   │                                   └─ seeds the mock client_config
   └──────────────────────────────► docs/v2/sri-lanka-banks.seed.json           (283 KB)
                                       └─ for the backend, when it exists
```

The app **already fetches** the list rather than bundling it: `src/config/banks.ts` in the
mobile repo is an empty array, and `mergeServedConfig` replaces it with whatever
`GET /config` serves. That part of the plan is done.

What is still a stopgap is the console: the catalogue is compiled into `@tfd/domain`
because there is nowhere else to put it yet.

---

## 2. What the backend takes over

**One table, seeded once from
[`sri-lanka-banks.seed.json`](./sri-lanka-banks.seed.json).**

That file is emitted by the same generator, so it is the same list the console was built
against rather than a fresh pull that may have moved. It carries the clearing codes even
though nothing reads them today — see §4.

```json
{
  "source": "https://github.com/samma89/Sri-Lanka-Bank-and-Branch-List",
  "banks": 45,
  "branches": 3682,
  "catalogue": [
    {
      "code": "7852",
      "name": "Alliance Finance Company PLC",
      "branches": [{ "code": "036", "name": "Aluthgama" }]
    }
  ]
}
```

Re-running `node scripts/generate-banks.mjs` refreshes both outputs from upstream.

---

## 3. Three decisions, and what each one costs

These were settled deliberately. They are recorded because each has a cost that is
invisible until somebody hits it, and each will otherwise be re-argued.

### 3.1 The catalogue stays inside `client_config`

**No `/banks` resource.** The console keeps `PATCH`ing `config.banks` as one array, which
is what it does today, so the backend needs no new endpoints.

> ⚠️ **The cost: concurrent edits.** The whole array — about 50 KB — is written on every
> save. Two people editing different banks at the same time means the second save
> **silently discards the first**, with no error and nothing in the audit log to show a
> change went missing.
>
> This is acceptable while one or two people administer one factory. It stops being
> acceptable with a shared console or several tenants. The fix at that point is a
> per-bank resource, not a bigger patch.

### 3.2 Records name their bank; they do not reference it

`BankDetails` is `{ bankName, branchName, accountNumber }` — **strings, not ids**. A
supplier's details say *"Bank of Ceylon, Akuressa"*, and the catalogue is only the list
those values were chosen from.

**So the two are joined by string comparison,** here and in the app:

```ts
banks.find((bank) => bank.name === supplier.bankDetails.bankName)?.branches ?? []
```

That join is why the names in every fixture must match the catalogue **exactly**. It has
already been got wrong twice: the console's seed carried `Commercial Bank` and `Hatton
National Bank` where the clearing list says `Commercial Bank PLC` and `Hatton National
Bank PLC`. Nothing threw — the branch dropdown simply came up empty.

### 3.3 Add and delete, but no rename

The console offers **add** and **delete**, and deliberately not rename.

| | Safe? | Why |
| --- | --- | --- |
| **Add** | ✅ | Nothing references it yet |
| **Delete** | ✅ | Existing details keep the name they were saved with. Removing a bank only stops it being *offered* — `configImpact` warns when suppliers still name it |
| **Rename** | ❌ **not offered** | §3.2: nothing would update the records. Every supplier at that bank would find their branch dropdown empty, silently |

**To correct a wrong name:** add the correct one, delete the wrong one. Suppliers already
on the old name keep it until each submits a change request — which is the honest
outcome, because their account really was recorded under that name.

> If rename is wanted later it needs one of two things, and both are larger than the
> button: records referencing a **stable id** (the SLIPS code in the seed file is the
> obvious candidate), or a **cascading update** across every supplier record — which also
> rewrites what past payout runs and approved change requests said at the time.

---

## 4. Why the seed keeps the clearing codes

Nothing reads them. `client_config.banks` is names-only, `BankDetails` is names-only, and
the payout export writes `bankName` and `branchName`.

They are kept because **a name is recoverable from a code and a code is not recoverable
from a name.** A SLIPS payout file routes on `7056` / `045` rather than on a spelling, so
the day the file needs them, the alternative is re-running the generator against whatever
upstream says *then* — and matching 3,682 branch names against a list that has moved in
the meantime.

They cost nothing while unused: they sit in a JSON file the backend seeds from once.

---

## 5. Removing the console's copy

Once the backend serves `banks`, this is what comes out of the frontend.

- [ ] Delete `packages/domain/src/data/sriLankaBanks.ts`
- [ ] Drop `export * from './data/sriLankaBanks'` from `packages/domain/src/index.ts`
- [ ] In `apps/admin/src/services/mocks/seed.ts`, replace the `SRI_LANKA_BANKS` import and
      the `LOCAL_BRANCHES` filter with a small literal list — the mock still needs banks
      to generate supplier fixtures with, and **the names must stay verbatim** (§3.2)
- [ ] Point `scripts/generate-banks.mjs` at the backend's seed directory, or move it there
- [ ] `apps/admin/src/test/banks.test.ts` covers the generated module — retarget it at the
      seed JSON, or delete it with the module

**What does *not* change:** `BanksSection`, `configImpact`, the mobile app, and
`GET /config`. The catalogue moves; nothing that reads it does.

---

## 6. What is already true

Worth stating, because the plan reads as more remaining work than there is.

| | |
| --- | --- |
| App fetches rather than bundles | ✅ `defaultBanks` is `[]`; the list arrives in `GET /config` |
| Console fetches rather than bundles | ✅ M14 reads `GET /admin/config` |
| Add a bank / add a branch | ✅ `BanksSection` |
| Delete, with an in-use warning | ✅ `StringListEditor` + `configImpact` |
| Branches editable one bank at a time | ✅ 3,682 inputs at once was unusable |
| Catalogue held by the backend | ⏳ §5 |
