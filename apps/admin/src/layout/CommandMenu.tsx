/**
 * Search from anywhere (Ctrl+K, or ⌘K on a Mac): a supplier by code or name, or a page of
 * the console by its name. The counter's commonest question is "pull up 5708", and this
 * answers it from whatever screen the clerk is on.
 *
 * Pages are filtered the way the sidebar filters them (the factory's flags, then the
 * user's grants), and suppliers are searched only by someone who may read them, so the menu
 * never offers what the server would refuse.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@/lib/navigate';
import { useQuery } from '@tanstack/react-query';
import * as RadixDialog from '@radix-ui/react-dialog';
import {
  CalendarCheck,
  CornerDownLeft,
  Coins,
  Inbox,
  Keyboard,
  Compass,
  Leaf,
  Package,
  Scale,
  Search,
  Table2,
  UserPlus,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import type { Capability } from '@tfd/domain';
import { can } from '@tfd/domain';
import { useAuthStore } from '@/auth/authStore';
import { useFeatureFlags, useKeepsFactoryRecords } from '@/config/RuntimeConfigProvider';
import { cn } from '@/lib/cn';
import { supplierRepository } from '@/services/repositories/supplierRepository';
import { NAVIGATION, isNavItemVisible } from './navigation';
import { openShortcuts } from './shortcutsEvent';
import { openTour } from './tourEvent';

interface Result {
  key: string;
  label: string;
  hint: string;
  to: string;
  icon: typeof Search;
  /** Read by the screen it opens: `add` opens its "add" dialog straight away. */
  state?: { action: string };
  /** Not a place: something done where you are (the shortcuts sheet). */
  run?: () => void;
}

/**
 * Things to do, not only places to go (22 November 2026): "add a supplier", "record walk-in
 * credit", the queues already filtered to what is waiting. Each shows only to someone who may
 * do it, and only where the factory keeps that record here.
 */
interface Action {
  key: string;
  labelKey: string;
  to: string;
  icon: LucideIcon;
  capability: Capability;
  verb: 'read' | 'write';
  records?: boolean;
  state?: { action: string };
}
const COMMAND_ACTIONS: Action[] = [
  {
    key: 'addSupplier',
    labelKey: 'search.action.addSupplier',
    to: '/suppliers',
    icon: UserPlus,
    capability: 'suppliers',
    verb: 'write',
    records: true,
    state: { action: 'add' },
  },
  {
    key: 'enterLeaf',
    labelKey: 'search.action.enterLeaf',
    to: '/deliveries',
    icon: Leaf,
    capability: 'deliveries',
    verb: 'write',
    records: true,
  },
  {
    key: 'walkIn',
    labelKey: 'search.action.walkIn',
    to: '/credit',
    icon: Coins,
    capability: 'creditRequests',
    verb: 'write',
    records: true,
    state: { action: 'add' },
  },
  {
    key: 'openingBalances',
    labelKey: 'search.action.openingBalances',
    to: '/suppliers/opening-balances',
    icon: Table2,
    capability: 'suppliers',
    verb: 'write',
    records: true,
  },
  {
    key: 'monthClose',
    labelKey: 'search.action.monthClose',
    to: '/rates',
    icon: CalendarCheck,
    capability: 'ratesAndMonthClose',
    verb: 'read',
    records: true,
  },
  {
    key: 'pendingCredit',
    labelKey: 'search.action.pendingCredit',
    to: '/credit?status=pending',
    icon: Scale,
    capability: 'creditRequests',
    verb: 'read',
  },
  {
    key: 'pendingChanges',
    labelKey: 'search.action.pendingChanges',
    to: '/change-requests?status=pending',
    icon: Inbox,
    capability: 'changeRequests',
    verb: 'read',
  },
  {
    key: 'pendingPackets',
    labelKey: 'search.action.pendingPackets',
    to: '/tea-packets?status=pending',
    icon: Package,
    capability: 'creditRequests',
    verb: 'read',
  },
];

export function CommandMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const grants = useAuthStore((s) => s.grants);
  const flags = useFeatureFlags();
  const keepsRecords = useKeepsFactoryRecords();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  // Ctrl+K / ⌘K anywhere opens it; the same keys close it again.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((was) => !was);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) setText('');
    setActive(0);
  }, [open, text]);

  const canSearchSuppliers = can(grants, 'suppliers', 'read');
  const needle = text.trim();
  const suppliers = useQuery({
    queryKey: ['command-menu', 'suppliers', needle],
    queryFn: () => supplierRepository.list({ q: needle, page: 0, pageSize: 6 }),
    enabled: open && canSearchSuppliers && needle.length >= 2,
    staleTime: 30_000,
  });

  const pages = useMemo<Result[]>(() => {
    const lower = needle.toLowerCase();
    return NAVIGATION.flatMap((section) => section.items)
      .filter((item) => isNavItemVisible(item, flags, (c) => can(grants, c, 'read'), keepsRecords))
      .map((item) => ({
        key: `page-${item.to}`,
        label: t(item.labelKey),
        hint: t('search.page'),
        to: item.to,
        icon: item.icon,
      }))
      .filter((item) => !lower || item.label.toLowerCase().includes(lower));
  }, [needle, flags, grants, keepsRecords, t]);

  const actions = useMemo<Result[]>(() => {
    const lower = needle.toLowerCase();
    return COMMAND_ACTIONS.filter(
      (action) => can(grants, action.capability, action.verb) && (!action.records || keepsRecords),
    )
      .map((action): Result => ({
        key: `action-${action.key}`,
        label: t(action.labelKey),
        hint: t('search.actionHint'),
        to: action.to,
        icon: action.icon,
        state: action.state,
      }))
      .concat({
        key: 'action-shortcuts',
        label: t('shortcuts.title'),
        hint: t('search.actionHint'),
        to: '',
        icon: Keyboard,
        run: openShortcuts,
      })
      .concat({
        key: 'action-tour',
        label: t('tour.again'),
        hint: t('search.actionHint'),
        to: '',
        icon: Compass,
        run: openTour,
      })
      .filter((item) => !lower || item.label.toLowerCase().includes(lower));
  }, [needle, grants, keepsRecords, t]);

  const results: Result[] = [
    ...(suppliers.data?.items ?? []).map((supplier) => ({
      key: `supplier-${supplier.id}`,
      label: `${supplier.supplierCode} · ${supplier.name}`,
      hint: supplier.collectionPoint?.name ?? t('search.supplier'),
      to: `/suppliers/${supplier.id}`,
      icon: UserRound,
    })),
    ...actions,
    ...pages,
  ];

  function go(result: Result | undefined) {
    if (!result) return;
    setOpen(false);
    if (result.run) {
      // After the search dialog has closed, so the sheet is not refused as "a dialog is open".
      window.setTimeout(result.run, 0);
      return;
    }
    navigate(result.to, result.state ? { state: result.state } : undefined);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(results[active]);
    }
  }

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-9 w-64 items-center gap-sm rounded-md border border-border bg-surface px-sm text-body-small text-text-secondary shadow-card transition-colors hover:border-text-secondary md:flex"
      >
        <Search className="size-icon-sm shrink-0" aria-hidden />
        <span className="flex-1 text-left">{t('search.open')}</span>
        <kbd className="rounded-sm border border-border px-xs font-sans text-caption">
          {isMac ? '⌘K' : 'Ctrl K'}
        </kbd>
      </button>

      <RadixDialog.Root open={open} onOpenChange={setOpen}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-40 bg-overlay backdrop-blur-xs" />
          <RadixDialog.Content
            data-glass-surface="dialog"
            className="fixed top-[15vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-dialog-wide -translate-x-1/2 overflow-clip rounded-lg border border-border bg-surface shadow-raised"
            aria-describedby={undefined}
          >
            <RadixDialog.Title className="sr-only">{t('search.open')}</RadixDialog.Title>
            <div className="flex items-center gap-sm border-b border-divider px-md">
              <Search className="size-icon-md shrink-0 text-text-secondary" aria-hidden />
              <input
                autoFocus
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={onKeyDown}
                // A combobox: focus stays in the box, and the highlighted result is announced.
                role="combobox"
                aria-expanded
                aria-controls="command-menu-results"
                aria-activedescendant={
                  results.length > 0 ? `command-menu-option-${active}` : undefined
                }
                placeholder={
                  canSearchSuppliers ? t('search.placeholder') : t('search.placeholderPages')
                }
                aria-label={t('search.open')}
                className="h-12 flex-1 bg-transparent text-body text-text-primary outline-none placeholder:text-text-secondary"
              />
            </div>

            <ul
              ref={listRef}
              id="command-menu-results"
              role="listbox"
              aria-label={t('search.results')}
              // Scrollable, so reachable by keyboard; the arrows in the box above still move the choice.
              tabIndex={0}
              className="relative max-h-96 overflow-y-auto p-xs"
            >
              {results.length === 0 ? (
                <li className="px-md py-lg text-center text-body-small text-text-secondary">
                  {suppliers.isFetching ? t('search.searching') : t('search.none')}
                </li>
              ) : (
                results.map((result, index) => {
                  const Icon = result.icon;
                  return (
                    <li
                      key={result.key}
                      id={`command-menu-option-${index}`}
                      data-index={index}
                      role="option"
                      aria-selected={index === active}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => go(result)}
                      className={cn(
                        'flex cursor-pointer items-center gap-md rounded-md px-md py-sm',
                        index === active ? 'bg-primary-muted' : 'hover:bg-surface-variant',
                      )}
                    >
                      <Icon className="size-icon-sm shrink-0 text-primary" aria-hidden />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-body-small text-text-primary">
                          {result.label}
                        </span>
                        <span className="truncate text-caption text-text-secondary">
                          {result.hint}
                        </span>
                      </span>
                      {index === active ? (
                        <CornerDownLeft className="size-icon-sm text-text-secondary" aria-hidden />
                      ) : null}
                    </li>
                  );
                })
              )}
            </ul>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>
    </>
  );
}
