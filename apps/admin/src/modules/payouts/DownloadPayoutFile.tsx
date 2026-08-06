/**
 * The payout file, downloaded (§21.17).
 *
 * **The honest label is the design here.** The button does not say "Bank file", because the
 * console cannot promise that: what it produces is a delimited file shaped by the template
 * the factory configured in M14 (`payoutExport.ts`), which covers the CSV family that most
 * banks' bulk-upload sheets belong to and does not cover a fixed-width scheme with control
 * totals. A button labelled for what it is, next to a line saying what it is not, is what
 * stops an office uploading the wrong thing and finding out at the bank.
 *
 * **Only on an approved run.** The server refuses a draft (`run-not-approved`) and this
 * withholds the control, for the same reason as everywhere else in M6: a file generated
 * before the four-eyes release and uploaded to the bank walks straight around BR-501 — the
 * approval would become a formality performed after the money moved.
 *
 * The bytes come from the server rather than being assembled here, and that is not an
 * arbitrary split: a payment file needs **full** account numbers, every payload the console
 * holds has them masked (§20.4), and handing two hundred of them out is an audited act.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import type { PayoutRun } from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { payoutRepository } from '@/services/repositories/payoutRepository';

export function DownloadPayoutFile({ run }: { run: PayoutRun }) {
  const { t } = useTranslation();
  const toast = useToast();
  const canRead = useCan('payouts', 'read');
  const [busy, setBusy] = useState(false);

  // A draft has not been released, and a run with nothing payable would produce a file of
  // headings. Neither is offered rather than offered-and-refused.
  if (run.status === 'draft' || !canRead) return null;

  async function download() {
    setBusy(true);
    try {
      const { body, filename } = await payoutRepository.file(run.id);

      /**
       * A `Blob` and a synthetic click.
       *
       * Not an `<a href>` to the endpoint: it needs the `Authorization` header, and a URL
       * that carried the token instead would put it in browser history and any proxy log —
       * for the one endpoint in this API that answers with account numbers.
       */
      const url = URL.createObjectURL(new Blob([body], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      // Says that it was recorded, because it was — the same reason M2's bank reveal shows
      // the audit id rather than only logging one.
      toast.success(t('payouts.fileDownloaded'), t('payouts.fileDownloadedHint'));
    } catch (cause) {
      toast.error(t('payouts.fileFailed'), t(errorMessageKey(cause)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="secondary"
      loading={busy}
      iconLeft={<Download className="size-icon-sm" aria-hidden />}
      onClick={() => void download()}
    >
      {t('payouts.downloadFile')}
    </Button>
  );
}
