/**
 * Deciding several queue items at once (22 November 2026): a selection column for the grid,
 * the bar that appears while something is selected, and the dialog that puts one note on
 * every item.
 *
 * Each item is still decided **on its own request**, one after the other, so every check the
 * single decision has still applies to it (four-eyes, the clerk's limit, a stale ceiling, a
 * supplier suspended since). An item that cannot be decided is listed with its reason and
 * stays in the queue; the rest go through. Items the console can already tell would fail
 * (over the supplier's limit, no working to judge it by) are left out before anything is sent,
 * and the dialog says why.
 */

import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, CircleSlash, XCircle } from 'lucide-react';
import type { NoteSuggestionKey } from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey, errorMessageValues } from '@/lib/errorMessage';
import { cn } from '@/lib/cn';
import { playSound } from '@/lib/sound/uiSound';
import { Meter } from './charts/Meter';
import { DecisionNoteField, type NoteSuggestion } from './DecisionNoteField';
import { useNoteSuggestions } from './useNoteSuggestions';

const MIN_NOTE = 10;

/** Shown while items are selected: how many, and the two decisions. */
export function BulkBar({
  count,
  onApprove,
  onReject,
  onClear,
}: {
  count: number;
  onApprove?: () => void;
  onReject: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  if (count === 0) return null;
  return (
    <div role="toolbar" aria-label={t('bulk.toolbar')} className="flex flex-wrap items-center gap-sm rounded-md border border-primary/30 bg-primary-muted px-md py-sm">
      <span className="text-body-small font-semibold text-text-primary">{t('bulk.selected', { count })}</span>
      {onApprove ? (
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            playSound('open');
            onApprove();
          }}
        >
          {t('bulk.approve')}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          playSound('open');
          onReject();
        }}
      >
        {t('bulk.reject')}
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear}>
        {t('bulk.clear')}
      </Button>
    </div>
  );
}

export interface BulkItem {
  id: string;
  /** Who and what, as the queue names it: "5708 Saman Kumara". */
  label: string;
  /** The figure the decision turns on (an amount, a change). */
  detail?: ReactNode;
  /** Set when the console already knows this one would be refused: it is not sent. */
  skip?: string;
}

type Outcome = { state: 'done' } | { state: 'failed'; reason: string };

export function BulkDecisionDialog({
  verb,
  items,
  noteList,
  builtIn,
  decide,
  onClose,
  notice,
}: {
  verb: 'approve' | 'reject';
  items: BulkItem[];
  /** The queue's chip list for this verb (Configuration, Common notes). */
  noteList: NoteSuggestionKey;
  builtIn: NoteSuggestion[];
  decide: (id: string, note: string) => Promise<unknown>;
  /** `decided` lists the ids that went through, so the caller can clear them. */
  onClose: (decided: string[]) => void;
  /** Shown above the list: the reminder to enter approvals in the factory's system. */
  notice?: ReactNode;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const suggestions = useNoteSuggestions(noteList, builtIn);
  const [note, setNote] = useState('');
  const [running, setRunning] = useState(false);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const finished = Object.keys(outcomes).length > 0 && !running;

  const sendable = items.filter((item) => !item.skip);
  const tooShort = note.trim().length < MIN_NOTE;
  const decided = Object.entries(outcomes).filter(([, o]) => o.state === 'done').map(([id]) => id);

  async function run() {
    playSound('confirm');
    setRunning(true);
    const results: Record<string, Outcome> = {};
    for (const item of sendable) {
      try {
        await decide(item.id, note.trim());
        results[item.id] = { state: 'done' };
      } catch (cause) {
        results[item.id] = { state: 'failed', reason: t(errorMessageKey(cause), errorMessageValues(cause)) };
      }
      setOutcomes({ ...results });
    }
    setRunning(false);
    const done = Object.values(results).filter((o) => o.state === 'done').length;
    const failed = sendable.length - done;
    if (failed === 0) toast.success(t('bulk.result', { done, failed }));
    else toast.show({ tone: 'info', title: t('bulk.result', { done, failed }) });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !running) onClose(decided);
      }}
      title={t(verb === 'approve' ? 'bulk.approveTitle' : 'bulk.rejectTitle', { count: sendable.length })}
      description={t('bulk.body')}
      footer={
        finished ? (
          <Button variant="primary" onClick={() => onClose(decided)}>
            {t('bulk.close')}
          </Button>
        ) : (
          <>
            <Button variant="secondary" disabled={running} onClick={() => onClose(decided)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={verb === 'approve' ? 'primary' : 'danger'}
              disabled={tooShort || sendable.length === 0}
              loading={running}
              onClick={() => void run()}
            >
              {t(verb === 'approve' ? 'bulk.submitApprove' : 'bulk.submitReject', { count: sendable.length })}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-md">
        {verb === 'approve' && notice ? notice : null}
        {/* Live while it runs (26 November 2026): each item is its own request, so a long
            list takes a moment, and a count that moves says it has not stalled. */}
        {running ? (
          <div className="flex flex-col gap-xs">
            <span aria-live="polite" className="numeric text-body-small font-medium text-text-primary">
              {t('bulk.progress', { done: Object.keys(outcomes).length, total: sendable.length })}
            </span>
            <Meter
              value={sendable.length === 0 ? 0 : Object.keys(outcomes).length / sendable.length}
              label={t('bulk.items')}
            />
          </div>
        ) : null}
        <ul className="relative max-h-64 overflow-auto rounded-md border border-divider" aria-label={t('bulk.items')}>
          {items.map((item) => {
            const outcome = outcomes[item.id];
            return (
              <li key={item.id} className={cn('flex items-start justify-between gap-md border-b border-divider px-md py-xs text-body-small last:border-b-0', item.skip && 'opacity-70')}>
                <span className="flex flex-col">
                  <span className="font-medium text-text-primary">{item.label}</span>
                  {item.skip ? (
                    <span className="flex items-center gap-xxs text-caption text-text-secondary">
                      <CircleSlash className="size-icon-xs" aria-hidden />
                      {t('bulk.skipped', { reason: item.skip })}
                    </span>
                  ) : outcome?.state === 'failed' ? (
                    <span className="flex items-center gap-xxs text-caption text-error">
                      <XCircle className="size-icon-xs" aria-hidden />
                      {t('bulk.failed', { reason: outcome.reason })}
                    </span>
                  ) : outcome?.state === 'done' ? (
                    <span className="flex items-center gap-xxs text-caption text-success">
                      <CheckCircle2 className="size-icon-xs" aria-hidden />
                      {t('bulk.done')}
                    </span>
                  ) : null}
                </span>
                {item.detail ? <span className="numeric shrink-0 text-text-primary">{item.detail}</span> : null}
              </li>
            );
          })}
        </ul>
        {finished ? null : (
          <DecisionNoteField
            label={t('common.note')}
            hint={t('bulk.noteHint', { min: MIN_NOTE })}
            value={note}
            onChange={setNote}
            suggestions={suggestions}
            suggestionsLabel={t('common.noteSuggestions')}
          />
        )}
      </div>
    </Dialog>
  );
}
