/**
 * The welcome tour (24 November 2026): four short steps the first time someone signs in,
 * on where things are. It greets each person once (`tourSeen`, per user) and opens again
 * from the user menu or Ctrl+K. A dialog, not a spotlight over the page: it reads the same
 * with a screen reader, at any width, and never points at something this role cannot see.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Check, Inbox, ListChecks, Search, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { useCurrentUser } from '@/auth/authStore';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { cn } from '@/lib/cn';
import { TOUR_EVENT, markTourSeen, tourSeen } from './tourEvent';

const STEPS: { key: string; icon: LucideIcon }[] = [
  { key: 'today', icon: ListChecks },
  { key: 'queues', icon: Inbox },
  { key: 'find', icon: Search },
  { key: 'yours', icon: SlidersHorizontal },
];

export function WelcomeTour() {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // The first time this person signs in on this browser.
  useEffect(() => {
    if (user && !tourSeen(user.id)) {
      setStep(0);
      setOpen(true);
    }
  }, [user]);

  useEffect(() => {
    const onAsk = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(TOUR_EVENT, onAsk);
    return () => window.removeEventListener(TOUR_EVENT, onAsk);
  }, []);

  function close() {
    setOpen(false);
    if (user) markTourSeen(user.id);
  }

  const current = STEPS[step]!;
  const Icon = current.icon;
  const last = step === STEPS.length - 1;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
      title={step === 0 && user ? t('tour.welcome', { name: user.name }) : t(`tour.${current.key}.title`)}
      description={t('tour.progress', { step: step + 1, total: STEPS.length })}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-sm">
          <Button variant="ghost" onClick={close}>
            {t('tour.skip')}
          </Button>
          <div className="flex items-center gap-sm">
            {step > 0 ? (
              <Button
                variant="secondary"
                iconLeft={<ArrowLeft className="size-icon-sm" aria-hidden />}
                onClick={() => setStep((n) => n - 1)}
              >
                {t('tour.back')}
              </Button>
            ) : null}
            <Button
              variant="primary"
              iconLeft={last ? <Check className="size-icon-sm" aria-hidden /> : undefined}
              iconRight={last ? undefined : <ArrowRight className="size-icon-sm" aria-hidden />}
              onClick={() => (last ? close() : setStep((n) => n + 1))}
            >
              {last ? t('tour.done') : t('tour.next')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-md">
        <div className="flex items-start gap-md">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary"
          >
            <Icon className="size-icon-md" />
          </span>
          <div className="flex flex-col gap-xs">
            {step === 0 ? (
              <p className="text-subtitle font-semibold text-text-primary">{t(`tour.${current.key}.title`)}</p>
            ) : null}
            <p className="text-body text-text-primary">{t(`tour.${current.key}.body`)}</p>
          </div>
        </div>
        {/* Where they are, for the eye; the description above says it in words. */}
        <div aria-hidden className="flex justify-center gap-xs">
          {STEPS.map((one, index) => (
            <span
              key={one.key}
              className={cn('h-1.5 rounded-full transition-all', index === step ? 'w-6 bg-primary' : 'w-1.5 bg-border')}
            />
          ))}
        </div>
      </div>
    </Dialog>
  );
}
