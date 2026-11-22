/** The checkbox column of a grid whose rows can be decided together (`BulkDecision`). */

import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/Checkbox';

/** A leading checkbox column for a grid whose rows can be decided together. */
export function selectionColumn<Row>({
  rows,
  selected,
  onChange,
  idOf,
  nameOf,
  selectable = () => true,
}: {
  rows: Row[];
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  idOf: (row: Row) => string;
  nameOf: (row: Row) => string;
  selectable?: (row: Row) => boolean;
}): ColumnDef<Row, unknown> {
  return {
    id: 'select',
    enableSorting: false,
    header: function SelectAll() {
      const { t } = useTranslation();
      const pickable = rows.filter(selectable).map(idOf);
      const all = pickable.length > 0 && pickable.every((id) => selected.has(id));
      return (
        <span onClick={(event) => event.stopPropagation()}>
          <Checkbox
            aria-label={t('bulk.selectAll')}
            checked={all}
            disabled={pickable.length === 0}
            onCheckedChange={(checked) => {
              const next = new Set(selected);
              for (const id of pickable) {
                if (checked === true) next.add(id);
                else next.delete(id);
              }
              onChange(next);
            }}
          />
        </span>
      );
    },
    cell: function SelectRow(info) {
      const { t } = useTranslation();
      const row = info.row.original;
      if (!selectable(row)) return null;
      const id = idOf(row);
      return (
        // The row opens its own screen on click; the box must not.
        <span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <Checkbox
            aria-label={t('bulk.selectRow', { name: nameOf(row) })}
            checked={selected.has(id)}
            onCheckedChange={(checked) => {
              const next = new Set(selected);
              if (checked === true) next.add(id);
              else next.delete(id);
              onChange(next);
            }}
          />
        </span>
      );
    },
  };
}
