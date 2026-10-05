/**
 * "Download CSV" for a list screen: **every row the current filters match**, not only the
 * page on screen. It asks the API page by page (100 at a time) and stops at `MAX_ROWS`,
 * saying so, rather than tying the browser up on a list nobody meant to export whole.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import type { Paged } from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { downloadCsv, todayStamp } from '@/lib/csv';
import { errorMessageKey } from '@/lib/errorMessage';

const PAGE_SIZE = 100;
const MAX_ROWS = 5000;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

export function ExportCsvButton<T>({
  name,
  fetchPage,
  columns,
}: {
  /** The file's name before the date, e.g. `suppliers`. */
  name: string;
  /** One page of the list with the screen's current filters. */
  fetchPage: (page: number, pageSize: number) => Promise<Paged<T>>;
  columns: CsvColumn<T>[];
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const rows: T[] = [];
      let page = 0;
      let more = true;
      while (more && rows.length < MAX_ROWS) {
        const result = await fetchPage(page, PAGE_SIZE);
        rows.push(...result.items);
        more = result.nextPage != null && result.items.length > 0;
        page += 1;
      }
      const capped = rows.slice(0, MAX_ROWS);
      downloadCsv(
        `${name}-${todayStamp()}`,
        columns.map((column) => column.header),
        capped.map((row) => columns.map((column) => column.value(row))),
      );
      if (more || rows.length > MAX_ROWS) {
        toast.success(t('export.capped', { count: MAX_ROWS }));
      } else {
        toast.success(t('export.done', { count: capped.length }));
      }
    } catch (cause) {
      toast.error(t('export.failed'), t(errorMessageKey(cause)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="secondary"
      loading={busy}
      iconLeft={<Download className="size-icon-sm" aria-hidden />}
      onClick={() => void run()}
    >
      {t('export.csv')}
    </Button>
  );
}
