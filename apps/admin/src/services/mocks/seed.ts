/**
 * The mock database.
 *
 * The backend has not started, so this is what the console runs against — and it
 * is written to be a **specification by example** for `docs/api-contract.md`
 * rather than a demo. Where it enforces something, the enforcement is a rule the
 * real API must reproduce:
 *
 *  - `four-eyes-violation` when the approver created the record (BR-501)
 *  - `already-decided` when two clerks work the same inbox
 *  - `note-required` on any decision without one (AC-06)
 *  - an audit entry for every mutation, within the same tick (AC-09)
 *  - masked bank details in every list and detail payload (§20.4)
 *
 * Deterministic on purpose: a seeded PRNG rather than `Math.random`, so a
 * screenshot in a bug report matches what the next developer sees, and so the
 * integration tests can assert on real values.
 */

import type {
  DeductionRates,
  RepaymentPlan,
  RequestChannel,
  AdminBill,
  AdminChangeRequest,
  AdminCreditRequest,
  AdminInquiry,
  AdminSavingsLedgerEntry,
  AdminSupplier,
  AdminTeaPacketRequest,
  AuditEntry,
  BannerAction,
  BannerTranslation,
  BannerTranslations,
  BillRun,
  CapabilityGrants,
  CollectionDaySummary,
  ContentStatus,
  ContentTranslation,
  ContentTranslations,
  ConsoleUser,
  CreditEligibility,
  CreditFacility,
  DashboardSummary,
  DeductionLines,
  Delivery,
  FactoryInfo,
  GreenLeafBill,
  InquiryStatus,
  LanguageCode,
  MonthCycleStage,
  MonthException,
  MonthExceptionType,
  MonthlyRate,
  NotificationCategory,
  NotificationSend,
  PaymentMethod,
  RegisteredDevice,
  PayoutLine,
  PayoutRun,
  QueueCount,
  QueueKey,
  RuntimeConfig,
  StaticPageSlug,
  SupplierListItem,
} from '@tfd/domain';
import {
  DEFAULT_DEDUCTION_RATES,
  DEFAULT_TEA_PACKET_POLICY,
  creditInstalment,
  EDITORIAL_FALLBACK_LANGUAGE,
  NOTIFICATION_CATEGORIES,
  OUTLIER_KG_FLOOR_KG,
  QUEUE_SLA_HOURS,
  REQUIRED_MONTHS_OF_HISTORY,
  billNumberFor,
  buildCreditEligibility,
  monthsOfHistory,
  colomboDayOf,
  computeBillAmounts,
  grantsFromRoles,
  isOutlierKg,
  isWritten,
  maskAccountNumber,
  missingTranslations,
  bannerWindowState,
  monthKeyOf,
  round2,
  roundKg,
  savingsDeductionFor,
  slugify,
  slipMonthLabel,
  summariseKgs,
  teaPacketAmount,
} from '@tfd/domain';

/* ───────────────────────── deterministic randomness ───────────────────────── */

/** mulberry32. Small, fast, and identical on every run. */
function prng(seed: number) {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = prng(5708);
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
const between = (min: number, max: number) => min + random() * (max - min);
const intBetween = (min: number, max: number) => Math.floor(between(min, max + 1));

const NOW = new Date();
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();
const daysAgo = (days: number) => hoursAgo(days * 24);
/** Forward, for a banner scheduled ahead of its window — a state only the office sees. */
const daysAhead = (days: number) => hoursAgo(-days * 24);

/* ──────────────────────────────── names ──────────────────────────────── */

const FIRST_NAMES = [
  'Kamal', 'Nimal', 'Sunil', 'Ranjith', 'Chandana', 'Pradeep', 'Ajith', 'Saman',
  'Wasantha', 'Gamini', 'Kumari', 'Malani', 'Nilanthi', 'Pushpa', 'Anoma',
  'Thilaka', 'Sirisena', 'Bandara', 'Jayantha', 'Rohana',
] as const;

const LAST_NAMES = [
  'Perera', 'Silva', 'Fernando', 'Wickramasinghe', 'Rajapaksha', 'Gunawardena',
  'Dissanayake', 'Herath', 'Kumarasinghe', 'Weerasinghe', 'Amarasekara',
  'Liyanage', 'Bandaranayake', 'Karunaratne',
] as const;

const COLLECTION_POINTS = [
  { id: 'cp-makadura', name: 'MAKADURA' },
  { id: 'cp-deniyaya', name: 'DENIYAYA' },
  { id: 'cp-morawaka', name: 'MORAWAKA' },
  { id: 'cp-akuressa', name: 'AKURESSA' },
] as const;

const BANKS = [
  { name: 'Bank of Ceylon', branches: ['Akuressa', 'Matara', 'Deniyaya', 'Morawaka'] },
  { name: "People's Bank", branches: ['Akuressa', 'Matara', 'Kamburupitiya'] },
  { name: 'Commercial Bank', branches: ['Matara', 'Akuressa'] },
  { name: 'Hatton National Bank', branches: ['Matara', 'Deniyaya'] },
  { name: 'Sampath Bank', branches: ['Matara', 'Akuressa'] },
] as const;

/* ───────────────────────────── console users ───────────────────────────── */

/**
 * Three identities, each one because a rule cannot be demonstrated without it:
 *
 *  - **clerk** raises office-side requests, and AC-10 ("no console user can
 *    approve a record they created") needs someone to have created one.
 *  - **manager** approves them, and has MFA enrolled.
 *  - **weigher** is the only one of the three the §12.1 matrix gives
 *    `deliveries: W`. Without it nobody could enter leaf, and the clerk's
 *    read-only view of M3 would look like a bug rather than the matrix working.
 *
 * The password is the same for all three and is printed on the sign-in screen
 * while `VITE_USE_MOCK` is on. That is deliberate — a demo credential that has to
 * be looked up in a source file gets pasted into a chat thread instead.
 */
export const MOCK_PASSWORD = 'demo1234';

/** The manager has MFA enrolled, so signing in as them exercises the challenge. */
export const MOCK_MFA_CODE = '123456';

export interface MockUser extends ConsoleUser {
  password: string;
  grants: CapabilityGrants;
}

export const mockUsers: MockUser[] = [
  {
    id: 'usr-clerk-1',
    name: 'Nadeeka Perera',
    email: 'clerk@galabodatea.lk',
    factoryId: 'galaboda',
    roles: ['clerk'],
    mfaEnrolled: false,
    lastLoginAt: hoursAgo(20),
    status: 'active',
    password: MOCK_PASSWORD,
    grants: grantsFromRoles(['clerk']),
  },
  {
    id: 'usr-manager-1',
    name: 'Ruwan Jayasuriya',
    email: 'manager@galabodatea.lk',
    factoryId: 'galaboda',
    roles: ['manager'],
    mfaEnrolled: true,
    lastLoginAt: daysAgo(1),
    status: 'active',
    password: MOCK_PASSWORD,
    grants: grantsFromRoles(['manager']),
  },
  {
    id: 'usr-accountant-1',
    name: 'Dilani Fonseka',
    email: 'accountant@galabodatea.lk',
    factoryId: 'galaboda',
    roles: ['accountant'],
    // MFA is mandatory for manager and above; the accountant sits below that line
    // and works from a desk in the office, not a shared shed terminal.
    mfaEnrolled: false,
    lastLoginAt: hoursAgo(6),
    status: 'active',
    password: MOCK_PASSWORD,
    grants: grantsFromRoles(['accountant']),
  },
  {
    /**
     * The editor, and the only identity in the fixture with `content: W`.
     *
     * §12.1 gives writing to the editor and publishing to the factory administrator, so
     * **M11 and M12's control is the split between these two accounts** — there is no
     * four-eyes rule on content and no amount to escalate on, the capability boundary is
     * the whole of it. Without both, the module would be read-only for everybody in the
     * fixture and the refusal that matters would be unreachable.
     *
     * Note the shape of this role: `content: W` and *nothing else at all*, not even
     * `auditLog: R`. It is the narrowest account the console has, and it is the reason
     * the news screen's audit panel has to tolerate a `403` rather than treat it as an
     * error — the person most likely to be on that screen cannot read the log.
     */
    id: 'usr-editor-1',
    name: 'Tharindu Silva',
    email: 'editor@galabodatea.lk',
    factoryId: 'galaboda',
    roles: ['editor'],
    mfaEnrolled: false,
    lastLoginAt: hoursAgo(9),
    status: 'active',
    password: MOCK_PASSWORD,
    grants: grantsFromRoles(['editor']),
  },
  {
    id: 'usr-factoryadmin-1',
    name: 'Chandima Bandara',
    email: 'factoryadmin@galabodatea.lk',
    factoryId: 'galaboda',
    roles: ['factoryAdmin'],
    // Manager and above: MFA is mandatory, and a factory administrator holds
    // `usersAndRoles: W` — the account that can widen anybody else's access.
    mfaEnrolled: false,
    lastLoginAt: daysAgo(2),
    status: 'active',
    password: MOCK_PASSWORD,
    grants: grantsFromRoles(['factoryAdmin']),
  },
  {
    id: 'usr-weigher-1',
    name: 'Sunil Rathnayake',
    email: 'weigher@galabodatea.lk',
    factoryId: 'galaboda',
    roles: ['weigher'],
    // No second factor: MFA is mandatory for manager and above, and a weighing
    // point runs on a shared machine at the collection shed where a TOTP app on
    // somebody's phone would stop the queue.
    mfaEnrolled: false,
    lastLoginAt: hoursAgo(3),
    status: 'active',
    password: MOCK_PASSWORD,
    grants: grantsFromRoles(['weigher']),
  },
];

/* ─────────────────────────────── suppliers ─────────────────────────────── */

function makeNic(index: number): string {
  return index % 3 === 0
    ? `${196000000 + index * 7919}V`
    : String(198000000000 + index * 104729).slice(0, 12);
}

function makeSupplier(index: number): AdminSupplier {
  const point = COLLECTION_POINTS[index % COLLECTION_POINTS.length]!;
  const code = `${5000 + index * 7} (${point.name})`;
  const bank = pick(BANKS);
  const hasBank = index % 9 !== 0; // one in nine has no bank details — an M4 exception
  const status = index % 17 === 0 ? 'suspended' : index % 41 === 0 ? 'closed' : 'active';
  const dormant = index % 13 === 0;

  /**
   * Who has the app, matching `mockDevicesBySupplier` exactly.
   *
   * The same `index % 5 === 0` rule, and it has to stay the same rule: the dashboard
   * counts adoption from the device registry and the registry grid reads `hasApp`, so
   * two different predicates would put a percentage on one screen that the list on the
   * next screen disagrees with — which is the failure the queue-count comment in
   * `buildDashboard` is about, in a different module.
   */
  const hasApp = status !== 'closed' && index % 5 !== 0;
  const deviceCount = hasApp ? (index % 23 === 0 ? 2 : 1) : 0;

  return {
    id: `sup-${index}`,
    supplierCode: code,
    name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    nic: makeNic(index),
    phone: `07${intBetween(0, 8)}${String(intBetween(1000000, 9999999))}`,
    email: index % 5 === 0 ? undefined : `supplier${index}@example.lk`,
    homeAddress: `No ${intBetween(1, 250)}, ${point.name} Road, Akuressa`,
    estateAddress: `${point.name} Estate, Lot ${intBetween(1, 40)}`,
    collectionPoint: point.name,
    status,
    // Masked at the source, exactly as the API must return it (§20.4).
    bankDetails: hasBank
      ? {
          bankName: bank.name,
          branchName: pick(bank.branches),
          accountNumber: maskAccountNumber(String(70000000 + index * 137)),
        }
      : undefined,
    hasBankDetails: hasBank,
    /**
     * One in eighteen is marked **`bankTransfer` with no account on file**.
     *
     * Not a fixture quirk — it is the real case AC-04's `missingBankDetails`
     * exception exists for: the office recorded "pay by transfer" when the
     * supplier registered and never received the passbook. It is also the only
     * way M6's `held` line status happens, and a status nothing in the fixture
     * can reach is a status nobody notices is broken.
     */
    paymentMethod: hasBank
      ? index % 4 === 0
        ? 'cheque'
        : 'bankTransfer'
      : index % 18 === 0
        ? 'bankTransfer'
        : 'cash',
    savingsPerKg: [0, 0, 5, 10, 15, 20, 25][index % 7]!,
    savingsBalance: Math.round(between(0, 180000) * 100) / 100,
    creditBalances: {
      advance: index % 4 === 0 ? Math.round(between(2000, 45000) * 100) / 100 : 0,
      loan: index % 11 === 0 ? Math.round(between(20000, 250000) * 100) / 100 : 0,
      manure: index % 6 === 0 ? Math.round(between(1500, 38000) * 100) / 100 : 0,
    },
    registeredAt: daysAgo(intBetween(120, 2200)),
    lastDeliveryAt: dormant || status === 'closed' ? daysAgo(intBetween(95, 400)) : daysAgo(intBetween(0, 4)),
    pendingRequests: 0, // recomputed below, once the queues exist
    dateOfBirth: `19${intBetween(55, 95)}-${String(intBetween(1, 12)).padStart(2, '0')}-${String(intBetween(1, 28)).padStart(2, '0')}`,
    hasApp,
    deviceCount,
    // Spread over the last few weeks so "who has gone quiet" is a question the fixture
    // can actually be asked; `null` for anybody who never signed in.
    lastAppSignInAt: hasApp ? hoursAgo(intBetween(1, 900)) : null,
  };
}

/**
 * 84 suppliers — enough that server-side paging is exercised at the 50-row
 * default, and small enough to read through while debugging.
 */
export const mockSuppliers: AdminSupplier[] = Array.from({ length: 84 }, (_, i) => makeSupplier(i + 1));

/** The `hasBankDetails: false` rows are what M4's close checklist will trip on. */
export const suppliersMissingBankDetails = mockSuppliers.filter((s) => !s.hasBankDetails).length;

export function toListItem(supplier: AdminSupplier): SupplierListItem {
  return {
    id: supplier.id,
    supplierCode: supplier.supplierCode,
    name: supplier.name,
    nic: supplier.nic,
    collectionPoint: supplier.collectionPoint,
    status: supplier.status,
    paymentMethod: supplier.paymentMethod,
    savingsPerKg: supplier.savingsPerKg,
    hasBankDetails: supplier.hasBankDetails,
    lastDeliveryAt: supplier.lastDeliveryAt,
    pendingRequests: supplier.pendingRequests,
    hasApp: supplier.hasApp,
    lastAppSignInAt: supplier.lastAppSignInAt,
  };
}

/**
 * The unmasked numbers, kept in a separate map.
 *
 * Structural, not decorative: it makes it impossible for a list handler to
 * accidentally serialise a real account number, because the supplier record does
 * not contain one. The API should be built the same way — mask in the read model,
 * join to the real value only in the reveal endpoint.
 */
export const mockFullAccountNumbers = new Map<string, string>(
  mockSuppliers.map((s) => [s.id, String(70000000 + Number(s.id.replace('sup-', '')) * 137)]),
);

/* ───────────────────────── M9 change requests ───────────────────────── */

const PAYMENT_LABELS = { cheque: 'Cheque', bankTransfer: 'Bank transfer', cash: 'Cash' } as const;

function makeChangeRequest(index: number): AdminChangeRequest {
  const supplier = mockSuppliers[index * 3 + 1]!;
  const type = (['bankDetails', 'savingsRate', 'paymentMethod'] as const)[index % 3]!;
  const ageHours = [2, 5, 9, 26, 31, 48, 55, 72, 96, 120, 3, 14][index] ?? intBetween(1, 100);

  /**
   * `chg-6` is created by the clerk on the supplier's behalf. Approving it while
   * signed in as that clerk must fail with `four-eyes-violation` — the console's
   * proof of AC-10, and the only reason this fixture exists.
   *
   * The fixture layout is fixed, because the integration tests name these ids:
   *   chg-1 bankDetails · chg-2 savingsRate · chg-3 paymentMethod · chg-4
   *   bankDetails · chg-5 savingsRate · chg-6 paymentMethod (office-raised)
   */
  const officeRaised = index === 5;

  const base = {
    id: `chg-${index + 1}`,
    supplierId: supplier.id,
    supplierCode: supplier.supplierCode,
    supplierName: supplier.name,
    status: 'pending' as const,
    createdAt: hoursAgo(ageHours),
    channel: officeRaised ? ('office' as const) : ('app' as const),
    createdById: officeRaised ? 'usr-clerk-1' : null,
    createdByName: officeRaised ? 'Nadeeka Perera' : null,
    decision: null,
    attachments: [],
    ageHours,
    type,
  };

  if (type === 'bankDetails') {
    const bank = pick(BANKS);
    const branch = pick(bank.branches);
    const account = String(80000000 + index * 991);
    return {
      ...base,
      type: 'bankDetails',
      currentSummary: supplier.bankDetails
        ? `${supplier.bankDetails.bankName} · ${supplier.bankDetails.branchName} · ${supplier.bankDetails.accountNumber}`
        : 'No bank details on file',
      requestedSummary: `${bank.name} · ${branch} · ${maskAccountNumber(account)}`,
      requestedBankDetails: {
        bankName: bank.name,
        branchName: branch,
        // Masked here too. The office approves a *change*, and seeing the full
        // number is a separate audited act even inside an approval.
        accountNumber: maskAccountNumber(account),
      },
    };
  }

  if (type === 'savingsRate') {
    const requested = [0, 10, 20, 25, 30][index % 5]!;
    return {
      ...base,
      type: 'savingsRate',
      currentSummary: `LKR ${supplier.savingsPerKg.toFixed(2)} per kg`,
      requestedSummary:
        requested === 0 ? 'Opt out of the savings scheme' : `LKR ${requested.toFixed(2)} per kg`,
      requestedSavingsPerKg: requested,
    };
  }

  const requestedMethod = supplier.paymentMethod === 'bankTransfer' ? 'cheque' : 'bankTransfer';
  return {
    ...base,
    type: 'paymentMethod',
    currentSummary: PAYMENT_LABELS[supplier.paymentMethod],
    requestedSummary: PAYMENT_LABELS[requestedMethod],
    requestedPaymentMethod: requestedMethod,
  };
}

export const mockChangeRequests: AdminChangeRequest[] = Array.from({ length: 12 }, (_, i) =>
  makeChangeRequest(i),
);

/** Two already-decided rows, so the queue's non-pending filters show something. */
mockChangeRequests.push(
  {
    ...makeChangeRequest(12),
    id: 'chg-13',
    status: 'approved',
    createdAt: daysAgo(6),
    ageHours: 144,
    decision: {
      note: 'Passbook verified against the NIC at the office counter on 24 July.',
      decidedById: 'usr-manager-1',
      decidedByName: 'Ruwan Jayasuriya',
      decidedAt: daysAgo(5),
    },
  },
  {
    ...makeChangeRequest(13),
    id: 'chg-14',
    status: 'rejected',
    createdAt: daysAgo(9),
    ageHours: 216,
    decision: {
      note: 'Account name does not match the registered supplier name. Bring the passbook to the office.',
      decidedById: 'usr-clerk-1',
      decidedByName: 'Nadeeka Perera',
      decidedAt: daysAgo(8),
    },
  },
);

// Pending counts on the supplier records, now that the queue exists.
for (const request of mockChangeRequests) {
  if (request.status !== 'pending') continue;
  const supplier = mockSuppliers.find((s) => s.id === request.supplierId);
  if (supplier) supplier.pendingRequests += 1;
}

/* ─────────────────────────────── audit log ─────────────────────────────── */

export const mockAudit: AuditEntry[] = [
  {
    id: 'aud-1',
    at: daysAgo(5),
    actorId: 'usr-manager-1',
    actorName: 'Ruwan Jayasuriya',
    action: 'changeRequest.approve',
    entity: 'changeRequest',
    entityId: 'chg-13',
    before: { status: 'pending' },
    after: { status: 'approved' },
    ip: '192.168.10.24',
  },
  {
    id: 'aud-2',
    at: daysAgo(8),
    actorId: 'usr-clerk-1',
    actorName: 'Nadeeka Perera',
    action: 'changeRequest.reject',
    entity: 'changeRequest',
    entityId: 'chg-14',
    before: { status: 'pending' },
    after: { status: 'rejected' },
    ip: '192.168.10.31',
  },
  {
    id: 'aud-3',
    at: daysAgo(2),
    actorId: 'usr-manager-1',
    actorName: 'Ruwan Jayasuriya',
    // The same verb M4 writes today, so the log does not carry two names for one
    // act — a fixture with its own vocabulary is a fixture that teaches the wrong
    // thing to whoever reads the audit screen first.
    action: 'month.rate.enter',
    entity: 'monthlyRate',
    entityId: '2026-06',
    before: { ratePerKg: null },
    after: { ratePerKg: 122.5, extraRatePerKg: 8.0 },
    ip: '192.168.10.24',
  },

  /* ────────────────────── What the supplier did themselves ──────────────────────
   *
   * v2's addition, and the gap it closes is worth stating: the app lets a supplier
   * change their **name, telephone, email, date of birth and both addresses**
   * directly through `PATCH /profile` — no approval, no change request
   * (`ChangeRequestType` covers only payout and savings-rate changes). v1 recorded
   * none of it, so the office could be asked *"when did this address change?"* and had
   * no way to answer, and a wrong telephone number had no history at all.
   *
   * These entries are on the **supplier** entity, so they appear on the same timeline
   * as the office's actions on that record — which is the point. "What did we do to
   * this account" and "what did they do" are two readings of one history, and a clerk
   * investigating a dispute needs to see them interleaved.
   *
   * `ip` is `null`: a phone on a mobile network has no address the office can act on,
   * and inventing one would make the column look meaningful. */
  {
    id: 'aud-4',
    at: daysAgo(3),
    actorId: 'sup-7',
    actorName: 'Kamala Wijesinghe',
    actorType: 'supplier',
    action: 'supplier.profile.update',
    entity: 'supplier',
    entityId: 'sup-7',
    before: { homeAddress: 'No 12, DENIYAYA Road, Akuressa' },
    after: { homeAddress: 'No 88, Temple Road, Akuressa' },
    ip: null,
  },
  {
    id: 'aud-5',
    at: daysAgo(11),
    actorId: 'sup-7',
    actorName: 'Kamala Wijesinghe',
    actorType: 'supplier',
    action: 'supplier.profile.update',
    entity: 'supplier',
    entityId: 'sup-7',
    before: { phone: '0771234567' },
    after: { phone: '0759876543' },
    ip: null,
  },
  {
    /**
     * The one that makes §21.16 auditable end to end.
     *
     * The office issues a one-time password and records the identity check; **this** is
     * the other half — the supplier replacing it at first sign-in, which is what makes
     * the credential the office knew stop working. Without this entry the console can
     * show that a password was issued and never that it was consumed.
     */
    id: 'aud-6',
    at: daysAgo(1),
    actorId: 'sup-12',
    actorName: 'Sunil Bandara',
    actorType: 'supplier',
    action: 'supplier.password.change',
    entity: 'supplier',
    entityId: 'sup-12',
    before: { owesPasswordChange: true },
    after: { owesPasswordChange: false },
    ip: null,
  },
  {
    /**
     * A system actor, so the third `AuditActorType` has something behind it.
     *
     * An automatic push fires off an event rather than off a person, and attributing it
     * to whoever happened to publish the month would be worse than leaving it blank —
     * it reads as though they composed and sent it.
     */
    id: 'aud-7',
    at: daysAgo(4),
    actorId: 'system',
    actorName: 'Automatic',
    actorType: 'system',
    action: 'notification.send',
    entity: 'notificationSend',
    entityId: 'snd-1',
    before: null,
    after: { category: 'billPublished', origin: 'automatic' },
    ip: null,
  },
];

/* ─────────────────────────── M3 leaf collection ─────────────────────────── */

/** Today, as the factory's own calendar day (BR-104) — not as UTC's. */
export const TODAY = colomboDayOf(NOW);

export const currentMonthKey = monthKeyOf(TODAY);

/** The window the dashboard's intake trend covers. */
const COLLECTION_DAYS = 14;

/**
 * How many months the fixture carries, the current one included.
 *
 * Declared here rather than beside the M4 month records below, because **M3's
 * delivery rows have to span the same window.** A bill is a read model over those
 * rows and a monthly rate (api.md §16), so a published month with no leaf in it
 * generates no bills — and M5, M6 and M8 would each render an empty screen that
 * reads as a broken module rather than as a fixture with nothing in it.
 *
 * **Eight, because M7 needs seven settled months to be reachable.** A loan and a
 * manure ceiling are gated on `REQUIRED_MONTHS_OF_HISTORY` closed months of income
 * (§9.1), so at four months every loan in the fixture was ineligible for the one
 * reason that says nothing about the module — and a queue whose every row is
 * refused by the same rule cannot show that any of the others work. Same argument
 * as the `held` payout line and `chg-6`: a state nothing in the fixture can reach
 * is a state nobody notices is broken.
 *
 * Seven published months also leaves the mix worth having. A supplier who has
 * delivered throughout clears the bar; a dormant one does not, so `shortHistory`
 * stays reachable as the honest minority rather than the universal answer.
 */
const MONTHS_OF_HISTORY = 8;

function monthKeyBack(months: number): string {
  const date = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - months, 15));
  return date.toISOString().slice(0, 7);
}

/** The first Colombo-local day the fixture records leaf on. */
const HISTORY_START_DAY = `${monthKeyBack(MONTHS_OF_HISTORY - 1)}-01`;

/** Every factory day from the fixture's start to today, oldest first. */
function fixtureDays(): string[] {
  const days: string[] = [];
  for (let back = 0; back < 400; back += 1) {
    const date = colomboDayOf(new Date(NOW.getTime() - back * 86_400_000));
    if (date < HISTORY_START_DAY) break;
    days.push(date);
  }
  return days.reverse();
}

/**
 * The §13 stage of a month.
 *
 * Every month before the current one is **published**, and therefore immutable
 * (BR-108). The month in progress is `awaitingRate`, which is the honest default:
 * the auction result is not in, which is exactly why every rate-derived figure in
 * the app is blank rather than zero.
 *
 * This is what gives `month-locked` a date it can actually happen on — entering
 * or voiding a delivery in last month is refused, and the console has a path for
 * that refusal because the mock produces it.
 */
export function monthStageOf(key: string): MonthCycleStage {
  return key === currentMonthKey ? 'awaitingRate' : 'published';
}

export function isMonthLocked(key: string): boolean {
  return monthStageOf(key) === 'published';
}

/** Weekday of a Colombo-local day. Midday UTC, so no offset can move it. */
function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/** An ISO timestamp for a Colombo-local wall-clock time on a given day. */
function colomboInstant(date: string, hour: number, minute: number): string {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return new Date(`${date}T${hh}:${mm}:00+05:30`).toISOString();
}

const daysSince = (iso: string | null) =>
  iso === null ? Infinity : (NOW.getTime() - new Date(iso).getTime()) / 86_400_000;

/**
 * The suppliers who actually deliver.
 *
 * Derived from the registry rather than invented alongside it: a dormant supplier
 * (1 in 13, no delivery for 95+ days) must have **no** rows in the last fortnight,
 * or the dormant-suppliers report contradicts the delivery data it is built from.
 */
const supplyingSuppliers = mockSuppliers.filter(
  (supplier) => supplier.status === 'active' && daysSince(supplier.lastDeliveryAt) < 5,
);

function makeDeliveries(): Delivery[] {
  const rows: Delivery[] = [];
  let sequence = 0;

  fixtureDays().forEach((date, dayIndex) => {
    // Sunday: the factory does not weigh. An empty day in the trend is a real
    // day off, not a hole in the fixture — and a chart that skipped it would
    // imply the office lost a day's leaf.
    if (weekdayOf(date) === 0) return;

    // A scale file every fourth day, so the `source` column and the import path
    // both have something in the fixture to show.
    const source = dayIndex % 4 === 0 ? ('scaleFile' as const) : ('manual' as const);

    for (const supplier of supplyingSuppliers) {
      // Not every supplier plucks every day.
      if (random() > 0.62) continue;

      // One in seven brings a second load in the afternoon, which is why
      // `deliveryCount` and `supplierCount` are separate figures.
      const weighings = random() > 0.86 ? 2 : 1;

      for (let index = 0; index < weighings; index += 1) {
        sequence += 1;
        const hour = index === 0 ? intBetween(7, 11) : intBetween(14, 16);
        rows.push({
          id: `del-${sequence}`,
          date,
          monthKey: monthKeyOf(date),
          supplierId: supplier.id,
          supplierCode: supplier.supplierCode,
          supplierName: supplier.name,
          collectionPoint: supplier.collectionPoint,
          kgs: roundKg(between(6, 118)),
          source,
          batchId: `seed-${date}-${supplier.collectionPoint}`,
          recordedById: 'usr-weigher-1',
          recordedByName: 'Sunil Rathnayake',
          recordedAt: colomboInstant(date, hour, intBetween(0, 59)),
          voidedAt: null,
          voidedByName: null,
          voidedReason: null,
        });
      }
    }
  });

  return rows;
}

export const mockDeliveries: Delivery[] = makeDeliveries();

/**
 * One voided row in the fixture.
 *
 * So that the state is visible without anybody having to create it, and so the
 * `includeVoided` filter has something to return. A void is not a delete (§12.1):
 * the row stays, with who withdrew it and why.
 */
const voidable = mockDeliveries.find(
  // In the **open** month, deliberately. A voided row in a published month is a
  // row nothing in the console could have produced, since BR-108 refuses a void
  // there — and a fixture that shows an impossible state teaches the wrong rule.
  (row) => row.monthKey === currentMonthKey && daysSince(row.recordedAt) > 2,
);
if (voidable) {
  voidable.voidedAt = colomboInstant(voidable.date, 17, 30);
  voidable.voidedByName = 'Sunil Rathnayake';
  voidable.voidedReason = 'Weighed twice by mistake — the same sack was recorded on the next line.';
}

// The registry's "last delivery" is the delivery data's, not a separate guess.
for (const supplier of supplyingSuppliers) {
  const latest = mockDeliveries
    .filter((row) => row.supplierId === supplier.id && !row.voidedAt)
    .reduce<string | null>(
      (newest, row) => (newest === null || row.recordedAt > newest ? row.recordedAt : newest),
      null,
    );
  if (latest) supplier.lastDeliveryAt = latest;
}

/* ────────────────────── M4 rates & month close ────────────────────── */

/**
 * The month record, as the mock holds it.
 *
 * The **stage is state, not a calendar calculation**. It has to be: publishing is
 * the one irreversible act in M4, and a stage recomputed from the date would mean
 * a month that was just published reverts on the next request, M3 keeps accepting
 * leaf into it, and the console's most-asked question has two answers.
 */
export interface MonthRecord {
  monthKey: string;
  stage: MonthCycleStage;
  rate: MonthlyRate | null;
  publishedAt: string | null;
  publishedByName: string | null;
  publishedById: string | null;
}

/**
 * Closed months carry a rate and a publisher; the month in progress carries
 * neither.
 *
 * The rates drift a little month to month rather than being one repeated figure —
 * a bill screen showing the same LKR 122.50 for every month reads as a hardcoded
 * placeholder, which is exactly what it would be.
 */
function makeMonths(): Record<string, MonthRecord> {
  const out: Record<string, MonthRecord> = {};

  for (let back = MONTHS_OF_HISTORY - 1; back >= 0; back -= 1) {
    const monthKey = monthKeyBack(back);
    const current = back === 0;

    out[monthKey] = current
      ? {
          monthKey,
          // `awaitingRate` is the honest default: the auction result is not in,
          // which is exactly why every rate-derived figure in the app is blank
          // rather than zero.
          stage: 'awaitingRate',
          rate: null,
          publishedAt: null,
          publishedByName: null,
          publishedById: null,
        }
      : {
          monthKey,
          stage: 'published',
          rate: {
            monthKey,
            ratePerKg: roundMoney(118 + back * 2.25),
            extraRatePerKg: roundMoney(6 + back * 0.5),
            enteredById: 'usr-accountant-1',
            enteredByName: 'Dilani Fonseka',
            enteredAt: daysAgo(back * 30 + 6),
          },
          publishedAt: daysAgo(back * 30 + 4),
          publishedByName: 'Ruwan Jayasuriya',
          publishedById: 'usr-manager-1',
        };
  }

  return out;
}

/** Money rounds to two places (§16) — the same rule the rate schema enforces. */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export const mockMonths: Record<string, MonthRecord> = makeMonths();

export const monthKeys = Object.keys(mockMonths).sort().reverse();

/**
 * The exceptions blocking the current month, **derived from the data** rather than
 * invented beside it.
 *
 * That is the whole point of them: an exception list a developer wrote by hand
 * would say "12 suppliers have no bank details" while the registry said something
 * else, and the accountant would be reconciling the console against itself. Each
 * row here is a query anyone can re-run.
 */
function makeMonthExceptions(): MonthException[] {
  const monthKey = currentMonthKey;
  const out: MonthException[] = [];
  let sequence = 0;

  const push = (
    type: MonthExceptionType,
    entity: MonthException['entity'],
    entityId: string,
    detail: string,
    supplier?: { supplierCode: string; name: string },
    resolved?: { byName: string; note: string },
  ) => {
    sequence += 1;
    out.push({
      id: `exc-${sequence}`,
      monthKey,
      type,
      entity,
      entityId,
      supplierCode: supplier?.supplierCode ?? null,
      supplierName: supplier?.name ?? null,
      detail,
      raisedAt: daysAgo(2),
      resolvedAt: resolved ? daysAgo(1) : null,
      resolvedByName: resolved?.byName ?? null,
      resolutionNote: resolved?.note ?? null,
    });
  };

  // 1. Leaf delivered, nowhere to pay it. The blocker AC-04 is written about.
  const deliveringIds = new Set(
    mockDeliveries.filter((row) => row.monthKey === monthKey && !row.voidedAt).map((row) => row.supplierId),
  );
  for (const supplier of mockSuppliers) {
    if (!supplier.hasBankDetails && deliveringIds.has(supplier.id)) {
      push(
        'missingBankDetails',
        'supplier',
        supplier.id,
        `${supplier.paymentMethod === 'cash' ? 'Paid in cash' : 'No account on file'} — cannot be included in a payout run.`,
        supplier,
      );
    }
  }

  // 2. Leaf recorded against somebody who is not active any more.
  for (const supplier of mockSuppliers) {
    if (supplier.status !== 'active' && deliveringIds.has(supplier.id)) {
      push(
        'inactiveSupplierWithLeaf',
        'supplier',
        supplier.id,
        `Status is ${supplier.status}, but leaf was weighed in this month.`,
        supplier,
      );
    }
  }

  // 3. A pending change request whose outcome would change this month's bill —
  //    a savings rate or a payment method decided after publishing is decided too
  //    late.
  for (const request of mockChangeRequests.filter((r) => r.status === 'pending').slice(0, 3)) {
    push(
      'pendingChangeRequest',
      'changeRequest',
      request.id,
      `${request.type} requested ${request.currentSummary} → ${request.requestedSummary}.`,
      { supplierCode: request.supplierCode, name: request.supplierName },
    );
  }

  // 4. A weighing far outside its day's spread. Not a refusal at entry — the grid
  //    asks and the clerk may confirm — so the month close asks once more, when
  //    there is time to check the slip.
  const month = mockDeliveries.filter((row) => row.monthKey === monthKey && !row.voidedAt);
  const meanKgs = month.length === 0 ? 0 : summariseKgs(month).meanKgs;
  for (const row of month) {
    if (isOutlierKg(row.kgs, meanKgs) && row.kgs > OUTLIER_KG_FLOOR_KG) {
      push(
        'outlierDelivery',
        'delivery',
        row.id,
        `${row.kgs} kg on ${row.date} — more than three times the month's average.`,
        { supplierCode: row.supplierCode, name: row.supplierName },
      );
    }
  }

  // One already resolved, so the resolved filter and the "3 of 11 done" reading
  // have something in the fixture rather than only after a click.
  if (out[0]) {
    out[0].resolvedAt = daysAgo(1);
    out[0].resolvedByName = 'Dilani Fonseka';
    out[0].resolutionNote = 'Bank details collected at the counter and entered on the record.';
  }

  return out;
}

export const mockMonthExceptions: MonthException[] = makeMonthExceptions();

/**
 * A day's leaf, at one collection point or across all of them.
 *
 * Server-composed on purpose: a console adding up the page it happens to be
 * showing would print a total that disagrees with the dashboard and with the
 * month close, because a busy day at one point is more than one page of rows.
 */
export function summariseDay(
  deliveries: Delivery[],
  date: string,
  collectionPoint?: string | null,
  /**
   * The month's stage, passed in rather than derived here.
   *
   * It has to be the *live* one: once M4 publishes a month, every day in it locks
   * (BR-108), and a summary that recomputed the stage from the calendar would keep
   * offering an entry grid the server has started refusing.
   */
  stage?: MonthCycleStage,
): CollectionDaySummary {
  const rows = deliveries.filter(
    (row) =>
      row.date === date &&
      // A voided row is not leaf the factory received, so it counts for nothing.
      !row.voidedAt &&
      (!collectionPoint || row.collectionPoint === collectionPoint),
  );
  const totals = summariseKgs(rows.map((row) => ({ supplierId: row.supplierId, kgs: row.kgs })));
  const month = monthKeyOf(date);
  const monthStage = stage ?? monthStageOf(month);

  return {
    date,
    collectionPoint: collectionPoint ?? null,
    monthKey: month,
    totalKgs: totals.totalKgs,
    supplierCount: totals.supplierCount,
    deliveryCount: totals.rowCount,
    monthStage,
    locked: monthStage === 'published',
  };
}

/* ─────────────────────────────── dashboard ─────────────────────────────── */

/**
 * `today` and `intakeTrend` are **derived from the delivery rows**, not invented
 * beside them.
 *
 * Deliberate, and the reason is the same one that put the dashboard query in the
 * shell rather than the screen: two figures for one fact will disagree, and here
 * the disagreement would be between the number a clerk just entered and the number
 * the dashboard shows them thirty seconds later. Committing a weighing session
 * moves this card, which is the behaviour an integration test can hold onto.
 */
/**
 * One queue card, counted from the records rather than stated beside them.
 *
 * `ageHours` is re-derived from `createdAt` and the stored field ignored on
 * purpose: the seeded value was true when the fixture was built, and a card that
 * reported it would say a queue is inside its target hours after it stopped being.
 */
function queueCountFor(
  queue: QueueKey,
  pending: Array<{ createdAt: string }>,
  now: number = Date.now(),
): QueueCount {
  const oldest = pending.reduce<string | null>(
    (acc, item) => (acc === null || item.createdAt < acc ? item.createdAt : acc),
    null,
  );
  const target = QUEUE_SLA_HOURS[queue];

  return {
    queue,
    pending: pending.length,
    oldestPendingAt: oldest,
    breachingSla: pending.filter(
      (item) => (now - new Date(item.createdAt).getTime()) / 3_600_000 > target,
    ).length,
  };
}

export function buildDashboard(
  changeRequests: AdminChangeRequest[],
  deliveries: Delivery[],
  creditRequests: AdminCreditRequest[],
  inquiries: AdminInquiry[],
  /**
   * v2's collections, passed in rather than read off the module.
   *
   * The four above were already parameters and these follow the same rule for the same
   * reason: this function is called with **live state**, not with the fixtures, so
   * reaching for `mockBanners` here would compute a dashboard from the seed while every
   * other screen showed the mutated copy — a disagreement visible on one screen.
   */
  v2: {
    teaPacketRequests: AdminTeaPacketRequest[];
    news: NewsRecord[];
    banners: BannerRecord[];
    staticPages: StaticPageRecord[];
    devicesBySupplier: Record<string, RegisteredDevice[]>;
    contentLanguages: readonly LanguageCode[];
  },
): DashboardSummary {
  const pending = changeRequests.filter((r) => r.status === 'pending');
  const pendingCredit = creditRequests.filter((r) => r.status === 'pending');
  const openInquiries = inquiries.filter((i) => i.status === 'open');
  const pendingTeaPackets = v2.teaPacketRequests.filter((r) => r.status === 'pending');

  // Oldest first — charts read left to right (§4 of the contract).
  const intakeTrend = Array.from({ length: COLLECTION_DAYS }, (_, i) => {
    const date = colomboDayOf(new Date(NOW.getTime() - (COLLECTION_DAYS - 1 - i) * 86_400_000));
    return { date, totalKgs: summariseDay(deliveries, date).totalKgs };
  });

  const today = summariseDay(deliveries, TODAY);
  const yesterday = summariseDay(deliveries, colomboDayOf(new Date(NOW.getTime() - 86_400_000)));

  /**
   * Every count derived from the records behind it.
   *
   * The four non-M9 queues were hardcoded here while M7 and M10 did not exist,
   * which was honest then and became a lie the moment they did: the sidebar badge
   * and the card would have said seven advances while the queue showed four. Two
   * figures for one fact, and the disagreement visible on one screen.
   */
  const queues: QueueCount[] = [
    queueCountFor('changeRequests', pending),
    queueCountFor('advanceRequests', pendingCredit.filter((r) => r.facility === 'advance')),
    queueCountFor('loanRequests', pendingCredit.filter((r) => r.facility === 'loan')),
    queueCountFor('manureRequests', pendingCredit.filter((r) => r.facility === 'manure')),
    queueCountFor('teaPacketRequests', pendingTeaPackets),
    queueCountFor('inquiries', openInquiries),
  ];

  /* ── v2's lead figures ─────────────────────────────────────────────────── */

  const activeSuppliers = mockSuppliers.filter((one) => one.status !== 'closed');
  const suppliersWithApp = Object.entries(v2.devicesBySupplier).filter(
    ([, devices]) => devices.length > 0,
  ).length;
  const devicesRegistered = Object.values(v2.devicesBySupplier).reduce(
    (sum, devices) => sum + devices.length,
    0,
  );

  /**
   * The channel split, over every request the app can raise.
   *
   * All four kinds together rather than per module, because §19.3's KPI is about the
   * *supplier's* habit — somebody who asks for an advance in the app and walks in about
   * their bank details has half adopted it. `null` rather than `0` when nothing was
   * raised at all (BR-102).
   */
  const shareOf = (rows: Array<{ channel: RequestChannel; createdAt: string }>, monthKey: string) => {
    const inMonth = rows.filter((row) => row.createdAt.slice(0, 7) === monthKey);
    if (inMonth.length === 0) return null;
    return round2(inMonth.filter((row) => row.channel === 'app').length / inMonth.length);
  };

  const allRequests = [
    ...changeRequests.map((r) => ({ channel: r.channel, createdAt: r.createdAt })),
    ...creditRequests.map((r) => ({ channel: r.channel, createdAt: r.createdAt })),
    ...v2.teaPacketRequests.map((r) => ({ channel: r.channel, createdAt: r.createdAt })),
    ...inquiries.map((r) => ({ channel: r.channel, createdAt: r.createdAt })),
  ];

  const nowIso = NOW.toISOString();

  /**
   * Content that is quietly wrong.
   *
   * Only **published** records count. A draft with no Sinhala is unfinished work, not a
   * supplier reading the wrong language, and counting it here would fill the card with
   * rows nobody needs to act on — which is how an office learns to ignore the card.
   */
  const articlesWithGaps = v2.news.filter(
    (record) =>
      record.status === 'published' &&
      missingTranslations(record.translations, v2.contentLanguages).some(
        (lang) => lang !== EDITORIAL_FALLBACK_LANGUAGE,
      ),
  ).length;

  const publishedBanners = v2.banners.filter((one) => one.status === 'published');

  return {
    queues,

    app: {
      suppliersWithApp,
      totalSuppliers: activeSuppliers.length,
      devicesRegistered,
      appRequestShare: shareOf(allRequests, currentMonthKey),
    },

    content: {
      articlesWithGaps,
      bannersLive: publishedBanners.filter((one) => bannerWindowState(one, nowIso) === 'live')
        .length,
      /**
       * Published and finished. Its own figure rather than folded into "not live", because
       * it is the state that catches an office out: every badge says published, and no
       * supplier has seen it for a fortnight.
       */
      bannersExpired: publishedBanners.filter(
        (one) => bannerWindowState(one, nowIso) === 'expired',
      ).length,
      staticPagesUnwritten: v2.staticPages.filter(
        (page) => !isWritten(page.translations[EDITORIAL_FALLBACK_LANGUAGE]),
      ).length,
    },

    // Twelve months, oldest first. A month with no requests carries `null` rather than a
    // zero, so the line breaks rather than dropping to the floor.
    adoptionTrend: Array.from({ length: 12 }, (_, i) => {
      const monthKey = monthKeyBack(11 - i);
      return { monthKey, appShare: shareOf(allRequests, monthKey) };
    }),
    cycle: {
      monthKey: currentMonthKey,
      /**
       * `awaitingRate` is the honest default: the month in progress has no
       * auction result, which is what makes every rate-derived field `null`.
       */
      stage: monthStageOf(currentMonthKey),
      openExceptions: suppliersMissingBankDetails,
      ratePerKg: null,
      extraRatePerKg: null,
      publishedAt: null,
      publishedByName: null,
    },
    today: {
      date: today.date,
      totalKgs: today.totalKgs,
      supplierCount: today.supplierCount,
      deliveryCount: today.deliveryCount,
      previousDayKgs: yesterday.totalKgs,
    },
    alerts: [
      {
        id: 'alert-missing-bank',
        severity: 'warning',
        messageKey: 'dashboard.alert.missingBankDetails',
        params: { count: suppliersMissingBankDetails },
        href: '/suppliers?hasBankDetails=false',
      },
      {
        id: 'alert-sla',
        severity: 'error',
        messageKey: 'dashboard.alert.slaBreach',
        // The card's own figure, not a second count of the same thing.
        params: { count: queues[0]!.breachingSla },
        href: '/change-requests?status=pending',
      },
      {
        id: 'alert-awaiting-rate',
        severity: 'info',
        messageKey: 'dashboard.alert.awaitingRate',
        params: { month: currentMonthKey },
      },
    ],
    intakeTrend,
  };
}

/* ────────────────────────────── tenant config ────────────────────────────── */

/**
 * What `GET /config` returns per tenant.
 *
 * `highland` deliberately runs a **reduced feature set** — no loans, no manure,
 * no push — mirroring mobile's `clientB`. Switching tenants in the dev switcher
 * should visibly empty those queues out of the sidebar, which is the fastest way
 * to check that no surface is hardcoded.
 */
/**
 * The fertilizer a factory sells on credit (§21.10).
 *
 * One list, feeding **both** the tenants' catalogues below and M7's request fixtures — so a
 * queue can never name a type the configuration screen does not offer.
 */
const MANURE_PRODUCTS = [
  { name: 'Urea', packKg: 50, pricePerPack: 8500 },
  { name: 'T200 mixture', packKg: 50, pricePerPack: 9200 },
  { name: 'Dolomite', packKg: 50, pricePerPack: 3400 },
  { name: 'Eppawala rock phosphate', packKg: 50, pricePerPack: 4100 },
] as const;

/** The names alone, for the request fixtures that only pick a type. */
const MANURE_TYPES = MANURE_PRODUCTS.map((one) => one.name);

export const mockConfigs: Record<string, RuntimeConfig> = {
  galaboda: {
    tenantId: 'galaboda',
    factory: {
      name: 'Galaboda Tea Factory',
      telephone: '041-2283282',
      regNo: 'M.F. 1041',
      location: 'Akuressa, Sri Lanka',
      supportEmail: 'office@galabodatea.lk',
      supportHours: 'Mon–Sat, 8:00am – 5:00pm',
      legalFooter:
        'Issued under the Tea Control Act No. 51 of 1957. Retain this account for your records.',
    },
    // The full-feature reference: every flag on, so a screen that is hidden here is
    // hidden by a bug rather than by configuration.
    flags: {
      enableSavings: true,
      enableAdvances: true,
      enableLoans: true,
      enableManure: true,
      enableTeaPackets: true,
      enableInquiry: true,
      enableNews: true,
      enablePushNotifications: true,
      enablePromoBanner: true,
      enableOnboarding: true,
      enableBiometricLogin: true,
      enableDarkModeToggle: true,
      enableProfileTab: true,
      enableAutoLock: true,
    },
    savings: { perKgOptions: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50] },
    // §21.10: the same list M7's requests are drawn from, so the catalogue and the queue
    // cannot name different fertilizers.
    manureProducts: MANURE_PRODUCTS.map((one) => ({ ...one })),
    banks: BANKS.map((b) => ({ name: b.name, branches: [...b.branches] })),
    localization: {
      defaultLanguage: 'en',
      supportedLanguages: ['si', 'en', 'ta'],
      contentLanguages: ['si', 'en', 'ta'],
    },
    theme: {
      colors: {
        light: { primary: '#2E8B57', primaryMuted: '#DCEEE2', secondary: '#8FC13F' },
        dark: { primary: '#5FBE7E', primaryMuted: '#123222', secondary: '#A6D45C' },
      },
    },
    branding: {},
    push: {
      topicPrefix: 'galaboda',
      categories: ['billPublished', 'requestDecided', 'newsArticle', 'inquiryReplied'],
      defaultCategories: ['billPublished', 'requestDecided', 'inquiryReplied'],
    },
    collectionPoints: COLLECTION_POINTS.map((p) => ({ id: p.id, name: p.name })),
  },

  hillcountry: {
    tenantId: 'hillcountry',
    factory: {
      name: 'Hill Country Tea Factory (Pvt) Ltd',
      telephone: '+94 51 223 4567',
      regNo: 'PV 78210',
      location: 'Hatton, Sri Lanka',
      supportEmail: 'office@hillcountrytea.lk',
      supportHours: 'Mon–Sat, 7:30am – 4:30pm',
    },
    flags: {
      enableSavings: true,
      enableAdvances: true,
      enableLoans: true,
      enableManure: true,
      enableTeaPackets: true,
      enableInquiry: true,
      enableNews: true,
      enablePushNotifications: true,
      enablePromoBanner: false,
      enableOnboarding: true,
      enableBiometricLogin: true,
      enableDarkModeToggle: false,
      enableProfileTab: true,
      enableAutoLock: true,
    },
    savings: { perKgOptions: [0, 10, 20, 30, 40] },
    manureProducts: MANURE_PRODUCTS.map((one) => ({ ...one })),
    banks: BANKS.slice(0, 3).map((b) => ({ name: b.name, branches: [...b.branches] })),
    localization: {
      defaultLanguage: 'en',
      supportedLanguages: ['si', 'en', 'ta'],
      contentLanguages: ['si', 'en', 'ta'],
    },
    theme: {
      colors: {
        light: { primary: '#1B5E20', primaryMuted: '#D8E8D9', secondary: '#C9A227' },
        dark: { primary: '#66BB6A', primaryMuted: '#12321A', secondary: '#E0C158' },
      },
      radius: { md: 12, lg: 18 },
    },
    branding: {},
    collectionPoints: [
      { id: 'cp-hatton', name: 'HATTON' },
      { id: 'cp-dickoya', name: 'DICKOYA' },
    ],
  },

  highland: {
    tenantId: 'highland',
    factory: {
      name: 'Highland Estate Tea',
      telephone: '+94 52 222 8899',
      regNo: 'PV 91044',
      location: 'Nuwara Eliya, Sri Lanka',
      supportEmail: 'office@highlandestate.lk',
    },
    /**
     * Reduced feature set: no credit against income history, no fertilizer on
     * credit, no push. The sidebar must lose those rows entirely.
     *
     * **And no payouts**, which is the only tenant in the fixture with a
     * console-side surface turned off. A small estate that counts cash out at the
     * counter buys no bank-file module — and until one tenant had the flag off, the
     * API half of AC-07 ("a flag off removes the surface *and* the endpoint
     * refuses") had nothing to be tested against.
     */
    flags: {
      enableSavings: true,
      enableAdvances: true,
      enableLoans: false,
      enableManure: false,
      // The reduced-feature reference gains a fifth empty row in v2: no tea packets, so
      // switching to `highland` in the dev switcher should visibly drop M18 out of the
      // sidebar. That is still the fastest way to check nothing is hardcoded.
      enableTeaPackets: false,
      enableInquiry: true,
      enableNews: false,
      enablePushNotifications: false,
      enablePromoBanner: false,
      // App-only, and deliberately not all-off: a tenant with every app flag false would
      // be a phone with almost no screens, which tests nothing anybody ships.
      enableOnboarding: false,
      enableBiometricLogin: false,
      enableDarkModeToggle: false,
      enableProfileTab: true,
      enableAutoLock: true,
    },
    savings: { perKgOptions: [0, 15, 30] },
    banks: BANKS.slice(0, 2).map((b) => ({ name: b.name, branches: [...b.branches] })),
    localization: {
      defaultLanguage: 'en',
      supportedLanguages: ['en', 'ta'],
      contentLanguages: ['en', 'ta'],
    },
    theme: {
      colors: {
        light: { primary: '#00695C', primaryMuted: '#CDE5E1', secondary: '#FFB300' },
        dark: { primary: '#4DB6AC', primaryMuted: '#0E2E2B', secondary: '#FFCA45' },
      },
    },
    branding: {},
    collectionPoints: [{ id: 'cp-nuwaraeliya', name: 'NUWARA ELIYA' }],
  },
};

export const MOCK_TENANT_IDS = Object.keys(mockConfigs);

/* ────────────────────────────── M5 Bills ────────────────────────────── */

/**
 * The factory identity printed on a bill.
 *
 * Read from the tenant config rather than restated, because it is the same
 * `FactoryInfo` the app renders on the supplier's own copy of the slip (AC-03) —
 * two sources for a registration number is two documents that disagree.
 */
export const billFactoryOf = (tenantId: string): FactoryInfo =>
  (mockConfigs[tenantId] ?? mockConfigs.galaboda!).factory;

const supplierIndexOf = (id: string) => Number(id.replace('sup-', '')) || 0;

const daysInMonth = (monthKey: string): number => {
  const [year, month] = monthKey.split('-').map(Number);
  return year && month ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 31;
};

/**
 * The nine deduction lines held against one month's account.
 *
 * **The values here stand in for a policy decision that has not been made.**
 * §21.10 — which lines the office may set per supplier per month, and who may set
 * them — is unanswered, so the console offers no editor for these and the mock
 * derives them deterministically from the supplier record. What is *not* a
 * placeholder is the shape: nine lines in the printed slip's order, with the total
 * recomputed from them rather than stated alongside them (BR-107).
 *
 * Two of them are real derivations the API must reproduce rather than invent:
 *
 *  - **`savings`** is `kilos × the supplier's approved rate`. It is also M8's only
 *    inbound movement, so a different figure here would be a savings balance that
 *    disagrees with the bill it came from.
 *  - **`previousDebts`** is last month's unpaid balance. It is what makes a debt
 *    actually carry rather than quietly vanish at the month boundary.
 */
/**
 * The nine lines, and **who decides each one** (§21.10, as the factory answered it).
 *
 * | Line | Decided by |
 * | --- | --- |
 * | `transportCharges`, `stamps` | The factory's rates — manager, second-person approved |
 * | `loansAdvance`, `advance`, `manure` | The supplier's repayment period, under the factory's cap |
 * | `savings` | The supplier, through M9 |
 * | `previousDebts` | Derived from last month |
 * | `tea` | The supplier asks, from the app — **not built here yet** |
 * | `otherCards` | **Still unanswered.** §21.10 remains open for this one line |
 *
 * The last two are still the fixture's invention, and they are the only two left.
 */
function deductionLinesFor(
  supplier: AdminSupplier,
  totalKgs: number,
  grossAmount: number,
  previousDebts: number,
  rates: DeductionRates,
  plans: Partial<Record<CreditFacility, RepaymentPlan>> = {},
): DeductionLines {
  const index = supplierIndexOf(supplier.id);

  const instalment = (facility: CreditFacility, balance: number) =>
    creditInstalment(balance, grossAmount, rates.instalmentShares[facility], plans[facility]);

  return {
    transportCharges: round2(totalKgs * rates.transportPerKg),
    // Made tea issued against the account. The supplier asks for this from the app
    // (§21.10) and that request type is not built, so the figure is still the fixture's.
    tea: index % 5 === 0 ? 450 : 0,
    savings: savingsDeductionFor(totalKgs, supplier.savingsPerKg),
    loansAdvance: instalment('loan', supplier.creditBalances.loan),
    advance: instalment('advance', supplier.creditBalances.advance),
    manure: instalment('manure', supplier.creditBalances.manure),
    // The one line nobody has explained. Still invented, and still §21.10.
    otherCards: index % 7 === 0 ? 260 : 0,
    stamps: rates.stamps,
    previousDebts,
  };
}

/** Everything a run needs to recompute a month's bills. */
export interface BillGenerationContext {
  monthKey: string;
  runId: string;
  generatedAt: string;
  generatedById: string;
  generatedByName: string;
  /** Non-null only for a month that is already published. */
  publishedAt: string | null;
  deliveries: Delivery[];
  suppliers: AdminSupplier[];
  rate: MonthlyRate | null;
  factory: FactoryInfo;
  /** Cents the previous account could not pay in whole rupees, per supplier id. */
  coinsBroughtForward: Map<string, number>;
  /** Unpaid balance carried from the previous account, per supplier id. */
  debtBroughtForward: Map<string, number>;
  /** Savings balance as at the start of this month, per supplier id. */
  savingsBefore: Map<string, number>;
  /**
   * Savings asked back and not yet settled, per supplier (§21.9).
   *
   * Optional because the seed's own historical months predate any withdrawal — a bill
   * generated for a month nobody asked in simply carries `0`.
   */
  savingsWithdrawals?: Map<string, number>;
  /** The factory's approved deduction rates (§21.10). Defaulted for a run before any were set. */
  deductionRates?: DeductionRates;
  /** Repayment periods the suppliers chose, per facility. Absent → the cap alone. */
  repaymentMonths?: Map<string, Partial<Record<CreditFacility, RepaymentPlan>>>;
}

/**
 * Recompute a month's bills from the leaf and the rate.
 *
 * Shared between the fixture and the `generate` handler on purpose: the bills a
 * developer sees on first load and the ones the office produces by clicking must
 * be the same objects, or the screen is tested against something the API never
 * returns.
 *
 * Ordered by supplier code, which is also the order bill numbers are handed out
 * in — the office reads a run down the same column the paper ledgers were kept in,
 * and a re-run must not renumber everybody because one supplier stopped plucking.
 */
export function generateBills(context: BillGenerationContext): AdminBill[] {
  const rows = context.deliveries.filter(
    (row) => row.monthKey === context.monthKey && !row.voidedAt,
  );

  const bySupplier = new Map<string, Delivery[]>();
  for (const row of rows) {
    const list = bySupplier.get(row.supplierId);
    if (list) list.push(row);
    else bySupplier.set(row.supplierId, [row]);
  }

  /**
   * Everyone with leaf this month — **and everyone owed a savings withdrawal** (§21.9).
   *
   * That second clause is a direct consequence of the factory's answer that a withdrawal is
   * paid on the next bill: a supplier who asked for their savings and happened to pluck
   * nothing that month would otherwise have no account for it to be paid on, and the money
   * would sit unpaid with nothing on any screen to explain why. Their slip reads zero kilos
   * and one payment, which is exactly what happened.
   */
  const suppliers = context.suppliers
    .filter(
      (supplier) =>
        bySupplier.has(supplier.id) || (context.savingsWithdrawals?.get(supplier.id) ?? 0) > 0,
    )
    .sort((a, b) => a.supplierCode.localeCompare(b.supplierCode));

  const dayCount = daysInMonth(context.monthKey);

  return suppliers.map((supplier, index) => {
    // May be empty: a supplier included only because they are owed a withdrawal.
    const deliveries = bySupplier.get(supplier.id) ?? [];
    const totalKgs = summariseKgs(deliveries).totalKgs;

    /**
     * The day grid the slip prints.
     *
     * Every day of the month is present, with `null` where nothing was weighed —
     * `null` rather than `0`, because a day the supplier did not pluck and a day
     * they brought nothing are the same thing on paper and neither is a zero the
     * office would have to explain (BR-102).
     */
    const perDay = new Map<number, number>();
    for (const row of deliveries) {
      const day = Number(row.date.slice(8, 10));
      perDay.set(day, roundKg((perDay.get(day) ?? 0) + row.kgs));
    }
    const dailySupply = Array.from({ length: dayCount }, (_, i) => ({
      day: i + 1,
      kgs: perDay.get(i + 1) ?? null,
    }));

    // Computed the same way `computeBillAmounts` will, purely so the credit
    // instalments have a gross to be capped against.
    const grossEstimate = context.rate
      ? round2(
          round2(totalKgs * context.rate.ratePerKg) +
            round2(totalKgs * context.rate.extraRatePerKg),
        )
      : 0;

    const coinsBroughtForward = round2(context.coinsBroughtForward.get(supplier.id) ?? 0);
    const deductions = deductionLinesFor(
      supplier,
      totalKgs,
      grossEstimate,
      round2(context.debtBroughtForward.get(supplier.id) ?? 0),
      context.deductionRates ?? DEFAULT_DEDUCTION_RATES,
      context.repaymentMonths?.get(supplier.id),
    );

    /**
     * Savings asked back and not yet paid (§21.9).
     *
     * The fixture seeds none, and that is the honest default: withdrawals open in one month
     * a year, so most months' bills carry `0` here. The path is exercised by the tests and
     * by anybody who records one on the savings screen during the window.
     */
    const savingsWithdrawal = round2(context.savingsWithdrawals?.get(supplier.id) ?? 0);

    const amounts = computeBillAmounts({
      totalKgs,
      ratePerKg: context.rate?.ratePerKg ?? null,
      extraRatePerKg: context.rate?.extraRatePerKg ?? null,
      coinsBroughtForward,
      savingsWithdrawal,
      deductions,
    });

    const savingsPrevious = round2(context.savingsBefore.get(supplier.id) ?? 0);

    return {
      id: `bill-${context.monthKey}-${supplier.id}`,
      supplierId: supplier.id,
      runId: context.runId,
      generatedAt: context.generatedAt,
      generatedByName: context.generatedByName,
      publishedAt: context.publishedAt,
      hasBankDetails: supplier.hasBankDetails,

      factory: context.factory,
      supplierCode: supplier.supplierCode,
      supplierName: supplier.name,
      billNo: billNumberFor(context.monthKey, index + 1),
      billDateTime: context.generatedAt,
      month: slipMonthLabel(context.monthKey),
      monthKey: context.monthKey,
      year: Number(context.monthKey.slice(0, 4)),

      auctionResultAvailable: amounts.auctionResultAvailable,
      ratePerKg: context.rate?.ratePerKg ?? null,
      extraRatePerKg: context.rate?.extraRatePerKg ?? null,
      totalRatePerKg: amounts.totalRatePerKg,
      totalKgs,

      coinsBroughtForward,
      savingsWithdrawal,
      greenLeafAmount: amounts.greenLeafAmount,
      extraPayment: amounts.extraPayment,
      grossAmount: amounts.grossAmount,

      deductions: amounts.deductions,

      balanceAmount: amounts.balanceAmount,
      coinsCarriedForward: amounts.coinsCarriedForward,
      finalBalance: amounts.finalBalance,

      carryForward: {
        nextMonthDeb: amounts.nextMonthDeb,
        // Slip wording: this line is the **advance** balance (§9.4), which is why
        // it is not simply `creditBalances.loan`.
        loanBalance: round2(
          Math.max(0, supplier.creditBalances.advance - amounts.deductions.advance),
        ),
        manureBalance: round2(
          Math.max(0, supplier.creditBalances.manure - amounts.deductions.manure),
        ),
        loanInterest: round2(supplier.creditBalances.loan * 0.01),
      },
      savingsSummary: {
        thisMonth: amounts.deductions.savings,
        previous: savingsPrevious,
        toDate: round2(savingsPrevious + amounts.deductions.savings),
      },

      dailySupply,
      paymentMethod: supplier.paymentMethod,
    } satisfies AdminBill;
  });
}

/** A run as the mock holds it. `stale` is recomputed on read, never stored. */
export type BillRunRecord = Omit<BillRun, 'stale'>;

/** The run summary for a set of bills. */
export function summariseBillRun(
  monthKey: string,
  runId: string,
  bills: AdminBill[],
  meta: { generatedAt: string; generatedById: string; generatedByName: string },
): BillRunRecord {
  return {
    runId,
    monthKey,
    ...meta,
    billCount: bills.length,
    totalKgs: roundKg(bills.reduce((sum, bill) => sum + bill.totalKgs, 0)),
    grossTotal: round2(bills.reduce((sum, bill) => sum + (bill.grossAmount ?? 0), 0)),
    deductionsTotal: round2(bills.reduce((sum, bill) => sum + bill.deductions.total, 0)),
    payableTotal: round2(bills.reduce((sum, bill) => sum + (bill.finalBalance ?? 0), 0)),
    savingsTotal: round2(bills.reduce((sum, bill) => sum + bill.deductions.savings, 0)),
    carryingDebt: bills.filter((bill) => (bill.finalBalance ?? 0) <= 0).length,
    // Payable, with nowhere to pay it. The AC-04 blocker seen from the other end:
    // M4 raises it as an exception, and this is what it costs if it is waved through.
    missingBankDetails: bills.filter(
      (bill) => (bill.finalBalance ?? 0) > 0 && !bill.hasBankDetails,
    ).length,
  };
}

/* ───────────────────────────── M6 Payouts ───────────────────────────── */

/**
 * Does this payment method need a bank account to move money?
 *
 * Cheque and cash are handed over at the counter, so a missing account number does
 * not stop them. A transfer without one is a line that cannot be paid — and it is
 * **held**, not dropped: a supplier quietly filtered out of a run is a supplier who
 * is not paid and nobody notices until they telephone.
 */
export const methodNeedsAccount = (method: PaymentMethod): boolean => method === 'bankTransfer';

/**
 * The lines a run would carry.
 *
 * Only **payable** bills become lines. A zero or negative account is not a payment
 * of nothing — it is an account that carries its shortfall forward (`nextMonthDeb`),
 * and a bank file cannot express a negative transfer or a cheque be written for it.
 */
export function buildPayoutLines(
  runId: string,
  method: PaymentMethod,
  bills: AdminBill[],
  suppliers: AdminSupplier[],
  sequence: () => string,
): PayoutLine[] {
  return bills
    .filter((bill) => bill.paymentMethod === method)
    .filter((bill) => (bill.finalBalance ?? 0) > 0)
    .map((bill) => {
      const supplier = suppliers.find((candidate) => candidate.id === bill.supplierId);
      const held = methodNeedsAccount(method) && !supplier?.hasBankDetails;

      return {
        id: `pol-${sequence()}`,
        runId,
        billId: bill.id,
        supplierId: bill.supplierId,
        supplierCode: bill.supplierCode,
        supplierName: bill.supplierName,
        // Copied from the bill, never re-derived: the bill is the record the
        // supplier holds, and a second derivation is a second answer.
        amount: bill.finalBalance!,
        method,
        // Masked at the source (§20.4) — the full number is M2's audited reveal.
        bankName: supplier?.bankDetails?.bankName ?? null,
        branchName: supplier?.bankDetails?.branchName ?? null,
        accountNumber: supplier?.bankDetails?.accountNumber ?? null,
        status: held ? 'held' : 'pending',
        reason: held ? 'No account on file — collect the passbook before paying.' : null,
        paidAt: null,
        markedByName: null,
      } satisfies PayoutLine;
    });
}

/** The counts and totals on a run, derived from its lines rather than stored. */
export function summarisePayoutRun(run: PayoutRun, lines: PayoutLine[]): PayoutRun {
  const payable = lines.filter((line) => line.status !== 'held');
  const paid = lines.filter((line) => line.status === 'paid');

  return {
    ...run,
    lineCount: lines.length,
    payableCount: payable.length,
    heldCount: lines.filter((line) => line.status === 'held').length,
    paidCount: paid.length,
    failedCount: lines.filter((line) => line.status === 'failed').length,
    // Held lines are excluded: they are not money leaving the factory.
    totalAmount: round2(payable.reduce((sum, line) => sum + line.amount, 0)),
    paidAmount: round2(paid.reduce((sum, line) => sum + line.amount, 0)),
  };
}

/* ───────────────────────────── M8 Savings ───────────────────────────── */

/**
 * The savings ledger, **derived from published bills**.
 *
 * There is no second write path, and that is the module's load-bearing decision: a
 * contribution *is* the `savings` deduction on a published bill. A ledger the
 * office could also post to directly would be a balance that disagrees with the
 * bills it was supposedly built from, and the disagreement would surface when a
 * supplier asks why their passbook and their slip differ.
 *
 * Oldest first, which is part of the wire contract (types/app.ts): a passbook is
 * read forward, and a running balance only means something in the order it
 * accumulated.
 */
export function buildSavingsLedger(
  suppliers: AdminSupplier[],
  bills: AdminBill[],
  openingBalances: Map<string, number>,
): AdminSavingsLedgerEntry[] {
  const entries: AdminSavingsLedgerEntry[] = [];
  let sequence = 0;

  const published = bills
    .filter((bill) => bill.publishedAt !== null && bill.deductions.savings > 0)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  const bySupplier = new Map<string, AdminBill[]>();
  for (const bill of published) {
    const list = bySupplier.get(bill.supplierId);
    if (list) list.push(bill);
    else bySupplier.set(bill.supplierId, [bill]);
  }

  for (const supplier of suppliers) {
    const opening = round2(openingBalances.get(supplier.id) ?? 0);
    let balance = opening;

    if (opening > 0) {
      sequence += 1;
      entries.push({
        id: `sav-${sequence}`,
        supplierId: supplier.id,
        // The opening sits in the month before the fixture's first, because it is
        // what the passbook already said when this history starts.
        monthKey: monthKeyBack(MONTHS_OF_HISTORY),
        month: slipMonthLabel(monthKeyBack(MONTHS_OF_HISTORY)),
        amount: opening,
        balance,
        source: 'openingBalance',
        billId: null,
        recordedAt: daysAgo(MONTHS_OF_HISTORY * 30 + 5),
        note: 'Balance carried in from the passbook.',
      });
    }

    for (const bill of bySupplier.get(supplier.id) ?? []) {
      balance = round2(balance + bill.deductions.savings);
      sequence += 1;
      entries.push({
        id: `sav-${sequence}`,
        supplierId: supplier.id,
        monthKey: bill.monthKey,
        month: bill.month,
        amount: bill.deductions.savings,
        balance,
        source: 'billDeduction',
        billId: bill.id,
        recordedAt: bill.publishedAt!,
        note: null,
      });
    }
  }

  return entries;
}

/* ──────────────── the fixture's bill, payout and savings history ──────────────── */

/**
 * Generate the history the money modules need to have anything to show.
 *
 * Chronological and **chained**, which is the whole reason it is one function
 * rather than three independent fixtures: this month's `previousDebts` is last
 * month's unpaid balance, this month's `coinsBroughtForward` is last month's
 * remainder, and this month's savings `previous` is the running balance. A fixture
 * that generated each month independently would show three months that do not add
 * up — and "the carried figures do not tie" is precisely the bug M5 exists to make
 * impossible.
 */
function seedMoneyHistory() {
  const bills: AdminBill[] = [];
  const runs: BillRunRecord[] = [];

  const coins = new Map<string, number>();
  const debts = new Map<string, number>();
  const savings = new Map<string, number>();

  /**
   * A few suppliers start the fixture already owing the factory.
   *
   * Not decoration: **an account that owes more than it earned is the state a payout
   * run must never turn into a negative bank line**, and nothing else in the fixture
   * reaches it. The proportional deductions cannot — a credit instalment is capped as
   * a share of the gross precisely so a facility cannot swallow a whole month — so the
   * only honest route to it is a debt carried in from before this history starts.
   *
   * Sized to take several months of leaf to work off, which is what a large advance
   * against income actually looks like, and which keeps the state visible in the
   * newest published month rather than only the oldest.
   *
   * **Sized from the window, not as a fixed figure.** A credit instalment is capped
   * as a share of the gross, so a debt is worked off at roughly a month's leaf per
   * month — which means a flat figure that survived a four-month fixture is fully
   * repaid by a seven-month one, and `carriesDebt` quietly stops being reachable in
   * the newest month. Deriving it from `MONTHS_OF_HISTORY` keeps the *intent*
   * (still owing at the end) true whatever the window becomes.
   */
  const openingDebt = 130_000 * (MONTHS_OF_HISTORY - 1);
  for (const supplier of mockSuppliers) {
    if (supplierIndexOf(supplier.id) % 19 !== 0) continue;
    debts.set(supplier.id, openingDebt + supplierIndexOf(supplier.id) * 1_000);
  }

  /**
   * The savings balance the registry already carries is treated as the **opening**
   * balance, not as an independent figure.
   *
   * `mockSuppliers[].savingsBalance` is then recomputed from the ledger below, so
   * M2's detail page and M8's account row are the same number. Two figures for one
   * balance is the exact inconsistency AC-01 is about.
   */
  const openingBalances = new Map(
    mockSuppliers.map((supplier) => [supplier.id, supplier.savingsBalance]),
  );
  for (const [id, balance] of openingBalances) savings.set(id, balance);

  const publishedKeys = monthKeys
    .filter((key) => mockMonths[key]?.stage === 'published')
    .sort();

  for (const monthKey of publishedKeys) {
    const record = mockMonths[monthKey]!;
    const runId = `run-${monthKey}`;
    const generatedAt = record.publishedAt
      ? new Date(new Date(record.publishedAt).getTime() - 3_600_000).toISOString()
      : daysAgo(30);

    const monthBills = generateBills({
      monthKey,
      runId,
      generatedAt,
      generatedById: 'usr-accountant-1',
      generatedByName: 'Dilani Fonseka',
      publishedAt: record.publishedAt,
      deliveries: mockDeliveries,
      suppliers: mockSuppliers,
      rate: record.rate,
      factory: billFactoryOf('galaboda'),
      coinsBroughtForward: coins,
      debtBroughtForward: debts,
      savingsBefore: savings,
    });

    for (const bill of monthBills) {
      coins.set(bill.supplierId, bill.coinsCarriedForward);
      debts.set(bill.supplierId, bill.carryForward.nextMonthDeb);
      savings.set(bill.supplierId, bill.savingsSummary.toDate);
    }

    bills.push(...monthBills);
    runs.push(
      summariseBillRun(monthKey, runId, monthBills, {
        generatedAt,
        generatedById: 'usr-accountant-1',
        generatedByName: 'Dilani Fonseka',
      }),
    );
  }

  const ledger = buildSavingsLedger(mockSuppliers, bills, openingBalances);

  // The registry's balance is the ledger's, not a second guess at it.
  const finalBalances = new Map<string, number>();
  for (const entry of ledger) finalBalances.set(entry.supplierId, entry.balance);
  for (const supplier of mockSuppliers) {
    supplier.savingsBalance = round2(finalBalances.get(supplier.id) ?? supplier.savingsBalance);
  }

  return { bills, runs, ledger, latestPublished: publishedKeys.at(-1) ?? null };
}

const history = seedMoneyHistory();

export const mockBills: AdminBill[] = history.bills;
export const mockBillRuns: BillRunRecord[] = history.runs;
export const mockSavingsLedger: AdminSavingsLedgerEntry[] = history.ledger;

/**
 * Payout runs for the two most recent published months.
 *
 * Two, and in different states, because every status has to be reachable without
 * anybody having to create it first: the older month is **completed** (what a
 * finished run looks like), the latest is **approved** with a mix of paid, pending
 * and failed lines (what a run being worked looks like), and its cheque run is left
 * as a **draft** awaiting a manager. `held` arrives on its own, from the suppliers
 * marked for transfer with no account on file.
 */
function seedPayoutRuns() {
  const runs: PayoutRun[] = [];
  const lines: PayoutLine[] = [];
  let sequence = 0;
  const nextSequence = () => String((sequence += 1));

  const publishedKeys = monthKeys
    .filter((key) => mockMonths[key]?.stage === 'published')
    .sort()
    .reverse();
  const [latest, previous] = publishedKeys;

  const add = (
    monthKey: string,
    method: PaymentMethod,
    status: PayoutRun['status'],
    ageDays: number,
  ) => {
    const id = `pay-${monthKey}-${method}`;
    const monthBills = mockBills.filter((bill) => bill.monthKey === monthKey);
    const runLines = buildPayoutLines(id, method, monthBills, mockSuppliers, nextSequence);
    if (runLines.length === 0) return;

    const approved = status !== 'draft';
    const base: PayoutRun = {
      id,
      monthKey,
      method,
      status,
      lineCount: 0,
      payableCount: 0,
      heldCount: 0,
      paidCount: 0,
      failedCount: 0,
      totalAmount: 0,
      paidAmount: 0,
      createdAt: daysAgo(ageDays),
      createdById: 'usr-accountant-1',
      createdByName: 'Dilani Fonseka',
      approvedAt: approved ? daysAgo(ageDays - 1) : null,
      approvedById: approved ? 'usr-manager-1' : null,
      approvedByName: approved ? 'Ruwan Jayasuriya' : null,
      completedAt: null,
    };

    if (status === 'completed') {
      for (const line of runLines) {
        if (line.status === 'held') continue;
        line.status = 'paid';
        line.paidAt = daysAgo(ageDays - 2);
        line.markedByName = 'Dilani Fonseka';
      }
      base.completedAt = daysAgo(ageDays - 2);
    } else if (status === 'approved') {
      // Part-worked: the office has been through the first stretch of the file and
      // the bank refused one. That refusal is the state M6 has to make workable.
      runLines.forEach((line, index) => {
        if (line.status === 'held') return;
        if (index % 3 === 0) {
          line.status = 'paid';
          line.paidAt = daysAgo(1);
          line.markedByName = 'Dilani Fonseka';
        } else if (index === 4) {
          line.status = 'failed';
          line.reason = 'Bank returned it — the account name does not match the supplier.';
          line.markedByName = 'Dilani Fonseka';
        }
      });
    }

    lines.push(...runLines);
    runs.push(summarisePayoutRun(base, runLines));
  };

  if (previous) add(previous, 'bankTransfer', 'completed', 34);
  if (latest) {
    add(latest, 'bankTransfer', 'approved', 5);
    add(latest, 'cheque', 'draft', 4);
  }

  return { runs, lines };
}

const payouts = seedPayoutRuns();

export const mockPayoutRuns: PayoutRun[] = payouts.runs;
export const mockPayoutLines: PayoutLine[] = payouts.lines;

/** The latest month with published bills — the default the money screens open on. */
export const latestPublishedMonthKey: string | null = history.latestPublished;

/* ─────────────────── M7 Credit queues · M10 Inquiries ─────────────────── */

/**
 * The month in progress, as bill rows — **for eligibility only**.
 *
 * `@tfd/domain`'s credit rules read a supplier's accounts newest first and treat
 * the first as the month in progress: an advance ceiling is the last settled
 * rate × *this* month's kilos, because an advance is cash against leaf already in
 * the shed. Without a row for the open month the rule prices the wrong month — the
 * ceiling silently becomes last month's kilos at the month-before's rate, which is
 * a plausible number and a wrong one.
 *
 * Deliberately **not** pushed into `mockBills`. M5 holds generated output, and a
 * month whose bills exist is a month that has been through a generation run — so
 * adding these would tell the bills screen a run happened that never did, and would
 * turn `bills-missing` for the open month from a real state into an unreachable one.
 * The rate is `null`, so every derived figure on them is `null` too (BR-102).
 */
const openMonthBills: AdminBill[] = generateBills({
  monthKey: currentMonthKey,
  runId: `run-${currentMonthKey}-open`,
  generatedAt: NOW.toISOString(),
  generatedById: 'usr-accountant-1',
  generatedByName: 'Dilani Fonseka',
  publishedAt: null,
  deliveries: mockDeliveries,
  suppliers: mockSuppliers,
  rate: null,
  factory: billFactoryOf('galaboda'),
  // Empty: the carried figures do not price a ceiling, and threading the real ones
  // through would tie eligibility to a chain it does not read.
  coinsBroughtForward: new Map(),
  debtBroughtForward: new Map(),
  savingsBefore: new Map(),
});

/**
 * Every account a supplier holds, which is what the app's own history screen shows.
 *
 * `deliveries` defaults to the seed's rows but the handlers pass their **live**
 * array, and that is what makes the module work rather than merely compile. An
 * advance ceiling is priced off this month's leaf, so a history built from the
 * immutable fixture would never move — the ceiling would be frozen at whatever it
 * was when the module loaded, `stale-eligibility` could not happen, and the one
 * refusal BR-310 exists for would be unreachable.
 */
export function creditHistoryFor(
  supplierId: string,
  deliveries: Delivery[] = mockDeliveries,
): GreenLeafBill[] {
  const supplier = mockSuppliers.find((s) => s.id === supplierId);
  const open = supplier
    ? generateBills({
        monthKey: currentMonthKey,
        runId: `run-${currentMonthKey}-open`,
        generatedAt: new Date().toISOString(),
        generatedById: 'usr-accountant-1',
        generatedByName: 'Dilani Fonseka',
        publishedAt: null,
        deliveries,
        suppliers: [supplier],
        rate: null,
        factory: billFactoryOf('galaboda'),
        coinsBroughtForward: new Map(),
        debtBroughtForward: new Map(),
        savingsBefore: new Map(),
      })
    : [];

  return [...open, ...mockBills.filter((bill) => bill.supplierId === supplierId)];
}

/**
 * One supplier's eligibility for one facility, derived **now**.
 *
 * Takes the supplier record rather than an id so the caller passes the *live* one:
 * approving an advance raises `creditBalances.advance`, which lowers what is still
 * available, and a handler that looked the supplier up in the immutable seed would
 * keep offering headroom the office has already lent (§11.3).
 */
export function eligibilityFor(
  supplier: AdminSupplier,
  facility: CreditFacility,
  options: { deliveries?: Delivery[]; computedAt?: string } = {},
): CreditEligibility {
  return buildCreditEligibility({
    facility,
    bills: creditHistoryFor(supplier.id, options.deliveries),
    outstanding: supplier.creditBalances[facility],
    computedAt: options.computedAt ?? new Date().toISOString(),
  });
}

/** What the office actually stocks. Free text on the wire — this is the fixture's list. */

const SEED_AT = NOW.toISOString();

/** Active suppliers with leaf in the open month — the ones an advance can be priced for. */
const creditCandidates = mockSuppliers.filter(
  (supplier) =>
    supplier.status === 'active' && openMonthBills.some((bill) => bill.supplierId === supplier.id),
);

/**
 * An active supplier short of the history rule, so `shortHistory` is reachable.
 *
 * Someone who has not delivered for months asking for a loan is not a contrived
 * case — it is the request the six-month rule exists to refuse, and a fixture
 * without one cannot show that the refusal is explained rather than merely applied.
 *
 * Selected on **months of history**, which is the property the rule reads. An
 * earlier version used "has no bill in the open month" as a proxy and picked the
 * wrong supplier for three days out of four: on the 1st only a fraction of the
 * round has delivered yet, so the proxy caught someone with seven settled months
 * who simply had not been in that morning.
 */
const shortHistoryCandidate = mockSuppliers.find(
  (supplier) =>
    supplier.status === 'active' &&
    monthsOfHistory(creditHistoryFor(supplier.id)) < REQUIRED_MONTHS_OF_HISTORY,
);

/**
 * What to ask for, given the headroom.
 *
 * Clamped to the available figure, and the clamp is what stops the floor from
 * quietly producing an over-ceiling row: a supplier whose advance headroom is
 * LKR 2,000 on the 1st of the month would otherwise be seeded asking for the
 * LKR 2,500 minimum, and half the queue would be refusable for a reason the
 * fixture never intended. Only `share > 1` is allowed past the ceiling.
 */
function askFor(available: number, share: number): number {
  // Deliberately beyond the ceiling — the `over-ceiling` fixture.
  if (share > 1) return round2(Math.max(5_000, available * share));
  // A supplier with no headroom still asks. That request is the one the rule
  // exists to refuse, and the queue has to contain it.
  if (available <= 0) return 2_500;
  // Otherwise a plausible share of the headroom, and **never more than it** — the
  // floor is applied first and the clamp second, or a supplier whose advance
  // headroom is LKR 2,000 on the 1st gets seeded asking for the 2,500 minimum and
  // the row is refusable for a reason the fixture never intended.
  return round2(Math.min(Math.max(2_500, available * share), available));
}

interface CreditSeedSpec {
  facility: CreditFacility;
  ageHours: number;
  /**
   * What to ask for, as a share of the headroom still available.
   *
   * Above `1` produces the **over-ceiling** row: a request for more than the
   * supplier may draw. It has to exist, because `over-ceiling` is a refusal that
   * moves money if it is wrong, and a refusal nothing in the fixture triggers is
   * one nobody notices has stopped working.
   */
  share: number;
  reason: string;
  /** Raised by the clerk at the counter — the BR-501 four-eyes fixture. */
  officeRaised?: boolean;
  /**
   * Prefer a supplier who already owes on this facility.
   *
   * So "already drawn" is a figure on at least one row rather than a zero on every
   * one — the difference between a ceiling and what is left of it is the whole
   * point of the panel, and a fixture where they are always equal cannot show it.
   */
  wantsOutstanding?: boolean;
  /** Overrides the candidate rotation, for the short-history case. */
  supplier?: AdminSupplier;
}

/**
 * The pending queue, laid out so every state a clerk can meet is on the first page.
 *
 * The ids are fixed and the integration tests name them:
 *   crd-1 advance (well inside) · crd-2 loan · crd-3 manure · crd-4 advance
 *   **over ceiling** · crd-5 advance past its SLA · crd-6 loan **raised by the
 *   manager** (four-eyes) · crd-7 manure against an existing balance · crd-9 loan
 *   from a supplier with no settled months (**short history**)
 */
const CREDIT_SEED: CreditSeedSpec[] = [
  { facility: 'advance', ageHours: 3, share: 0.35, reason: 'Wages for the plucking round.' },
  { facility: 'loan', ageHours: 30, share: 0.5, reason: 'Re-roofing the drying shed before the monsoon.' },
  { facility: 'manure', ageHours: 50, share: 0.6, reason: 'Top dressing for the lower field.' },
  {
    facility: 'advance',
    ageHours: 8,
    // Deliberately beyond the headroom.
    share: 1.4,
    reason: 'School fees — asked for more than the account can carry.',
  },
  { facility: 'advance', ageHours: 80, share: 0.4, reason: 'Hospital costs.' },
  {
    facility: 'loan',
    ageHours: 20,
    share: 0.45,
    reason: 'Logged at the counter by the manager — the supplier has no phone.',
    officeRaised: true,
  },
  {
    facility: 'manure',
    ageHours: 14,
    share: 0.3,
    reason: 'Second application for the young clearing.',
    wantsOutstanding: true,
  },
  { facility: 'advance', ageHours: 5, share: 0.25, reason: 'Fuel for the transport lorry.' },
  {
    facility: 'loan',
    ageHours: 44,
    share: 0.5,
    reason: 'Wants to replant, but has not supplied since the drought.',
    supplier: shortHistoryCandidate,
  },
  { facility: 'advance', ageHours: 2, share: 0.5, reason: 'Household expenses before the account is paid.' },
  { facility: 'manure', ageHours: 96, share: 0.55, reason: 'Dolomite for the upper block.' },
  { facility: 'advance', ageHours: 26, share: 0.3, reason: 'Repair to the plucking shears and baskets.' },
];

function seedCreditRequests(): AdminCreditRequest[] {
  const used = new Set<string>();

  /** The first unused candidate that fits what the row is trying to show. */
  function candidateFor(spec: CreditSeedSpec): AdminSupplier {
    const free = (s: AdminSupplier) => !used.has(s.id);
    const wants = (s: AdminSupplier) => {
      const eligibility = eligibilityFor(s, spec.facility, { computedAt: SEED_AT });
      if (spec.wantsOutstanding && eligibility.outstanding <= 0) return false;
      // An over-ceiling row does not need headroom — it needs a ceiling to exceed.
      return spec.share > 1 || eligibility.available > 5_000;
    };

    const supplier =
      creditCandidates.find((s) => free(s) && wants(s)) ??
      creditCandidates.find(free) ??
      creditCandidates[0]!;
    used.add(supplier.id);
    return supplier;
  }

  const rows = CREDIT_SEED.map((spec, index): AdminCreditRequest => {
    const supplier = spec.supplier ?? candidateFor(spec);
    const eligibility = eligibilityFor(supplier, spec.facility, { computedAt: SEED_AT });

    /**
     * The ask, priced off the headroom rather than picked out of the air.
     *
     * A fixture of round numbers unrelated to the ceilings would make every row
     * either trivially approvable or absurd, and the queue's whole job is the
     * judgement in between.
     */
    const amount = askFor(eligibility.available, spec.share);
    const manure = spec.facility === 'manure';

    return {
      id: `crd-${index + 1}`,
      facility: spec.facility,
      supplierId: supplier.id,
      supplierCode: supplier.supplierCode,
      supplierName: supplier.name,
      amount,
      /**
       * The repayment period the supplier chose in the app (§21.10).
       *
       * Every third request carries one, so both paths are in the fixture: a period the
       * supplier picked, and the older requests that have none and fall back to the
       * factory's cap alone.
       */
      repaymentMonths: index % 3 === 0 ? 6 : null,
      reason: spec.reason,
      manureType: manure ? MANURE_TYPES[index % MANURE_TYPES.length]! : null,
      // Priced at roughly LKR 210/kg of fertilizer — a figure the office would set
      // per season, and one nobody has been asked for (status.md §21.10).
      quantityKg: manure ? Math.max(5, Math.round(amount / 210)) : null,
      status: 'pending',
      createdAt: hoursAgo(spec.ageHours),
      channel: spec.officeRaised ? 'office' : 'app',
      /**
       * The **manager**, not the clerk, and that is the whole point of the row.
       *
       * §12.1 gives `creditRequests: A` to the manager alone — a clerk may read
       * this queue and not decide it. So a request raised by a clerk could never
       * trip BR-501: the clerk cannot approve anything, and every other role is
       * innocent of raising it. Attributing it to the manager is the only way the
       * four-eyes refusal is reachable at all, which is the same argument as the
       * `held` payout line and `chg-6`.
       */
      createdById: spec.officeRaised ? 'usr-manager-1' : null,
      createdByName: spec.officeRaised ? 'Ruwan Jayasuriya' : null,
      decision: null,
      eligibility,
      ageHours: spec.ageHours,
    };
  });

  /**
   * Two decided rows, so the approved and rejected filters are not empty.
   *
   * Chosen with headroom rather than by position, because an *approved* request
   * that sits above its own ceiling is a row that could never have been approved —
   * it reads as a bug in the module rather than as a fixture, and on the 1st of the
   * month (when an advance ceiling is one day of leaf) it is what an index-based
   * pick produces about half the time.
   */
  const settledSupplier =
    creditCandidates.find(
      (s) => eligibilityFor(s, 'advance', { computedAt: SEED_AT }).available > 5_000,
    ) ??
    creditCandidates[20] ??
    creditCandidates[0]!;
  const settledEligibility = eligibilityFor(settledSupplier, 'advance', { computedAt: SEED_AT });

  rows.push(
    {
      id: 'crd-13',
      facility: 'advance',
      repaymentMonths: null,
      supplierId: settledSupplier.id,
      supplierCode: settledSupplier.supplierCode,
      supplierName: settledSupplier.name,
      amount: askFor(settledEligibility.available, 0.3),
      reason: 'Wages ahead of the account being paid.',
      manureType: null,
      quantityKg: null,
      status: 'approved',
      createdAt: daysAgo(7),
      channel: 'app',
      createdById: null,
      createdByName: null,
      decision: {
        note: 'Within the ceiling for the leaf already weighed this month. Paid at the counter.',
        decidedById: 'usr-manager-1',
        decidedByName: 'Ruwan Jayasuriya',
        decidedAt: daysAgo(6),
      },
      eligibility: settledEligibility,
      ageHours: 168,
    },
    {
      id: 'crd-14',
      facility: 'loan',
      repaymentMonths: null,
      supplierId: settledSupplier.id,
      supplierCode: settledSupplier.supplierCode,
      supplierName: settledSupplier.name,
      amount: 500_000,
      reason: 'Buying the adjoining half acre.',
      manureType: null,
      quantityKg: null,
      status: 'rejected',
      createdAt: daysAgo(11),
      channel: 'app',
      createdById: null,
      createdByName: null,
      decision: {
        note: 'Above three times the average monthly account. Reapply after the next two months are settled.',
        decidedById: 'usr-manager-1',
        decidedByName: 'Ruwan Jayasuriya',
        decidedAt: daysAgo(10),
      },
      eligibility: eligibilityFor(settledSupplier, 'loan', { computedAt: SEED_AT }),
      ageHours: 264,
    },
  );

  return rows;
}

export const mockCreditRequests: AdminCreditRequest[] = seedCreditRequests();

/* ────────────────────── M18 Tea packet requests ────────────────────── */

/**
 * The queue v1 had no fixture for, because it had no module.
 *
 * Six rows, chosen so every state the screen renders has something in it: a pending
 * request over the per-request cap (the one the clerk has to reject with a useful
 * sentence), one raised at the counter by a clerk so BR-501 has something to withhold,
 * an approved-and-recovered row and an approved-and-outstanding one — the second is what
 * `teaPacketsOutstanding` counts and therefore what blocks turning the flag off.
 */
function seedTeaPacketRequests(): AdminTeaPacketRequest[] {
  const policy = DEFAULT_TEA_PACKET_POLICY;
  const priced = (packets: number) => ({
    packets,
    unitPrice: policy.pricePerPacket,
    amount: teaPacketAmount(policy, packets),
  });

  const supplierAt = (index: number) => {
    const supplier = mockSuppliers[index]!;
    return {
      supplierId: supplier.id,
      supplierCode: supplier.supplierCode,
      supplierName: supplier.name,
    };
  };

  return [
    {
      id: 'tea-1',
      ...supplierAt(2),
      ...priced(4),
      deliveryMethod: 'transportVehicle',
      notes: 'Send with the Makadura vehicle on Friday.',
      status: 'pending',
      createdAt: daysAgo(1),
      channel: 'app',
      createdById: null,
      createdByName: null,
      decision: null,
      recoveredOnMonthKey: null,
      ageHours: 26,
    },
    {
      id: 'tea-2',
      ...supplierAt(7),
      ...priced(2),
      deliveryMethod: 'factoryCollection',
      notes: null,
      status: 'pending',
      createdAt: daysAgo(4),
      channel: 'app',
      createdById: null,
      createdByName: null,
      decision: null,
      recoveredOnMonthKey: null,
      // Past the three-day target, so the queue has a red age badge to render.
      ageHours: 97,
    },
    {
      /** Over `maxPacketsPerRequest`. The row the decision dialog exists for. */
      id: 'tea-3',
      ...supplierAt(11),
      ...priced(24),
      deliveryMethod: 'factoryCollection',
      notes: 'For my daughter\'s wedding.',
      status: 'pending',
      createdAt: daysAgo(2),
      channel: 'app',
      createdById: null,
      createdByName: null,
      decision: null,
      recoveredOnMonthKey: null,
      ageHours: 51,
    },
    {
      /** Raised at the counter, so BR-501 has a row to withhold the button on. */
      id: 'tea-4',
      ...supplierAt(15),
      ...priced(3),
      deliveryMethod: 'factoryCollection',
      notes: 'Walked in; no telephone on file.',
      status: 'pending',
      createdAt: daysAgo(1),
      channel: 'office',
      createdById: 'usr-clerk-1',
      createdByName: 'Nadeesha Perera',
      decision: null,
      recoveredOnMonthKey: null,
      ageHours: 20,
    },
    {
      /** Approved and already off an account — no longer outstanding. */
      id: 'tea-5',
      ...supplierAt(4),
      ...priced(5),
      deliveryMethod: 'transportVehicle',
      notes: null,
      status: 'approved',
      createdAt: daysAgo(46),
      channel: 'app',
      createdById: null,
      createdByName: null,
      decision: {
        note: 'Issued from the store on the 12th, collected by the Deniyaya vehicle.',
        decidedById: 'usr-manager-1',
        decidedByName: 'Ruwan Jayasuriya',
        decidedAt: daysAgo(45),
      },
      recoveredOnMonthKey: monthKeyBack(1),
      ageHours: 1104,
    },
    {
      /**
       * Approved and **not** yet recovered.
       *
       * This single row is what makes `enableTeaPackets` refusable in M14: the factory
       * has handed over the tea and has not been paid for it, so turning the queue off
       * would hide a debt. Without it the block would be untestable.
       */
      id: 'tea-6',
      ...supplierAt(9),
      ...priced(6),
      deliveryMethod: 'factoryCollection',
      notes: null,
      status: 'approved',
      createdAt: daysAgo(8),
      channel: 'app',
      createdById: null,
      createdByName: null,
      decision: {
        note: 'Collected from the store on the 3rd.',
        decidedById: 'usr-manager-1',
        decidedByName: 'Ruwan Jayasuriya',
        decidedAt: daysAgo(7),
      },
      recoveredOnMonthKey: null,
      ageHours: 192,
    },
  ];
}

export const mockTeaPacketRequests: AdminTeaPacketRequest[] = seedTeaPacketRequests();

/**
 * A pending credit request counts towards the supplier's open requests too.
 *
 * The field is "how many things is this supplier waiting on us for", and M2's
 * detail page links off it. Counting only change requests was right while they were
 * the only queue and would now under-report the suppliers who are waiting most.
 * Inquiries are deliberately **not** counted: a question is not a request, and the
 * detail page links to a queue that decides things.
 */
for (const request of mockCreditRequests) {
  if (request.status !== 'pending') continue;
  const supplier = mockSuppliers.find((s) => s.id === request.supplierId);
  if (supplier) supplier.pendingRequests += 1;
}

/* ───────────────────────────── M10 Inquiries ───────────────────────────── */

interface InquirySeedSpec {
  subject: string;
  message: string;
  ageHours: number;
  status?: InquiryStatus;
  reply?: string;
  closureNote?: string;
  officeRaised?: boolean;
}

/**
 * Seven messages, covering all three states and both channels.
 *
 * Written as things a smallholder would actually send, because the queue is read
 * by a clerk deciding what to answer first, and lorem-ipsum rows make the triage
 * columns look like they work when nobody has tried reading one.
 */
const INQUIRY_SEED: InquirySeedSpec[] = [
  {
    subject: 'July account is short',
    message:
      'My July account shows 96 kg less than my own book. I brought leaf on the 12th in the afternoon as well as the morning. Please check the second weighing.',
    ageHours: 3,
  },
  {
    subject: 'Savings deduction changed',
    message:
      'The savings on my account went from LKR 15 to LKR 20 a kilo. I did not ask for this. Please tell me who changed it.',
    ageHours: 11,
  },
  {
    subject: 'When is the August rate coming?',
    message: 'The auction was last week. When will the August rate be entered so I know my account?',
    ageHours: 30,
  },
  {
    subject: 'Cheque not received',
    message:
      'The office said my cheque was ready on the 3rd. I have been twice and it is not there. My supplier code is on this message.',
    ageHours: 58,
  },
  {
    subject: 'Change my collection point',
    message: 'I want to bring leaf to Makadura instead of Deniyaya from next month. What do I need to do?',
    ageHours: 96,
    status: 'resolved',
    reply:
      'You can start bringing leaf to Makadura from the 1st. Tell the weigher your supplier code on the first day so the route sheet is updated. Nothing changes on your account or your bank details.',
  },
  {
    subject: 'test',
    message: 'test message please ignore',
    ageHours: 120,
    status: 'closed',
    closureNote: 'Empty test message from the app. Nothing to answer.',
  },
  {
    subject: 'Asked at the counter about manure credit',
    message:
      'Walked in on Tuesday asking whether manure can be taken on credit against the September account. Logged here so it is not lost.',
    ageHours: 22,
    officeRaised: true,
  },
];

function seedInquiries(): AdminInquiry[] {
  return INQUIRY_SEED.map((spec, index) => {
    const supplier = mockSuppliers[index * 5 + 2]!;
    const status: InquiryStatus = spec.status ?? 'open';

    return {
      id: `inq-${index + 1}`,
      supplierId: supplier.id,
      supplierCode: supplier.supplierCode,
      supplierName: supplier.name,
      subject: spec.subject,
      message: spec.message,
      status,
      channel: spec.officeRaised ? 'office' : 'app',
      createdAt: hoursAgo(spec.ageHours),
      createdById: spec.officeRaised ? 'usr-clerk-1' : null,
      createdByName: spec.officeRaised ? 'Nadeeka Perera' : null,
      reply: spec.reply
        ? {
            body: spec.reply,
            repliedById: 'usr-clerk-1',
            repliedByName: 'Nadeeka Perera',
            repliedAt: hoursAgo(Math.max(1, spec.ageHours - 20)),
          }
        : null,
      closedAt: spec.closureNote ? hoursAgo(Math.max(1, spec.ageHours - 30)) : null,
      closedByName: spec.closureNote ? 'Nadeeka Perera' : null,
      closureNote: spec.closureNote ?? null,
      ageHours: spec.ageHours,
    };
  });
}

export const mockInquiries: AdminInquiry[] = seedInquiries();

/* ─────────────── M11 News · M12 Static content ─────────────── */

/**
 * A news article as the mock holds it.
 *
 * **No `missingLanguages`, no `staleLanguages` and no `updatedAt`.** All three are
 * derived when the record is serialised, and they have to be: the gaps are relative to
 * the *requesting tenant's* `contentLanguages`, so one stored answer would be wrong for
 * everybody but Galaboda. `highland` authors in English and Tamil, and is not missing
 * Sinhala — it never asked for it. The same reasoning kept `stale` off `BillRunRecord`.
 */
export interface NewsRecord {
  id: string;
  slug: string;
  translations: ContentTranslations;
  coverImageUrl?: string;
  status: ContentStatus;
  publishedAt: string | null;
  publishedByName: string | null;
  createdAt: string;
  createdByName: string;
}

export interface StaticPageRecord {
  slug: StaticPageSlug;
  translations: ContentTranslations;
  status: 'draft' | 'published';
  publishedAt: string | null;
  publishedByName: string | null;
}

/**
 * **The Sinhala and Tamil copy below has not been reviewed by a native speaker.**
 *
 * It is here so the language tabs, the `[lang="si"]` / `[lang="ta"]` line-height rules
 * (§20.2) and the fallback machinery are exercised against real script rather than
 * against Latin placeholders — a fixture in English three times over would let a
 * right-to-length bug ship. Replace it before the console is shown to the factory:
 * approximate Sinhala in front of a Sinhala-speaking office is worse than an obvious
 * gap, because a gap is a question and bad copy is an answer.
 */
const translation = (
  lang: LanguageCode,
  title: string,
  body: string,
  hoursOld: number,
  excerpt?: string,
): ContentTranslation => ({
  lang,
  title,
  excerpt,
  body,
  updatedAt: hoursAgo(hoursOld),
  updatedByName: lang === EDITORIAL_FALLBACK_LANGUAGE ? 'Tharindu Silva' : 'Nadeeka Perera',
});

/**
 * Five articles, and each one is a state the editor has to be able to tell apart.
 *
 * The middle three are the module's whole reason for existing:
 *
 *  - **`nws-2` is published with no Sinhala and no Tamil.** This is AC-08 in the
 *    fixture: it is live, a Sinhala supplier is reading English, and the office should
 *    be able to see that from the list without opening anything.
 *  - **`nws-3`'s Sinhala is stale.** The English was corrected *after* the Sinhala was
 *    written, so the app renders a Sinhala article that says the old thing. Nothing in
 *    AC-08's wording covers this, and it is the second thing an office hits.
 *  - **`nws-4` is a draft** with only its English written — the normal half-finished
 *    state, and the one that must not be publishable in Sinhala's name.
 */
const NEWS_SEED: Array<{
  id: string;
  status: ContentStatus;
  publishedHoursAgo?: number;
  cover?: boolean;
  translations: ContentTranslation[];
}> = [
  {
    id: 'nws-1',
    status: 'published',
    publishedHoursAgo: 30,
    cover: true,
    translations: [
      translation(
        'en',
        'August green leaf rate published',
        'The August auction result is in and the account for August has been published. The rate is LKR 124.50 per kilo with an extra LKR 6.50 added by the factory. Accounts can be collected from the office from Monday, or will be transferred to your bank on the same day.',
        40,
        'The August rate is LKR 131.00 per kilo including the factory extra.',
      ),
      translation(
        'si',
        'අගෝස්තු මාසයේ දළු ගාස්තුව',
        'අගෝස්තු මාසයේ වෙන්දේසි ප්‍රතිඵලය ලැබී ඇත. කිලෝ එකකට රු. 124.50 සහ කර්මාන්තශාලාව එකතු කරන අමතර රු. 6.50. සඳුදා සිට කාර්යාලයෙන් ගිණුම් ලබා ගත හැක.',
        38,
        'අගෝස්තු ගාස්තුව කිලෝ එකකට රු. 131.00 කි.',
      ),
      translation(
        'ta',
        'ஆகஸ்ட் மாத பசுந்தேயிலை விலை',
        'ஆகஸ்ட் மாத ஏல முடிவு வந்துவிட்டது. ஒரு கிலோவுக்கு ரூ. 124.50 மற்றும் தொழிற்சாலை சேர்க்கும் கூடுதல் ரூ. 6.50. திங்கள் முதல் அலுவலகத்தில் கணக்குகளைப் பெறலாம்.',
        37,
        'ஆகஸ்ட் விலை ஒரு கிலோவுக்கு ரூ. 131.00.',
      ),
    ],
  },
  {
    // Published with a gap. The AC-08 case.
    id: 'nws-2',
    status: 'published',
    publishedHoursAgo: 8,
    translations: [
      translation(
        'en',
        'Makadura collection point closed on Poya day',
        'The Makadura weighing point will not open on Poya day. Bring leaf to Deniyaya or Morawaka instead, and tell the weigher your supplier code so it is filed against your own account.',
        10,
        'Makadura does not weigh on Poya day. Use Deniyaya or Morawaka.',
      ),
    ],
  },
  {
    // Published, translated, and then the English was corrected. The Sinhala is stale.
    id: 'nws-3',
    status: 'published',
    publishedHoursAgo: 200,
    translations: [
      translation(
        'en',
        'Savings scheme rates updated',
        'The savings rates you can choose from are now LKR 0, 5, 10, 15, 20, 25, 30, 35, 40, 45 and 50 per kilo. To change your rate, use the app or ask at the office counter. A change takes effect from the next month.',
        // Corrected 4 hours ago — after both translations were written.
        4,
        'More savings rates are now available. Change yours in the app.',
      ),
      translation(
        'si',
        'ඉතුරුම් යෝජනා ක්‍රමයේ අනුපාත',
        'ඔබට තෝරාගත හැකි ඉතුරුම් අනුපාත රු. 0, 10, 20, 30 සහ 40 වේ. ඔබේ අනුපාතය වෙනස් කිරීමට යෙදුම භාවිත කරන්න.',
        190,
        'නව ඉතුරුම් අනුපාත ලබා ගත හැක.',
      ),
      translation(
        'ta',
        'சேமிப்புத் திட்ட விகிதங்கள்',
        'நீங்கள் தேர்ந்தெடுக்கக்கூடிய சேமிப்பு விகிதங்கள் ரூ. 0, 10, 20, 30 மற்றும் 40. உங்கள் விகிதத்தை மாற்ற செயலியைப் பயன்படுத்துங்கள்.',
        188,
        'புதிய சேமிப்பு விகிதங்கள் கிடைக்கின்றன.',
      ),
    ],
  },
  {
    id: 'nws-4',
    status: 'draft',
    translations: [
      translation(
        'en',
        'Fertilizer distribution — September',
        'Fertilizer for the September round will be issued at the factory store from the 8th. Bring your supplier card. Quantities are limited to what was requested through the app by the 1st.',
        2,
        'September fertilizer is issued from the 8th at the factory store.',
      ),
    ],
  },
  {
    id: 'nws-5',
    status: 'archived',
    publishedHoursAgo: 2200,
    translations: [
      translation(
        'en',
        'July green leaf rate published',
        'The July auction result is in. The rate is LKR 118.75 per kilo with an extra LKR 6.00 added by the factory.',
        2210,
        'The July rate is LKR 124.75 per kilo including the factory extra.',
      ),
      translation(
        'si',
        'ජූලි මාසයේ දළු ගාස්තුව',
        'ජූලි මාසයේ වෙන්දේසි ප්‍රතිඵලය ලැබී ඇත. කිලෝ එකකට රු. 118.75 සහ අමතර රු. 6.00.',
        2208,
      ),
    ],
  },
];

function seedNews(): NewsRecord[] {
  return NEWS_SEED.map((spec) => {
    const fallback = spec.translations.find((one) => one.lang === EDITORIAL_FALLBACK_LANGUAGE)!;
    const translations: ContentTranslations = {};
    for (const one of spec.translations) translations[one.lang] = one;

    return {
      id: spec.id,
      // Derived from the **fallback** title, never from a translation: a slug is a link
      // target and a Sinhala title transliterates to nothing useful.
      slug: slugify(fallback.title),
      translations,
      coverImageUrl: spec.cover
        ? 'https://mock-storage.invalid/news/august-rate-cover.jpg'
        : undefined,
      status: spec.status,
      publishedAt: spec.publishedHoursAgo ? hoursAgo(spec.publishedHoursAgo) : null,
      publishedByName: spec.publishedHoursAgo ? 'Ruwan Jayasuriya' : null,
      createdAt: hoursAgo((spec.publishedHoursAgo ?? 2) + 12),
      createdByName: 'Tharindu Silva',
    } satisfies NewsRecord;
  });
}

export const mockNews: NewsRecord[] = seedNews();

/* ────────────────────────── M11 Promo banners ────────────────────────── */

export interface BannerRecord {
  id: string;
  translations: BannerTranslations;
  imageUrl?: string;
  imageAspectRatio?: number;
  action: BannerAction;
  startsAt: string;
  endsAt: string | null;
  status: ContentStatus;
  publishedAt: string | null;
  publishedByName: string | null;
  createdAt: string;
  createdByName: string;
}

function bannerCopy(
  lang: LanguageCode,
  title: string,
  /** `undefined` here means "headline only" and is stored as `''` — see `BannerTranslation`. */
  body: string | undefined,
  buttonLabel: string,
  hoursAgoUpdated: number,
): BannerTranslation {
  return {
    lang,
    title,
    body: body ?? '',
    buttonLabel,
    updatedAt: hoursAgo(hoursAgoUpdated),
    updatedByName: 'Tharindu Silva',
  };
}

/**
 * Four banners, and the three that are **not** live are the point.
 *
 * The mobile repo's fixture keeps one live and one expired on purpose — "it is what
 * proves the live window is honoured rather than every row in the table being shown"
 * (`banners.md`). The console needs two more states that the app never sees, because they
 * are states only the office can be in: a **draft** nobody has published, and a
 * **scheduled** banner published in advance of its window. The second is the one that
 * catches an office out — published, correct, and in front of nobody — and it is why the
 * editor screen leads with a window notice rather than a status badge.
 *
 * **No `imageUrl` anywhere**, for the same reason the app's fixture has none: there is no
 * bundled artwork in this repository, and pointing a demo at a third-party image host
 * makes the feature look broken the moment the machine is offline.
 */
const BANNER_SEED: BannerRecord[] = [
  {
    id: 'ban-1',
    translations: {
      en: bannerCopy(
        'en',
        'Fertilizer issue — August',
        'Urea and TSP are in the store. Apply through the app and collect from the office.',
        'Request manure',
        30,
      ),
      si: bannerCopy(
        'si',
        'පොහොර නිකුත් කිරීම — අගෝස්තු',
        'යූරියා සහ TSP ගබඩාවේ ඇත. යෙදුම හරහා ඉල්ලුම් කර කාර්යාලයෙන් ලබා ගන්න.',
        'පොහොර ඉල්ලන්න',
        28,
      ),
      // Tamil deliberately absent: this is the live banner AC-08's fallback rule is
      // demonstrated on, so a Tamil supplier is reading the English right now.
    },
    action: { type: 'screen', path: 'manure' },
    startsAt: daysAgo(3),
    endsAt: daysAhead(11),
    status: 'published',
    publishedAt: daysAgo(3),
    publishedByName: 'Ruwan Jayasuriya',
    createdAt: daysAgo(4),
    createdByName: 'Tharindu Silva',
  },
  {
    /** Published, and its window closed on Tuesday. Kept, because it is how the next
     *  one gets written — and because a list that hid it would look like it never ran. */
    id: 'ban-2',
    translations: {
      en: bannerCopy('en', 'July account is ready', undefined, 'View my account', 800),
      si: bannerCopy('si', 'ජූලි ගිණුම සූදානම්', undefined, 'ගිණුම බලන්න', 800),
      ta: bannerCopy('ta', 'ஜூலை கணக்கு தயார்', undefined, 'கணக்கைப் பார்க்க', 798),
    },
    action: { type: 'screen', path: 'home' },
    startsAt: daysAgo(30),
    endsAt: daysAgo(9),
    status: 'published',
    publishedAt: daysAgo(30),
    publishedByName: 'Ruwan Jayasuriya',
    createdAt: daysAgo(31),
    createdByName: 'Tharindu Silva',
  },
  {
    /**
     * Published **before** its window. The state the editor screen's notice exists for:
     * every badge says "published" and no supplier can see it for another five days.
     */
    id: 'ban-3',
    translations: {
      en: bannerCopy(
        'en',
        'Factory closed for Poya',
        'The weighing points will not open on the 12th.',
        'Call the office',
        20,
      ),
    },
    action: { type: 'url', url: 'tel:+94812234567' },
    startsAt: daysAhead(5),
    endsAt: daysAhead(7),
    status: 'published',
    publishedAt: hoursAgo(20),
    publishedByName: 'Ruwan Jayasuriya',
    createdAt: hoursAgo(22),
    createdByName: 'Tharindu Silva',
  },
  {
    /** A draft with English only — where a banner starts, and what the editor opens. */
    id: 'ban-4',
    translations: {
      en: bannerCopy(
        'en',
        'Savings withdrawals open in April',
        'Ask at the office before the 20th to be paid on the April account.',
        'About the scheme',
        6,
      ),
    },
    action: { type: 'screen', path: 'savings' },
    startsAt: daysAhead(30),
    endsAt: null,
    status: 'draft',
    publishedAt: null,
    publishedByName: null,
    createdAt: hoursAgo(6),
    createdByName: 'Tharindu Silva',
  },
];

export const mockBanners: BannerRecord[] = BANNER_SEED;

/**
 * The six fixed pages, in three states.
 *
 * `faq` is complete in all three languages because **AC-11 is about the FAQ** and a
 * criterion whose fixture is half-written cannot be signed off. `savingsScheme` and
 * `about` are English-only, which is the state a factory that has just gone live is
 * actually in. `creditTerms` has **never been written** — its status is `draft` and the
 * app falls back to the bundled default, which is a state the office has to be able to
 * see rather than mistake for a page it already filled in.
 */
const STATIC_PAGE_SEED: Array<{
  slug: StaticPageSlug;
  published?: boolean;
  translations: ContentTranslation[];
}> = [
  {
    slug: 'faq',
    published: true,
    translations: [
      translation(
        'en',
        'Frequently asked questions',
        [
          'When is my account ready?',
          'The account for a month is published once the auction result is in, usually in the first week of the following month. Until then the app shows your kilos but no amount — the rate does not exist yet, so an amount would be a guess.',
          '',
          'Why is my amount blank?',
          'Because the auction result for that month has not been entered. Your kilos are recorded and nothing is lost.',
          '',
          'How do I change my savings rate?',
          'Ask through the app, or at the office counter. The office has to approve it, and it takes effect from the next month.',
          '',
          'How do I change my bank account?',
          'Ask through the app and bring your passbook to the office. The office checks the name against your NIC before the change is made.',
        ].join('\n'),
        300,
      ),
      translation(
        'si',
        'නිතර අසන ප්‍රශ්න',
        [
          'මගේ ගිණුම කවදා සූදානම් වේද?',
          'වෙන්දේසි ප්‍රතිඵලය ලැබුණු පසු මාසයේ ගිණුම ප්‍රකාශයට පත් කරයි. එය සාමාන්‍යයෙන් ඊළඟ මාසයේ පළමු සතියේ සිදු වේ.',
          '',
          'මගේ මුදල හිස් ලෙස පෙනෙන්නේ ඇයි?',
          'එම මාසයේ වෙන්දේසි ප්‍රතිඵලය තවම ඇතුළත් කර නැත. ඔබේ කිලෝ ගණන සටහන් වී ඇත.',
          '',
          'ඉතුරුම් අනුපාතය වෙනස් කරන්නේ කෙසේද?',
          'යෙදුම හරහා හෝ කාර්යාලයෙන් ඉල්ලන්න. කාර්යාලය අනුමත කළ පසු ඊළඟ මාසයේ සිට බලපැවැත්වේ.',
        ].join('\n'),
        290,
      ),
      translation(
        'ta',
        'அடிக்கடி கேட்கப்படும் கேள்விகள்',
        [
          'எனது கணக்கு எப்போது தயாராகும்?',
          'ஏல முடிவு வந்த பிறகு மாதத்தின் கணக்கு வெளியிடப்படும். வழக்கமாக அடுத்த மாதத்தின் முதல் வாரத்தில்.',
          '',
          'எனது தொகை காலியாக இருப்பது ஏன்?',
          'அந்த மாதத்தின் ஏல முடிவு இன்னும் பதிவு செய்யப்படவில்லை. உங்கள் கிலோ அளவு பதிவாகியுள்ளது.',
          '',
          'சேமிப்பு விகிதத்தை எவ்வாறு மாற்றுவது?',
          'செயலி மூலம் அல்லது அலுவலகத்தில் கேளுங்கள். அலுவலகம் அனுமதித்த பிறகு அடுத்த மாதம் முதல் நடைமுறைக்கு வரும்.',
        ].join('\n'),
        288,
      ),
    ],
  },
  {
    slug: 'savingsScheme',
    published: true,
    translations: [
      translation(
        'en',
        'The savings scheme',
        'You choose an amount per kilo, and the factory holds it for you out of each monthly account. The money is yours. Your balance is on the app, and it is also printed on every Green Leaf Account under "Savings". To change your rate, ask through the app — the office has to approve it and the change takes effect from the next month. Choosing LKR 0 opts out of the scheme entirely.',
        260,
      ),
    ],
  },
  {
    slug: 'about',
    published: true,
    translations: [
      translation(
        'en',
        'About the factory',
        'Galaboda Tea Factory has bought green leaf from smallholders in the Akuressa area since 1974. The factory weighs at four collection points and publishes a monthly account for every registered supplier.',
        400,
      ),
    ],
  },
  {
    slug: 'terms',
    published: true,
    translations: [
      translation(
        'en',
        'Terms of supply',
        'Leaf is bought by weight at the collection point, at the rate published for the month it was delivered in. Deductions for transport, savings and any credit taken are itemized on the monthly account. A published account is final; an error is adjusted on the following month.',
        420,
      ),
    ],
  },
  {
    slug: 'privacy',
    published: true,
    translations: [
      translation(
        'en',
        'Privacy',
        'The factory holds your name, NIC, contact details, bank details and your delivery and account history, and uses them only to buy leaf from you and to pay you. Bank details are shown to office staff in masked form; the full number is visible only to staff who need it, and every such view is recorded.',
        420,
      ),
    ],
  },
  {
    // Never written. The app falls back to its bundled default, and the office has to be
    // able to see that rather than assume this page exists.
    slug: 'creditTerms',
    translations: [],
  },
];

function seedStaticPages(): StaticPageRecord[] {
  return STATIC_PAGE_SEED.map((spec) => {
    const translations: ContentTranslations = {};
    for (const one of spec.translations) translations[one.lang] = one;

    return {
      slug: spec.slug,
      translations,
      status: spec.published ? 'published' : 'draft',
      publishedAt: spec.published ? daysAgo(12) : null,
      publishedByName: spec.published ? 'Ruwan Jayasuriya' : null,
    } satisfies StaticPageRecord;
  });
}

export const mockStaticPages: StaticPageRecord[] = seedStaticPages();

/* ───────────────────────── M13 Notifications ───────────────────────── */

/**
 * Registered devices, and **the opt-outs are the point of them**.
 *
 * The contract's second push rule is that a send must honour each device's opted-in
 * categories, not only its topic subscription — so a fixture where every device accepts
 * everything cannot demonstrate the one behaviour that matters. Here:
 *
 *  - roughly four suppliers in five have a device at all, so "reached 240 of 300" is a
 *    real gap the office should see rather than a rounding artefact;
 *  - every device starts from the tenant's `defaultCategories`, which pointedly
 *    **excludes `newsArticle`** — so news reaches far fewer phones than a bill does, and
 *    that asymmetry is the platform's existing decision rather than one invented here;
 *  - one supplier in seven has turned `newsArticle` back on, and one in eleven has turned
 *    `billPublished` off, because both are things people do and neither should be
 *    reachable only by editing a fixture.
 */
function seedDevices(): RegisteredDevice[] {
  const devices: RegisteredDevice[] = [];
  let sequence = 0;

  for (const supplier of mockSuppliers) {
    if (supplier.status === 'closed') continue;
    const index = supplierIndexOf(supplier.id);
    // One in five has never installed the app. The office needs that number.
    if (index % 5 === 0) continue;

    const categories: NotificationCategory[] = ['billPublished', 'requestDecided', 'inquiryReplied'];
    if (index % 7 === 0) categories.push('newsArticle');
    const opted = index % 11 === 0
      ? categories.filter((category) => category !== 'billPublished')
      : categories;

    sequence += 1;
    devices.push({
      id: `dev-${sequence}`,
      token: `mock-token-${supplier.id}`,
      platform: index % 3 === 0 ? 'ios' : 'android',
      categories: opted,
      registeredAt: daysAgo(intBetween(5, 400)),
    });
    // A few suppliers carry two devices — a phone and a spare — which is why the reach
    // figures count devices and the audience counts suppliers.
    if (index % 23 === 0) {
      sequence += 1;
      devices.push({
        id: `dev-${sequence}`,
        token: `mock-token-${supplier.id}-2`,
        platform: 'android',
        categories: opted,
        registeredAt: daysAgo(intBetween(5, 200)),
      });
    }
  }

  return devices;
}

/** Devices by supplier id — the shape every reach calculation needs. */
export const mockDevicesBySupplier: Record<string, RegisteredDevice[]> = (() => {
  const all = seedDevices();
  const out: Record<string, RegisteredDevice[]> = {};
  let cursor = 0;

  for (const supplier of mockSuppliers) {
    if (supplier.status === 'closed') continue;
    const index = supplierIndexOf(supplier.id);
    if (index % 5 === 0) continue;
    const count = index % 23 === 0 ? 2 : 1;
    out[supplier.id] = all.slice(cursor, cursor + count);
    cursor += count;
  }

  return out;
})();

/** A trigger record as the mock holds it. `available` is derived per tenant on read. */
export interface NotificationTriggerRecord {
  category: NotificationCategory;
  enabled: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
}

/**
 * Which categories fire automatically, defaulted from **the tenant's own
 * `defaultCategories`** rather than from an opinion.
 *
 * §21.24 has not been answered, and this is the closest thing to an answer already in the
 * codebase: `push.defaultCategories` is what a supplier is opted into when they install
 * the app, which is the platform saying which categories are routine. `newsArticle` is
 * excluded there, so it is off here — a factory that wants every circular pushed can turn
 * it on, and that toggle is the answer to §21.24 rather than a code change.
 */
export const mockNotificationTriggers: NotificationTriggerRecord[] = NOTIFICATION_CATEGORIES.map(
  (category) => ({
    category,
    enabled: (mockConfigs.galaboda!.push?.defaultCategories ?? []).includes(category),
    updatedAt: null,
    updatedByName: null,
  }),
);

/**
 * Three sends, so the log is not empty and every origin is visible.
 *
 * The composed one is deliberately the awkward case: a free-text message to every
 * supplier, which is the act §21.24's second half is about and the one the console should
 * make somebody think before doing.
 */
export const mockNotificationSends: NotificationSend[] = [
  {
    id: 'ntf-1',
    category: 'billPublished',
    origin: 'automatic',
    title: 'Your July account is ready',
    body: 'The July Green Leaf Account has been published. Open the app to see your kilos and your balance.',
    audience: { kind: 'allSuppliers' },
    entity: 'monthlyRate',
    entityId: monthKeyBack(1),
    targetedSuppliers: 68,
    reachableDevices: 61,
    suppressedDevices: 6,
    status: 'sent',
    createdById: null,
    createdByName: null,
    createdAt: daysAgo(4),
    sentAt: daysAgo(4),
    failureReason: null,
  },
  {
    id: 'ntf-2',
    category: 'inquiryReplied',
    origin: 'automatic',
    title: 'The factory replied to your message',
    body: 'Your message about changing collection point has an answer.',
    audience: { kind: 'supplier', supplierId: mockSuppliers[12]!.id },
    entity: 'inquiry',
    entityId: 'inq-5',
    targetedSuppliers: 1,
    reachableDevices: 1,
    suppressedDevices: 0,
    status: 'sent',
    createdById: null,
    createdByName: null,
    createdAt: daysAgo(3),
    sentAt: daysAgo(3),
    failureReason: null,
  },
  {
    id: 'ntf-3',
    category: 'newsArticle',
    origin: 'composed',
    title: 'Makadura closed on Poya day',
    body: 'Bring leaf to Deniyaya or Morawaka instead. Tell the weigher your supplier code.',
    audience: { kind: 'collectionPoint', collectionPoint: 'MAKADURA' },
    entity: null,
    entityId: null,
    targetedSuppliers: 17,
    // Most of them are opted out of `newsArticle` — which is exactly the figure a factory
    // needs before it decides a push is how to announce a closure.
    reachableDevices: 3,
    suppressedDevices: 11,
    status: 'sent',
    createdById: 'usr-factoryadmin-1',
    createdByName: 'Chandima Bandara',
    createdAt: hoursAgo(30),
    sentAt: hoursAgo(30),
    failureReason: null,
  },
];
