/**
 * Toasts, for the confirmation half of an action.
 *
 * A rule worth stating because it is easy to break: **a toast may confirm, never
 * inform.** "Approved: the app will show the new value on next refresh" is a
 * toast. A four-eyes refusal is not: it is a dialog, because a message that
 * disappears after four seconds is a message the clerk can miss and then wonder
 * why the queue did not change.
 */

import * as RadixToast from '@radix-ui/react-toast';
import { CheckCircle2, Info, TriangleAlert, Undo2, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type CSSProperties,
  type PropsWithChildren,
} from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

type ToastTone = 'success' | 'error' | 'info';

/**
 * One button on the toast (24 November 2026), today only **Undo**: for a change that can be
 * taken back by doing the opposite (assigning an inquiry, switching an automatic
 * notification, cancelling a schedule, a paste into the opening grid). Never for a decision
 * a supplier has already been told about.
 */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
  action?: ToastAction;
}

interface ToastApi {
  show: (toast: Omit<ToastItem, 'id'>) => void;
  success: (title: string, body?: string, action?: ToastAction) => void;
  error: (title: string, body?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS = {
  success: CheckCircle2,
  error: TriangleAlert,
  info: Info,
} as const;

/**
 * The tone is the icon's tinted disc and the timer line, not the card's edge (24 November
 * 2026): a coloured outline round the whole card, with a thick left stripe bent by the
 * rounded corners, read heavier than the sentence it carried.
 */
const TONES: Record<ToastTone, { disc: string; timer: string }> = {
  success: { disc: 'bg-success-muted text-success', timer: 'bg-success' },
  error: { disc: 'bg-error-muted text-error', timer: 'bg-error' },
  info: { disc: 'bg-info-muted text-info', timer: 'bg-info' },
};

/** Long enough to read a sentence; an error, which may need a second read, a little longer. */
const DURATION: Record<ToastTone, number> = { success: 5000, info: 6000, error: 8000 };
/** With an Undo on it, long enough to notice the mistake and reach the button. */
const WITH_ACTION = 8000;

export function ToastProvider({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((toast: Omit<ToastItem, 'id'>) => {
    setItems((current) => [...current, { ...toast, id: Date.now() + current.length }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, body, action) => show({ tone: 'success', title, body, action }),
      error: (title, body) => show({ tone: 'error', title, body }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      <RadixToast.Provider swipeDirection="right" duration={5000}>
        {children}
        {items.map((item) => {
          const Icon = ICONS[item.tone];
          const tone = TONES[item.tone];
          const duration = item.action ? WITH_ACTION : DURATION[item.tone];
          return (
            <RadixToast.Root
              key={item.id}
              duration={duration}
              onOpenChange={(open) => {
                if (!open) setItems((current) => current.filter((i) => i.id !== item.id));
              }}
              className="tfd-toast relative flex items-start gap-md overflow-hidden rounded-lg border border-border bg-surface p-md shadow-raised"
            >
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full',
                  tone.disc,
                )}
              >
                <Icon className="size-icon-sm" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 pt-xxs">
                <RadixToast.Title className="text-body-small font-semibold text-text-primary">
                  {item.title}
                </RadixToast.Title>
                {item.body ? (
                  <RadixToast.Description className="mt-xxs text-caption text-text-secondary">
                    {item.body}
                  </RadixToast.Description>
                ) : null}
                {item.action ? (
                  // Radix closes the toast on click; `altText` is what a screen reader is
                  // told to do instead, since the toast may be gone before it is reached.
                  <RadixToast.Action
                    altText={item.action.label}
                    onClick={item.action.onClick}
                    className="mt-xs -ml-xs inline-flex min-h-7 items-center gap-xxs rounded-md px-xs text-caption font-semibold text-primary transition-colors hover:bg-primary-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Undo2 className="size-icon-xs" aria-hidden />
                    {item.action.label}
                  </RadixToast.Action>
                ) : null}
              </div>
              <RadixToast.Close
                aria-label={t('common.close')}
                className="-mt-xxs -mr-xxs flex size-8 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-variant hover:text-text-primary"
              >
                <X className="size-icon-sm" aria-hidden />
              </RadixToast.Close>
              {/* How long it has left. Paused while pointed at, as the toast itself is. */}
              <span
                aria-hidden
                className={cn(
                  'tfd-toast-timer absolute bottom-0 left-0 h-0.5 w-full origin-left',
                  tone.timer,
                )}
                style={{ animationDuration: `${duration}ms` } as CSSProperties}
              />
            </RadixToast.Root>
          );
        })}
        <RadixToast.Viewport className="tfd-toast-viewport fixed right-lg bottom-lg z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-sm outline-none" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>.');
  return api;
}
