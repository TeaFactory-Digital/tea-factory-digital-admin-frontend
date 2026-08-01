# Roles and permissions

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

| Capability | Clerk | Weigher | Accountant | Manager | Editor | Fac. admin | Plat. admin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `suppliers` | W | R | R | R | — | R | R |
| `deliveries` | R | W | W | R | — | — | — |
| `ratesAndMonthClose` | — | — | W | A | — | — | — |
| `billing` | R | — | W | A | — | — | — |
| `payouts` | R | — | W | A | — | — | — |
| `creditRequests` | R | — | R | A | — | — | — |
| `creditAboveThreshold` | — | — | — | A | — | — | — |
| `changeRequests` | A | — | R | A | — | — | — |
| `inquiries` | A | — | — | R | — | — | — |
| `content` | R | — | — | R | W | A | — |
| `flagsAndBranding` | R | — | — | R | — | W | W |
| `usersAndRoles` | — | — | — | R | — | W | W |
| `reports` | R | R | R | R | — | R | R |
| `auditLog` | — | — | R | R | — | R | R |
| `tenants` | — | — | — | — | — | — | W |

Levels are ordered `none < read < write < approve`, and **the stronger implies
the weaker** — an approver who could not read the record could not approve
responsibly.

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

- **MFA is mandatory for manager and above.** The manager is the only role that
  can approve credit above threshold, close a month or publish bills, so the
  second factor is not optional dressing. A correct password alone leaves the
  store in `mfaRequired` with **no access token** — there is an integration test
  asserting that a manager who has not completed MFA cannot read anything.
- **Roles are per factory.** A platform admin is the only identity that spans
  tenants, and every cross-tenant action is audited.
- **Sessions are revocable**, and every approval carries the actor into the audit
  log.

---

## Tests

`apps/admin/src/test/rbac.test.ts` — 15 cases over the matrix, the merge
semantics, four-eyes and the threshold. These are the highest-value unit tests in
the console: the matrix is the thing a factory will ask to change, and every
change is a chance to hand a clerk an approval they should not have.

`apps/admin/src/test/changeRequests.test.tsx` — the same rules through the real
transport against the mock API, including the three refusals and the
manager-cannot-edit case.
