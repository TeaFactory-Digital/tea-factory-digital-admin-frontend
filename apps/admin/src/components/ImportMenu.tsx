/**
 * "Import from file": the bulk half of every factory-record screen.
 *
 * One kind opens the dialog straight away; several (the suppliers screen imports both
 * suppliers and their opening balances) open a short menu first. Shown only while the
 * office keeps the factory's records here, and only to someone who may write them.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, FileUp } from 'lucide-react';
import type { ImportKind } from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { ImportDialog } from './ImportDialog';

export function ImportMenu({ kinds }: { kinds: readonly [ImportKind, ...ImportKind[]] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<ImportKind | null>(null);
  const icon = <FileUp className="size-icon-sm" aria-hidden />;

  return (
    <>
      {kinds.length === 1 ? (
        <Button variant="secondary" iconLeft={icon} onClick={() => setOpen(kinds[0])}>
          {t('records.import.button')}
        </Button>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              iconLeft={icon}
              iconRight={<ChevronDown className="size-icon-sm" aria-hidden />}
            >
              {t('records.import.button')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {kinds.map((kind) => (
              <DropdownMenuItem key={kind} onSelect={() => setOpen(kind)}>
                {t(`records.import.title.${kind}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {open ? <ImportDialog kind={open} open onClose={() => setOpen(null)} /> : null}
    </>
  );
}
