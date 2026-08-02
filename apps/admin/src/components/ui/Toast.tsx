/**
 * Toasts, for the confirmation half of an action.
 *
 * A rule worth stating because it is easy to break: **a toast may confirm, never
 * inform.** "Approved — the app will show the new value on next refresh" is a
 * toast. A four-eyes refusal is not: it is a dialog, because a message that
 * disappears after four seconds is a message the clerk can miss and then wonder
 * why the queue did not change.
 */

import * as RadixToast from '@radix-ui/react-toast';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { cn } from '@/lib/cn';

export type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
}

interface ToastApi {
  show: (toast: Omit<ToastItem, 'id'>) => void;
  success: (title: string, body?: string) => void;
  error: (title: string, body?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS = {
  success: CheckCircle2,
  error: TriangleAlert,
  info: Info,
} as const;

const TONES: Record<ToastTone, string> = {
  success: 'border-success text-success',
  error: 'border-error text-error',
  info: 'border-info text-info',
};

export function ToastProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((toast: Omit<ToastItem, 'id'>) => {
    setItems((current) => [...current, { ...toast, id: Date.now() + current.length }]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, body) => show({ tone: 'success', title, body }),
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
          return (
            <RadixToast.Root
              key={item.id}
              onOpenChange={(open) => {
                if (!open) setItems((current) => current.filter((i) => i.id !== item.id));
              }}
              className={cn(
                'flex items-start gap-sm rounded-md border border-border bg-surface px-md py-sm shadow-lg',
                'border-l-4',
                TONES[item.tone],
              )}
            >
              <Icon className="size-icon-md shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <RadixToast.Title className="text-body-small font-semibold text-text-primary">
                  {item.title}
                </RadixToast.Title>
                {item.body ? (
                  <RadixToast.Description className="mt-xxs text-caption text-text-secondary">
                    {item.body}
                  </RadixToast.Description>
                ) : null}
              </div>
              <RadixToast.Close className="rounded-sm p-xxs text-text-secondary hover:bg-surface-variant">
                <X className="size-icon-sm" aria-hidden />
              </RadixToast.Close>
            </RadixToast.Root>
          );
        })}
        <RadixToast.Viewport className="fixed right-lg bottom-lg z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-sm outline-none" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>.');
  return api;
}
