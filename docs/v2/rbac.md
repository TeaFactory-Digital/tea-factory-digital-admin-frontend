# Roles and permissions

## v2 in one paragraph

**Five roles, not seven, and the same fifteen capabilities.** That asymmetry is the
decision, and it is worth stating why the scope cut reached one and not the other.

`weigher` and `accountant` are **gone from `ConsoleRole`**. Both existed for
capabilities that, at a factory whose own system feeds the platform, belong to that
system: a weigher's entire job was `deliveries: write`, an accountant's was
`ratesAndMonthClose` and `payouts`. A role is something somebody is *assigned*; one
that grants nothing at most factories is a support call waiting to happen. The work
they did, where this console does it at all, sits with the clerk and the manager.

The capabilities they were built around (`deliveries`, `ratesAndMonthClose`,
`payouts`) **stay**. A capability key is a column in a matrix the server also holds,
§12.1 is the product's permission model rather than this repository's, and dropping
keys would be a migration of every role record for no gain. Two of them gate screens
again: with the factory-system sync **off** ([factory-records.md](./factory-records.md)),
`deliveries` gates **Factory records → Leaf intake** and `ratesAndMonthClose` gates
**Factory records → Rates & month close**. Neither screen exists with the sync on, so at
a synced factory the grants reach nothing. `payouts` gates nothing this build routes.

`billing` gates the bills: reading them always, and with the sync off importing,
generating and typing an "other deductions" line (`W`), and creating or cancelling a
savings withdrawal (`A`).

Other capabilities gained a surface without becoming new ones: `creditRequests` also
gates **M18** (tea packets) and, at `W`, recording a **walk-in credit request** made at
the counter; `suppliers: W` also gates **Add supplier**, opening balances, a supplier's
own transport rate and the supplier imports (sync off); `content` also gates the
**banner editor**, with `content: approve` on its lifecycle verbs exactly as it is on an
article's. Inventing a capability for any of these would be a permission the matrix has
never granted anybody.

**Nothing was lost by dropping the two roles**, because the server is still the
authority: a factory whose own console assigns `weigher` sends grants for it, and
`resolveGrants` honours grants for roles this build has never heard of. The mock
fixture carries exactly that case as `factory-system@galabodatea.lk`: no
`ConsoleRole` at all, every capability from the server.

The §12.1 permission matrix, how it is expressed, and (the part that matters)
where authorization is actually enforced.

---

## The one thing to understand first

**Nothing in the console authorizes anything.**

> Permissions are enforced **server-side per endpoint**; the console hides what a
> role cannot do only as a courtesy.
> Source: the mobile repo's `docs/domain-logic.md` §18.5, Auth and roles

Every capability check in this codebase (`useCan()`, `RequireCapability`, a
hidden button, an absent sidebar row) exists so a clerk is not shown a lever
that will `403`. Hiding it is kinder than offering it. But a guard that were the
only check would be bypassed by anyone who can edit JavaScript, and the mock API
therefore enforces the matrix too, so the console's error handling is exercised
rather than assumed.

---

## The matrix, as data

`packages/domain/src/rbac.ts` transcribes §12.1 row for row.

`R` read · `W` create/edit · `A` approve/reject · `-` no access

| Capability | Clerk | Manager | Editor | Fac. admin | Plat. admin |
| --- | --- | --- | --- | --- | --- |
| `suppliers` | W | R | - | R | R |
| `deliveries` | W | R | - | R | R |
| `ratesAndMonthClose` | R | A | - | R | R |
| `billing` | W | A | - | R | R |
| `payouts` | R | A | - | - | - |
| `creditRequests` | W | A | - | - | - |
| `creditAboveThreshold` | - | A | - | - | - |
| `changeRequests` | A | A | - | - | - |
| `inquiries` | A | R | - | - | - |
| `content` | R | R | W | A | - |
| `flagsAndBranding` | R | R | - | W | W |
| `usersAndRoles` | - | R | - | W | W |
| `reports` | R | R | - | R | R |
| `auditLog` | - | R | - | R | R |
| `tenants` | - | - | - | - | W |

**The clerk's three `W`s are the sync-off counter work**: `deliveries: W` to weigh in
the day's leaf, `creditRequests: W` to record a request made at the counter, and
`billing: W` to import, generate or adjust the month's bills. None of them decides
anything. **The clerk also reads `ratesAndMonthClose` (28 October 2026)**: Rates & month
close is where the finished bills are imported and the bills generated, and the screen is
built on the month list (`GET /admin/months`, `ratesAndMonthClose: read` on the server), so
with `-` the clerk's `billing: W` could not be used at all. Entering the rate (`W`) and
publishing (`A`) stay with the manager. Approving a credit request stays `creditRequests: A`, publishing a month stays
`ratesAndMonthClose: A`, both with the manager, and BR-501 refuses the person who
recorded or imported the record as its approver.

**Savings withdrawals need `billing: A`**, not `W`. A withdrawal pays a supplier's own
savings out on their next bill; the clerk's `W` exists for the bill work above and must
not let them pay that money out. So the manager creates and cancels withdrawals
(`POST /admin/savings/accounts/:supplierId/withdrawals` and
`POST /admin/savings/withdrawals/:id/cancel`).

Only `payouts` is listed in `FACTORY_CONSOLE_CAPABILITIES` now, and **M15 does not render
that row**: it shows fourteen. `deliveries` and `ratesAndMonthClose` left the list when the
sync-off screens came back, so a factory can change who may enter leaf or publish a month
from `/users?view=roles`. The hidden row's stored levels are preserved untouched:
`RoleMatrixView` saves the whole `matrix[role]`, and `users.test.ts` asserts it, because that spread is the only thing standing between hiding a
value and dropping it.

Levels are ordered `none < read < write < approve`, and **the stronger implies
the weaker**: an approver who could not read the record could not approve
responsibly.

### Which pairs cannot be merged

A factory that wants fewer roles can merge them in M15 without a deploy, but two of the
splits are load-bearing and merging them breaks something:

- **Clerk and manager.** BR-501 requires the creator of a record not to be its
  approver. Collapse the two and every walk-in request the clerk records, and every month
  whose rate or bills they entered or imported, becomes a self-approval the server refuses with
  `409 four-eyes-violation`. It would also hand the clerk `billing: A`, and with it
  savings withdrawals.
- **Editor and factory admin.** `content: W` writes what suppliers' phones display;
  `content: A` publishes it. Merging them removes the review step before something
  reaches every supplier at once. Legitimate at a small factory, but a choice, not a
  tidy-up.

`creditAboveThreshold` is a third split of the same kind, inside the manager row rather
than between two roles: above the threshold, approval **escalates rather than widens**.

### Three rows that catch people out

- **A manager cannot edit a supplier record.** §12.1 gives them `R`, not `W`.
  Easy to get wrong because a manager outranks a clerk almost everywhere else.
  Both a unit test and an integration test assert it.
- **A clerk holds `billing: W` and still cannot pay out savings.** Withdrawals are
  `billing: A`. A clerk who can import a month's bills reasonably expects the savings
  screen to work the same way; it does not, on purpose.
- **A clerk has no audit access at all.** Deliberate: the log is for the people
  reviewing the work, not the people doing it. So a clerk can reveal a bank
  account number and cannot read the log of who revealed it, which is the control
  working, not a gap.

---

## Roles are data, not code

§12.1 is explicit:

> The matrix itself is **data, not code**: a factory will want to split or merge
> these roles, and that must not be a deploy.

So the table above is the **offline default**, and since M15 that is finally the whole
truth of it rather than an intention. Until this module existed,
`packages/domain/src/rbac.ts` was the authority while calling itself a default; there was
no way to change a role without editing that file and shipping a build, which is precisely
the deploy §12.1 says must not be required. `/users?view=roles` edits the matrix, the API
serves it, and `DEFAULT_ROLE_MATRIX` is what a factory that has never customised anything
happens to be using. `RoleMatrix.customised` says which of the two you are looking at.

**Editing it has one refusal, and it is the failure nobody predicts.** A matrix in which no
role grants `usersAndRoles` locks the factory out of its own console, with every user still
holding the roles they had, and no user record having changed. A guard written per user
misses it entirely, so `matrixKeepsRecovery` checks the *proposed matrix* before it is saved,
in the screen, the repository and the server. Three layers is not belt-and-braces here: the
console has no recovery path outside itself, so the toast has to be able to explain the
refusal before the request goes.

The authority is the `grants` object the server sends with the session (on
`POST /admin/auth/login` and on every `POST /admin/auth/refresh`, which is how the console
bootstraps; `GET /admin/auth/me` carries the same grants), and `resolveGrants` merges them
asymmetrically:

```ts
resolveGrants(roles, serverGrants)   // server wins per capability; matrix fills gaps
```

The asymmetry is on purpose:

- A server that has been reconfigured to split "clerk" into two roles sends grants
  this build has never heard of. **Those must be honoured**; otherwise a role
  change is a console release.
- A server that sends *nothing* for a capability has not revoked it; it has said
  nothing, and the shipped default applies. This is what lets the console work
  against a backend that has not implemented per-endpoint grants yet.

**v2 made the first bullet concrete rather than hypothetical.** A server may still send
grants for roles this build has no matrix row for (`weigher`, `accountant`, or a factory's
own split of `clerk`), and the merge takes them from the server unchanged. The fixture
identity `factory-system@galabodatea.lk` is that path end to end: `roles: []`, every
capability from the server.

---

## Four eyes on money (BR-501)

> Whoever creates a credit approval, a payout run or a month close may not be
> whoever approves it. Above the manager's threshold, approval **escalates rather
> than widens**; a second clerk is not a substitute for a manager.

```ts
isSelfApproval(user, record.createdById)   // null createdById → supplier-raised, never a violation
```

Three layers, and all three are needed:

1. **The queue does not offer the buttons.** A clerk who raised a request on a
   supplier's behalf sees an explanation instead of a form; being told up front
   beats writing a note and being refused.
2. **The server refuses with `409 four-eyes-violation`.** The console can be lied
   to about who created a record.
3. **It is a refusal, not a warning.** A warning that can be clicked through is a
   control that does not exist.

`createdById: null` means the supplier raised it from the app, the common case
for a change request, and never a violation. Getting that backwards would lock the
whole queue.

**A walk-in request is the clerk's record.** `POST /admin/credit-requests` stores it with
`channel: 'office'` and `createdById` set to whoever typed it, so the same check stops them
deciding it. Publishing a month (sync off) refuses whoever entered its rate **or imported a
bill of the month** (an imported month takes its rate from the finished-bills file), and a
late division file's bills wait for a manager other than their importer.

### The approval threshold is still unanswered

`canApproveAmount(grants, amount, managerThreshold)` takes the threshold as a
**parameter, not a constant**, because "above what amount does a manager rather
than a clerk have to approve?" is an open question with the factory
(status.md §21.6).

Passing `null` means *not configured* and requires only the base capability; it
must not mean "nothing is allowed", which would block every approval until the
factory answers. There is a test for that specific case.

---

## Using it in the console

```tsx
// A hook, for a button or a panel
const canApprove = useCan('changeRequests', 'approve');

// A route wrapper: renders an explanation, does not redirect
<RequireCapability capability="auditLog"><AuditScreen /></RequireCapability>

// Navigation: flag first, then capability
(!item.flag || flags[item.flag]) && can(grants, item.capability, 'read')
```

**Flag before capability, always.** A feature the factory has not bought is not a
permission question, and asking in the other order shows a manure queue to a
manager at a factory that has never sold fertilizer.

`AuditPanel` renders **nothing at all** when the user lacks `auditLog`, rather
than an empty panel labelled "audit trail", which would read as "nothing was
recorded".

---

## The console's own identities

Console users are a **separate realm** from suppliers: different table, different
token audience, different login screen. A supplier token must never open the
console.

- **Sign-in is one step, for every role.** The console asked manager-and-above for a
  TOTP code and the factory has withdrawn it: it is worked from shared office machines,
  where a code on one person's phone stops whoever is at the counter. So a correct
  password *is* a session, and what guards a senior action is this matrix, the four-eyes
  rule and the audit log, none of which ever depended on a second factor. The integration
  test that asserted a manager could read nothing until MFA was verified now asserts the
  inverse, beside the refusals proving the matrix still holds (`changeRequests.test.tsx`).
- **The factory and platform admins read a factory's records, never change them.** `R` on
  `deliveries`, `ratesAndMonthClose` and `billing`: the factory administrator sees the
  Factory records menu (the factory's decision), and the platform team can look at a
  factory's leaf, rates and bills to answer a support question. Entering, approving and
  publishing stay with the factory's own clerk and manager (four-eyes, audit).
- **Roles are per factory.** A platform admin is the only identity that spans
  tenants, and every cross-tenant action is audited.
- **Sessions are revocable**, and every approval carries the actor into the audit
  log.

---

## Tests

`apps/admin/src/test/rbac.test.ts`: 16 cases over the matrix, the merge
semantics, four-eyes and the threshold, including a role this build does not ship
whose grants arrive from the server. These are the highest-value unit tests in
the console: the matrix is the thing a factory will ask to change, and every
change is a chance to hand a clerk an approval they should not have.

`apps/admin/src/test/changeRequests.test.tsx`: the same rules through the real
transport against the mock API, including the three refusals and the
manager-cannot-edit case.
