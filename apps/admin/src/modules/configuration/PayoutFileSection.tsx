/**
 * M14's sixth section: **the payout file layout, which is §21.17 as configuration.**
 *
 * The factory has not told us what its bank accepts, and the tempting build was three coded
 * serialisers behind a dropdown — two of whose layouts would have been invented. So this
 * screen edits the *layout* and lets a format's name be a preset somebody completes once
 * their bank confirms it. The reasoning lives in `packages/domain/src/payoutExport.ts`.
 *
 * **The preview is the whole design.** A column editor with no preview is a form where the
 * consequence of every choice is a file you find out about at the bank — so the sample
 * below is rendered from the *same* `serialisePayoutFile` the API writes the real file
 * with, against a fixed example row. Somebody comparing this against their bank's
 * specification can see whether it matches without downloading anything.
 *
 * Not a `StringListEditor`: a column is a pair (which fact, what heading) and its **order
 * is the meaning**, which is exactly what that component does not model.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import {
  BANK_ONLY_FIELDS,
  DEFAULT_PAYOUT_EXPORT,
  PAYOUT_EXPORT_FIELDS,
  PAYOUT_EXPORT_PRESETS,
  PAYOUT_EXPORT_PRESET_IDS,
  clonePayoutTemplate,
  payoutTemplateProblems,
  serialisePayoutFile,
  type PayoutAccountFormat,
  type PayoutAmountFormat,
  type PayoutExportDelimiter,
  type PayoutExportField,
  type PayoutExportLine,
  type PayoutExportTemplate,
  type PayoutExportPresetId,
} from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { CardBody } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Field, Input, Select } from '@/components/ui/Field';
import { Label } from '@/components/ui/Label';
import type { SectionProps } from './ConfigSections';
import { SectionFooter } from './SectionFooter';

/**
 * The row the preview is drawn from.
 *
 * A **fixed, obviously-fake** supplier rather than a real one from the fixture: this sample
 * is read next to a bank's specification, and a reader comparing column positions should
 * not have to wonder whether the account number in front of them belongs to somebody. The
 * name carries a comma on purpose — it is the value that proves the escaping works, and
 * `Perera, K.` is not a hypothetical in a Sri Lankan supplier list.
 */
const SAMPLE: PayoutExportLine = {
  supplierCode: '5091',
  supplierName: 'Perera, K.',
  accountNumber: '0071-2345678',
  bankName: 'Bank of Ceylon',
  branchName: 'Akuressa',
  amount: 4213.5,
  monthKey: '2026-07',
  method: 'bankTransfer',
};

const DELIMITERS: PayoutExportDelimiter[] = ['comma', 'semicolon', 'pipe', 'tab'];
const AMOUNT_FORMATS: PayoutAmountFormat[] = ['decimal2', 'cents', 'whole'];
const ACCOUNT_FORMATS: PayoutAccountFormat[] = ['plain', 'digitsOnly'];

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function PayoutFileSection(props: SectionProps) {
  const { t } = useTranslation();

  const saved = props.config.payouts?.export ?? DEFAULT_PAYOUT_EXPORT;
  const [draft, setDraft] = useState<PayoutExportTemplate>(() => clonePayoutTemplate(saved));
  useEffect(() => setDraft(clonePayoutTemplate(saved)), [saved]);

  const dirty = !same(draft, saved);
  const problems = payoutTemplateProblems(draft);

  /**
   * The sample file, from the shared serialiser.
   *
   * Two rows: one complete, and one with **no bank details**, because that is the case a
   * factory has to see before it uploads anything — a cheque or cash run has no account
   * number, and the column comes out empty rather than absent.
   */
  const preview = useMemo(() => {
    if (problems.length > 0) return '';
    return serialisePayoutFile(
      [SAMPLE, { ...SAMPLE, supplierCode: '5104', supplierName: 'W. Silva', accountNumber: null, bankName: null, branchName: null, amount: 890 }],
      draft,
    );
  }, [draft, problems.length]);

  /** Fields not yet used. A column list that offered a duplicate would be refused anyway. */
  const unused = PAYOUT_EXPORT_FIELDS.filter(
    (field) => !draft.columns.some((column) => column.field === field),
  );

  function applyPreset(id: PayoutExportPresetId) {
    setDraft(clonePayoutTemplate(PAYOUT_EXPORT_PRESETS[id]));
  }

  function move(index: number, by: -1 | 1) {
    const next = [...draft.columns];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setDraft({ ...draft, columns: next });
  }

  return (
    <CardBody className="flex flex-col gap-lg">
      {/**
       * What this screen can and cannot do, before anything is edited.
       *
       * Somebody arriving here has been told the bank needs "SLIPS", and the honest answer
       * is that a column template covers the CSV family and not a fixed-width scheme with
       * control totals. Saying it here is the difference between a factory configuring the
       * thing that works and a factory building a file the bank rejects.
       */}
      <p className="rounded-md bg-surface-variant px-md py-sm text-body-small text-text-secondary">
        {t('config.payoutFile.scope')}
      </p>

      <Field label={t('config.payoutFile.preset')} hint={t('config.payoutFile.presetHint')}>
        {({ id, describedBy }) => (
          <div className="flex flex-wrap gap-sm">
            {PAYOUT_EXPORT_PRESET_IDS.map((one) => (
              <Button
                key={one}
                id={one === PAYOUT_EXPORT_PRESET_IDS[0] ? id : undefined}
                aria-describedby={describedBy}
                size="sm"
                variant="secondary"
                disabled={props.readOnly}
                onClick={() => applyPreset(one)}
              >
                {t(`config.payoutFile.preset.${one}`)}
              </Button>
            ))}
          </div>
        )}
      </Field>

      <div className="grid gap-md md:grid-cols-2">
        <Field label={t('config.payoutFile.delimiter')}>
          {({ id }) => (
            <Select
              id={id}
              disabled={props.readOnly}
              value={draft.delimiter}
              onChange={(event) =>
                setDraft({ ...draft, delimiter: event.target.value as PayoutExportDelimiter })
              }
            >
              {DELIMITERS.map((one) => (
                <option key={one} value={one}>
                  {t(`config.payoutFile.delimiter.${one}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label={t('config.payoutFile.amountFormat')}
          hint={t('config.payoutFile.amountFormatHint')}
        >
          {({ id, describedBy }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              disabled={props.readOnly}
              value={draft.amountFormat}
              onChange={(event) =>
                setDraft({ ...draft, amountFormat: event.target.value as PayoutAmountFormat })
              }
            >
              {AMOUNT_FORMATS.map((one) => (
                <option key={one} value={one}>
                  {t(`config.payoutFile.amountFormat.${one}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label={t('config.payoutFile.accountFormat')}>
          {({ id }) => (
            <Select
              id={id}
              disabled={props.readOnly}
              value={draft.accountFormat}
              onChange={(event) =>
                setDraft({ ...draft, accountFormat: event.target.value as PayoutAccountFormat })
              }
            >
              {ACCOUNT_FORMATS.map((one) => (
                <option key={one} value={one}>
                  {t(`config.payoutFile.accountFormat.${one}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field
          label={t('config.payoutFile.reference')}
          hint={t('config.payoutFile.referenceHint')}
        >
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              disabled={props.readOnly}
              value={draft.referenceTemplate}
              onChange={(event) => setDraft({ ...draft, referenceTemplate: event.target.value })}
            />
          )}
        </Field>
      </div>

      <Label className="flex items-center gap-sm text-body-small text-text-primary">
        <Checkbox
          checked={draft.headerRow}
          disabled={props.readOnly}
          onCheckedChange={(checked) => setDraft({ ...draft, headerRow: checked === true })}
        />
        {t('config.payoutFile.headerRow')}
      </Label>

      {/* ── the columns ─────────────────────────────────────────────────── */}
      <fieldset className="flex flex-col gap-sm">
        <legend className="text-label text-text-primary">{t('config.payoutFile.columns')}</legend>
        <p className="text-caption text-text-secondary">{t('config.payoutFile.columnsHint')}</p>

        <ul className="flex flex-col gap-xs">
          {draft.columns.map((column, index) => (
            <li
              key={column.field}
              className="flex flex-wrap items-center gap-sm rounded-md border border-border px-sm py-xs"
            >
              <span className="numeric w-6 shrink-0 text-caption text-text-secondary">
                {index + 1}
              </span>

              <span className="min-w-40 flex-1 text-body-small text-text-primary">
                {t(`config.payoutFile.field.${column.field}`)}
                {/* An account column on a template that also serves cheque and cash runs
                    comes out empty there. Marked on the row, not only in the impact list. */}
                {BANK_ONLY_FIELDS.includes(column.field) ? (
                  <span className="ml-xs text-caption text-text-secondary">
                    {t('config.payoutFile.bankOnly')}
                  </span>
                ) : null}
              </span>

              {/* The heading the bank matches on — literal text, never translated (BR-110
                  has an exception here and `PayoutExportColumn.label` records why). */}
              <Input
                aria-label={t('config.payoutFile.headingFor', {
                  field: t(`config.payoutFile.field.${column.field}`),
                })}
                className="w-48"
                fullWidth={false}
                disabled={props.readOnly || !draft.headerRow}
                placeholder={t('config.payoutFile.headingPlaceholder')}
                value={column.label}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    columns: draft.columns.map((one, i) =>
                      i === index ? { ...one, label: event.target.value } : one,
                    ),
                  })
                }
              />

              <span className="flex items-center gap-xxs">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t('config.payoutFile.moveUp')}
                  disabled={props.readOnly || index === 0}
                  onClick={() => move(index, -1)}
                  iconLeft={<ArrowUp className="size-icon-sm" aria-hidden />}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t('config.payoutFile.moveDown')}
                  disabled={props.readOnly || index === draft.columns.length - 1}
                  onClick={() => move(index, 1)}
                  iconLeft={<ArrowDown className="size-icon-sm" aria-hidden />}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t('config.payoutFile.removeColumn', {
                    field: t(`config.payoutFile.field.${column.field}`),
                  })}
                  disabled={props.readOnly}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      columns: draft.columns.filter((_, i) => i !== index),
                    })
                  }
                  iconLeft={<Trash2 className="size-icon-sm" aria-hidden />}
                />
              </span>
            </li>
          ))}
        </ul>

        {unused.length > 0 && !props.readOnly ? (
          <div className="flex flex-wrap items-center gap-xs">
            {unused.map((field: PayoutExportField) => (
              <Button
                key={field}
                size="sm"
                variant="ghost"
                iconLeft={<Plus className="size-icon-sm" aria-hidden />}
                onClick={() =>
                  setDraft({
                    ...draft,
                    // Defaulted to the field's own name so a header row is never blank by
                    // accident — which the shared validation would refuse anyway.
                    columns: [
                      ...draft.columns,
                      { field, label: t(`config.payoutFile.field.${field}`) },
                    ],
                  })
                }
              >
                {t(`config.payoutFile.field.${field}`)}
              </Button>
            ))}
          </div>
        ) : null}
      </fieldset>

      {/* ── the preview ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-xs">
        <p className="text-label text-text-primary">{t('config.payoutFile.preview')}</p>
        <p className="text-caption text-text-secondary">{t('config.payoutFile.previewHint')}</p>

        {preview ? (
          // `<pre>` because column alignment is the thing being read, and a proportional
          // font makes two adjacent commas look like one.
          <pre className="numeric overflow-x-auto rounded-md bg-surface-variant px-md py-sm text-caption text-text-primary">
            {preview}
          </pre>
        ) : (
          <p className="rounded-md bg-error-muted px-md py-sm text-caption text-error">
            {t('config.payoutFile.previewBlocked')}
          </p>
        )}
      </div>

      <SectionFooter
        {...props}
        patch={{ payouts: { export: draft } }}
        dirty={dirty}
        onRevert={() => setDraft(clonePayoutTemplate(saved))}
      />
    </CardBody>
  );
}
