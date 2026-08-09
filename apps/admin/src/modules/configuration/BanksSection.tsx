/**
 * M14 — the bank and branch catalogue the app's payout screen chooses from.
 *
 * **Its own section because it outgrew the one it was in.** It used to be a third list
 * under *Collection & payment*, beside the collection points and the savings rates, back
 * when a factory kept five banks with four branches each typed in by hand. The catalogue
 * is now the SLIPS list — 45 institutions and some 3,682 branches — and those five other
 * settings had been pushed so far down the page that nobody would find them.
 *
 * ## One bank's branches at a time
 *
 * The old editor rendered every bank's branches expanded, all at once. At the hand-typed
 * size that was twenty inputs and the right answer: everything visible, nothing to click
 * into. At the real size it is **forty-five nested editors and about 3,682 text inputs**,
 * which is slow to render, impossible to scan, and hides the one bank the administrator
 * came here to change.
 *
 * So the bank list stays whole — it is short enough to read, and it is the list a factory
 * actually edits — and branches are shown for the **selected bank only**. The bank being
 * edited is the thing an administrator holds in their head; the other forty-four are not.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CardBody } from '@/components/ui/Card';
import { Field, Select } from '@/components/ui/Field';
import { StringListEditor } from './StringListEditor';
import { SectionFooter, type SectionProps } from './SectionFooter';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function BanksSection(props: SectionProps) {
  const { t } = useTranslation();

  const [banks, setBanks] = useState(props.config.banks);
  /**
   * Which bank's branches are open, by name rather than by index.
   *
   * An index would follow the *position*: delete the bank above the one being edited and
   * the panel silently switches to a different bank's branches, with the edits still in
   * the box. A name survives its neighbours being removed.
   */
  const [openBank, setOpenBank] = useState<string>('');

  useEffect(() => {
    setBanks(props.config.banks);
  }, [props.config, props.config.banks]);

  const selected = useMemo(
    () => banks.find((bank) => bank.name === openBank),
    [banks, openBank],
  );

  const dirty = !same(banks, props.config.banks);

  return (
    <CardBody className="flex flex-col gap-lg">
      <StringListEditor
        items={banks.map((bank) => bank.name)}
        onChange={(next) =>
          setBanks(
            next.map((name) => banks.find((bank) => bank.name === name) ?? { name, branches: [] }),
          )
        }
        label={t('config.banks')}
        addLabel={t('config.addBank')}
        placeholder="Bank of Ceylon"
        usage={props.usage.suppliersByBank}
        readOnly={props.readOnly}
      />

      {banks.length > 0 ? (
        <div className="flex flex-col gap-md border-t border-divider pt-lg">
          <Field label={t('config.branchesFor')} hint={t('config.branchesForHint')}>
            {({ id, describedBy }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={openBank}
                onChange={(event) => setOpenBank(event.target.value)}
              >
                {/*
                 * Nothing chosen by default, and it says so.
                 *
                 * Opening on the first bank would put an editable list of 582 Bank of
                 * Ceylon branches in front of someone who came to add one branch to a
                 * different bank — and make a stray keystroke land in the wrong catalogue.
                 */}
                <option value="">{t('config.branchesPickBank')}</option>
                {banks.map((bank) => (
                  <option key={bank.name} value={bank.name}>
                    {bank.name} ({bank.branches.length})
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {selected ? (
            <StringListEditor
              items={selected.branches}
              onChange={(branches) =>
                setBanks(
                  banks.map((one) => (one.name === selected.name ? { ...one, branches } : one)),
                )
              }
              label={t('config.branchesOf', { bank: selected.name })}
              addLabel={t('config.addBranch')}
              placeholder="Akuressa"
              readOnly={props.readOnly}
            />
          ) : null}
        </div>
      ) : null}

      <SectionFooter
        {...props}
        dirty={dirty}
        patch={{ banks }}
        onRevert={() => setBanks(props.config.banks)}
      />
    </CardBody>
  );
}
