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
  AdminChangeRequest,
  AdminSupplier,
  AuditEntry,
  CapabilityGrants,
  CollectionDaySummary,
  ConsoleUser,
  DashboardSummary,
  Delivery,
  MonthCycleStage,
  MonthException,
  MonthExceptionType,
  MonthlyRate,
  RuntimeConfig,
  SupplierListItem,
} from '@tfd/domain';
import {
  OUTLIER_KG_FLOOR_KG,
  colomboDayOf,
  grantsFromRoles,
  isOutlierKg,
  maskAccountNumber,
  monthKeyOf,
  roundKg,
  summariseKgs,
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
    paymentMethod: hasBank ? (index % 4 === 0 ? 'cheque' : 'bankTransfer') : 'cash',
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
];

/* ─────────────────────────── M3 leaf collection ─────────────────────────── */

/** Today, as the factory's own calendar day (BR-104) — not as UTC's. */
export const TODAY = colomboDayOf(NOW);

export const currentMonthKey = monthKeyOf(TODAY);

/** How many days of history the fixture carries. Matches the dashboard's trend. */
const COLLECTION_DAYS = 14;

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

  for (let back = COLLECTION_DAYS - 1; back >= 0; back -= 1) {
    const date = colomboDayOf(new Date(NOW.getTime() - back * 86_400_000));

    // Sunday: the factory does not weigh. An empty day in the trend is a real
    // day off, not a hole in the fixture — and a chart that skipped it would
    // imply the office lost a day's leaf.
    if (weekdayOf(date) === 0) continue;

    // A scale file every fourth day, so the `source` column and the import path
    // both have something in the fixture to show.
    const source = back % 4 === 0 ? ('scaleFile' as const) : ('manual' as const);

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
  }

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
const voidable = mockDeliveries.find((row) => daysSince(row.recordedAt) > 2);
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

/** How many months of history the fixture carries, current one included. */
const MONTHS_OF_HISTORY = 4;

function monthKeyBack(months: number): string {
  const date = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - months, 15));
  return date.toISOString().slice(0, 7);
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
export function buildDashboard(
  changeRequests: AdminChangeRequest[],
  deliveries: Delivery[],
): DashboardSummary {
  const pending = changeRequests.filter((r) => r.status === 'pending');
  const oldest = pending.reduce<string | null>(
    (acc, r) => (acc === null || r.createdAt < acc ? r.createdAt : acc),
    null,
  );

  // Oldest first — charts read left to right (§4 of the contract).
  const intakeTrend = Array.from({ length: COLLECTION_DAYS }, (_, i) => {
    const date = colomboDayOf(new Date(NOW.getTime() - (COLLECTION_DAYS - 1 - i) * 86_400_000));
    return { date, totalKgs: summariseDay(deliveries, date).totalKgs };
  });

  const today = summariseDay(deliveries, TODAY);
  const yesterday = summariseDay(deliveries, colomboDayOf(new Date(NOW.getTime() - 86_400_000)));

  return {
    queues: [
      {
        queue: 'changeRequests',
        pending: pending.length,
        oldestPendingAt: oldest,
        // The §14.4 target for a change request is 3 working days.
        breachingSla: pending.filter((r) => r.ageHours > 72).length,
      },
      { queue: 'advanceRequests', pending: 7, oldestPendingAt: hoursAgo(30), breachingSla: 1 },
      { queue: 'loanRequests', pending: 3, oldestPendingAt: hoursAgo(52), breachingSla: 0 },
      { queue: 'manureRequests', pending: 5, oldestPendingAt: hoursAgo(19), breachingSla: 0 },
      { queue: 'inquiries', pending: 4, oldestPendingAt: hoursAgo(8), breachingSla: 0 },
    ],
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
        params: { count: pending.filter((r) => r.ageHours > 72).length },
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
    flags: {
      enableSavings: true,
      enableAdvances: true,
      enableLoans: true,
      enableManure: true,
      enableInquiry: true,
      enableNews: true,
      enablePushNotifications: true,
      enablePromoBanner: true,
      enablePayouts: true,
      enableReports: true,
    },
    savings: { perKgOptions: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50] },
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
      enableInquiry: true,
      enableNews: true,
      enablePushNotifications: true,
      enablePromoBanner: false,
      enablePayouts: true,
      enableReports: true,
    },
    savings: { perKgOptions: [0, 10, 20, 30, 40] },
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
    // Reduced feature set: no credit against income history, no fertilizer on
    // credit, no push. The sidebar must lose those rows entirely.
    flags: {
      enableSavings: true,
      enableAdvances: true,
      enableLoans: false,
      enableManure: false,
      enableInquiry: true,
      enableNews: false,
      enablePushNotifications: false,
      enablePromoBanner: false,
      enablePayouts: true,
      enableReports: false,
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
