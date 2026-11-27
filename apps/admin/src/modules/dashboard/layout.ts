/**
 * The dashboard as this person arranged it (27 November 2026): which cards, in what order,
 * and which tiles in the headline row. Changed with "Customise" on the dashboard.
 *
 * Per person **and** per browser, like the welcome tour: the office shares computers, and a
 * manager who moves the queues to the top should not move them for the clerk on the same
 * machine. Kept in `localStorage`, read one field at a time, so a layout saved by an older
 * build (a card since renamed, one added since) keeps what it can: unknown ids are dropped
 * and missing ones are put back where the default has them.
 */

export const CARD_IDS = ['today', 'kpis', 'adoptionTrend', 'queueMix', 'queues', 'content', 'alerts'] as const;
export type CardId = (typeof CARD_IDS)[number];

export const KPI_IDS = ['waiting', 'adoption', 'appRequests', 'devices'] as const;
export type KpiId = (typeof KPI_IDS)[number];

export interface DashboardLayout {
  cards: CardId[];
  hiddenCards: CardId[];
  kpis: KpiId[];
  hiddenKpis: KpiId[];
}

export const DEFAULT_LAYOUT: DashboardLayout = {
  cards: [...CARD_IDS],
  hiddenCards: [],
  kpis: [...KPI_IDS],
  hiddenKpis: [],
};

const key = (userId: string) => `tfd.admin.dashboardLayout.${userId}`;

/** The stored order, kept to known ids, with any missing id put back at its default place. */
function order<T extends string>(stored: unknown, known: readonly T[]): T[] {
  const list = Array.isArray(stored) ? stored.filter((id): id is T => (known as readonly unknown[]).includes(id)) : [];
  const unique = [...new Set(list)];
  known.forEach((id, index) => {
    if (unique.includes(id)) return;
    // After the default neighbour it followed, or first.
    const before = known.slice(0, index).reverse().find((one) => unique.includes(one));
    unique.splice(before ? unique.indexOf(before) + 1 : 0, 0, id);
  });
  return unique;
}

function subset<T extends string>(stored: unknown, known: readonly T[]): T[] {
  return Array.isArray(stored) ? [...new Set(stored.filter((id): id is T => (known as readonly unknown[]).includes(id)))] : [];
}

export function readLayout(userId: string | undefined): DashboardLayout {
  if (!userId) return DEFAULT_LAYOUT;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key(userId)) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_LAYOUT;
    const record = parsed as Record<string, unknown>;
    return {
      cards: order(record.cards, CARD_IDS),
      hiddenCards: subset(record.hiddenCards, CARD_IDS),
      kpis: order(record.kpis, KPI_IDS),
      hiddenKpis: subset(record.hiddenKpis, KPI_IDS),
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function persistLayout(userId: string | undefined, layout: DashboardLayout): void {
  if (!userId) return;
  try {
    window.localStorage.setItem(key(userId), JSON.stringify(layout));
  } catch {
    // Kept for this visit only.
  }
}

export function clearLayout(userId: string | undefined): void {
  if (!userId) return;
  try {
    window.localStorage.removeItem(key(userId));
  } catch {
    // Nothing stored to clear.
  }
}
