# Roles and permissions

## v2 in one paragraph

**Five roles, not seven — and the same fifteen capabilities.** That asymmetry is the
decision, and it is worth stating why the scope cut reached one and not the other.

`weigher` and `accountant` are **gone from `ConsoleRole`**. Both existed for
capabilities the factory's own console now owns: a weigher's entire job was
`deliveries: write`, an accountant's was `ratesAndMonthClose` and `payouts`. Strip
those and neither could do anything here but read — a person given the role would sign
in, find suppliers and reports, and report the empty console as a bug. A role is
something somebody is *assigned*; one that grants nothing is a support call waiting to
happen.

The capabilities they were built around — `deliveries`, `ratesAndMonthClose`,
`payouts` — **stay**, granting access to nothing this build routes. A capability key is
a column in a matrix the server also holds, §12.1 is the product's permission model
rather than this repository's, and dropping three keys would be a migration of every
role record for no gain. `billing` is the one of the four that still gates something
here — M5's read-only slip.

Two capabilities gained a surface: `creditRequests` now also gates **M18** (tea
packets), and `content` now also gates the **banner editor**, with `content: approve`
on its lifecycle verbs exactly as it is on an article's. Neither is a new capability,
and that is deliberate — inventing one would be a permission the matrix has never
granted anybody.

**Nothing was lost by dropping the two roles**, because the server is still the
authority: a factory whose own console assigns `weigher` sends grants for it, and
`resolveGrants` honours grants for roles this build has never heard of. The mock
fixture carries exactly that case as `factory-system@galabodatea.lk` — no
`ConsoleRole` at all, every capability from the server.

The §12.1 permission matrix, how it is expressed, and — the part that matters —
where authorization is actually enforced.

---

## The one thing to understand first

**Nothing in the console authorizes anything.**

> Permissions are enforced **server-side per endpoint**; the console hides what a
> role cannot do only as a courtesy.
> — `docs/admin-console.md`, Auth and roles

Every capability check in this codebase — `useCan()`, `RequireCapability`, a
hidden button, an absent sidebar row — exists so a clerk is not shown a lever
that will `403`. Hiding it is kinder than offering it. But a guard that were the
only check would be bypassed by anyone who can edit JavaScript, and the mock API
therefore enforces the matrix too, so the console's error handling is exercised
rather than assumed.

---

## The matrix, as data

`packages/domain/src/rbac.ts` transcribes §12.1 row for row.

`R` read · `W` create/edit · `A` approve/reject · `—` no access

| Capability | Clerk | Manager | Editor | Fac. admin | Plat. admin |
| --- | --- | --- | --- | --- | --- |
| `suppliers` | W | R | — | R | R |
| `deliveries` | R | R | — | — | — |
| `ratesAndMonthClose` | — | A | — | — | — |
| `billing` | R | A | — | — | — |
| `payouts` | R | A | — | — | — |
| `creditRequests` | R | A | — | — | — |
| `creditAboveThreshold` | — | A | — | — | — |
| `changeRequests` | A | A | — | — | — |
| `inquiries` | A | R | — | — | — |
| `content` | R | R | W | A | — |
| `flagsAndBranding` | R | R | — | W | W |
| `usersAndRoles` | — | R | — | W | W |
| `reports` | R | R | — | R | R |
| `auditLog` | — | R | — | R | R |
| `tenants` | — | — | — | — | W |

The three rows in the middle — `deliveries`, `ratesAndMonthClose`, `payouts` — grant
access to nothing this build routes. They are the factory's own console's, kept as
columns because the server holds the same matrix. `FACTORY_CONSOLE_CAPABILITIES` names
them, and **M15 does not render them**: kept in the data is not the same as shown in the
UI, and a dropdown an administrator can set to `approve` with no effect is the same
failure as a role that grants nothing. Their stored levels are preserved untouched —
`RoleMatrixView` saves the whole `matrix[role]`, and `users.test.ts` asserts it, because
that spread is the only thing standing between hiding a value and dropping it.

Levels are ordered `none < read < write < approve`, and **the stronger implies
the weaker** — an approver who could not read the record could not approve
responsibly.

### Which pairs cannot be merged

A factory that wants fewer roles can merge them in M15 without a deploy, but two of the
splits are load-bearing and merging them breaks something:

- **Clerk and manager.** BR-501 requires the creator of a credit approval not to be its
  approver. Collapse the two and every approval in M7 and M18 becomes a self-approval
  the server refuses with `409 four-eyes-violation`.
- **Editor and factory admin.** `content: W` writes what suppliers' phones display;
  `content: A` publishes it. Merging them removes the review step before something
  reaches every supplier at once. Legitimate at a small factory — but a choice, not a
  tidy-up.

`creditAboveThreshold` is a third split of the same kind, inside the manager row rather
than between two roles: above the threshold, approval **escalates rather than widens**.

### Two rows that catch people out

- **A manager cannot edit a supplier record.** §12.1 gives them `R`, not `W`.
  Easy to get wrong because a manager outranks a clerk almost everywhere else.
  Both a unit test and an integration test assert it.
- **A clerk has no audit access at all.** Deliberate: the log is for the people
  reviewing the work, not the people doing it. So a clerk can reveal a bank
  account number and cannot read the log of who revealed it — which is the control
  working, not a gap.

---

## Roles are data, not code

§12.1 is explicit:

> The matrix itself is **data, not code**: a factory will want to split or merge
> these roles, and that must not be a deploy.

So the table above is the **offline default**, and since M15 that is finally the whole
truth of it rather than an intention. Until this module existed,
`packages/domain/src/rbac.ts` was the authority while calling itself a default — there was
no way to change a role without editing that file and shipping a build, which is precisely
the deploy §12.1 says must not be required. `/users?view=roles` edits the matrix, the API
serves it, and `DEFAULT_ROLE_MATRIX` is what a factory that has never customised anything
happens to be using. `RoleMatrix.customised` says which of the two you are looking at.

**Editing it has one refusal, and it is the failure nobody predicts.** A matrix in which no
role grants `usersAndRoles` locks the factory out of its own console — with every user still
holding the roles they had, and no user record having changed. A guard written per user
misses it entirely, so `matrixKeepsRecovery` checks the *proposed matrix* before it is saved,
in the screen, the repository and the server. Three layers is not belt-and-braces here: the
console has no recovery path outside itself, so the toast has to be able to explain the
refusal before the request goes.

The authority is the `grants` object the server sends on `GET /admin/auth/me`, and
`resolveGrants` merges them asymmetrically:

```ts
resolveGrants(roles, serverGrants)   // server wins per capability; matrix fills gaps
```

The asymmetry is on purpose:

- A server that has been reconfigured to split "clerk" into two roles sends grants
  this build has never heard of. **Those must be honoured** — otherwise a role
  change is a console release.
- A server that sends *nothing* for a capability has not revoked it; it has said
  nothing, and the shipped default applies. This is what lets the console work
  against a backend that has not implemented per-endpoint grants yet.

**v2 made the first bullet concrete rather than hypothetical.** `weigher` and
`accountant` still exist in the factory's own console against the same user table, so
the server still sends grants for them; this build simply has no matrix row to derive
them from, and the merge fills them in from the server unchanged. The fixture identity
`factory-system@galabodatea.lk` is that path end to end — `roles: []`, every capability
from the server — and it is the only account in the mock that can move leaf, which is
what keeps M5's staleness and M7's recomputation reachable at all.

---

## Four eyes on money (BR-501)

> Whoever creates a credit approval, a payout run or a month close may not be
> whoever approves it. Above the manager's threshold, approval **escalates rather
> than widens** — a second clerk is not a substitute for a manager.

```ts
isSelfApproval(user, record.createdById)   // null createdById → supplier-raised, never a violation
```

Three layers, and all three are needed:

1. **The queue does not offer the buttons.** A clerk who raised a request on a
   supplier's behalf sees an explanation instead of a form — being told up front
   beats writing a note and being refused.
2. **The server refuses with `409 four-eyes-violation`.** The console can be lied
   to about who created a record.
3. **It is a refusal, not a warning.** A warning that can be clicked through is a
   control that does not exist.

`createdById: null` means the supplier raised it from the app — the common case
for a change request, and never a violation. Getting that backwards would lock the
whole queue.

### The approval threshold is still unanswered

`canApproveAmount(grants, amount, managerThreshold)` takes the threshold as a
**parameter, not a constant**, because "above what amount does a manager rather
than a clerk have to approve?" is an open question with the factory
(status.md §21.6).

Passing `null` means *not configured* and requires only the base capability — it
must not mean "nothing is allowed", which would block every approval until the
factory answers. There is a test for that specific case.

---

## Using it in the console

```tsx
// A hook, for a button or a panel
const canApprove = useCan('changeRequests', 'approve');

// A route wrapper — renders an explanation, does not redirect
<RequireCapability capability="auditLog"><AuditScreen /></RequireCapability>

// Navigation: flag first, then capability
(!item.flag || flags[item.flag]) && can(grants, item.capability, 'read')
```

**Flag before capability, always.** A feature the factory has not bought is not a
permission question, and asking in the other order shows a manure queue to a
manager at a factory that has never sold fertilizer.

`AuditPanel` renders **nothing at all** when the user lacks `auditLog`, rather
than an empty panel labelled "audit trail" — which would read as "nothing was
recorded".

---

## The console's own identities

Console users are a **separate realm** from suppliers: different table, different
token audience, different login screen. A supplier token must never open the
console.

- **Sign-in is one step, for every role.** The console asked manager-and-above for a
  TOTP code and the factory has withdrawn it: it is worked from shared office machines,
  where a code on one person's phone stops whoever is at the counter. So a correct
  password *is* a session — and what guards a senior action is this matrix, the four-eyes
  rule and the audit log, none of which ever depended on a second factor. The integration
  test that asserted a manager could read nothing until MFA was verified now asserts the
  inverse, beside the refusals proving the matrix still holds (`changeRequests.test.tsx`).
- **Roles are per factory.** A platform admin is the only identity that spans
  tenants, and every cross-tenant action is audited.
- **Sessions are revocable**, and every approval carries the actor into the audit
  log.

---

## Tests

`apps/admin/src/test/rbac.test.ts` — 16 cases over the matrix, the merge
semantics, four-eyes and the threshold, including a role this build does not ship
whose grants arrive from the server. These are the highest-value unit tests in
the console: the matrix is the thing a factory will ask to change, and every
change is a chance to hand a clerk an approval they should not have.

`apps/admin/src/test/changeRequests.test.tsx` — the same rules through the real
transport against the mock API, including the three refusals and the
manager-cannot-edit case.
