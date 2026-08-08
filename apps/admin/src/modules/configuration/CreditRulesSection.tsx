/**
 * M14 — **how much a supplier may borrow, and how that is worked out.**
 *
 * The three ceilings used to be formulas in the build with two constants behind them,
 * which meant a factory wanting *"manure: average the last three months, capped at
 * 20,000"* needed a release. That is exactly the shape of thing white-label.md says
 * belongs in a `client_config` row.
 *
 * It matters more than the other configurable values because of **who sees the result**:
 * the ceiling is printed in the supplier's app before they ask for anything. A limit
 * this platform guessed at is a supplier told they may borrow money the office then
 * refuses — a worse conversation than any missing feature.
 *
 * ## The screen's one job: show what the numbers add up to
 *
 * Four fields per facility is enough to express every formula the product has ever
 * used, and four fields is also enough to be got wrong silently. So each facility
 * carries a **plain-language reading of its own rule** underneath — *"3 × the average
 * of the last 6 months, once the supplier has 6 settled months"* — because an
 * administrator setting a multiplier should not have to hold the arithmetic in their
 * head to know what they just typed.
 *
 * ## Why the basis is a dropdown rather than free text
 *
 * The three options are the three things a tea factory prices credit off, and they are
 * not interchangeable: an advance is against leaf **already in the shed**, a loan
 * against a **track record**, and manure against the **last month that settled**. A
 * free-form expression box would let somebody write a rule nobody can reproduce, on
 * the one screen where the app and the office must agree byte for byte (AC-05).
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CREDIT_FACILITIES,
  DEFAULT_CREDIT_RULES,
  creditRuleProblems,
  type CreditFacility,
  type CreditRule,
  type CreditRuleBasis,
  type CreditRules,
} from '@tfd/domain';
import { CardBody } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Notice } from '@/components/ui/states';
import { formatAmount } from '@/lib/format';
import { SectionFooter, type SectionProps } from './SectionFooter';

const BASES: CreditRuleBasis[] = ['thisMonthLeaf', 'lastSettledMonth', 'averageIncome'];

/** Which flag turns each facility off entirely — so a rule for it can say it is inert. */
const FACILITY_FLAGS = {
  advance: 'enableAdvances',
  loan: 'enableLoans',
  manure: 'enableManure',
} as const;

export function CreditRulesSection(props: SectionProps) {
  const { t } = useTranslation();
  const current = props.config.creditRules ?? DEFAULT_CREDIT_RULES;
  const [draft, setDraft] = useState<CreditRules>(current);

  useEffect(() => {
    setDraft(props.config.creditRules ?? DEFAULT_CREDIT_RULES);
  }, [props.config.creditRules]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(current);
  const problems = CREDIT_FACILITIES.flatMap((facility) =>
    creditRuleProblems(draft[facility]).map((problem) => ({ facility, problem })),
  );

  const set = (facility: CreditFacility, patch: Partial<CreditRule>) =>
    setDraft({ ...draft, [facility]: { ...draft[facility], ...patch } });

  return (
    <CardBody className="flex flex-col gap-lg">
      {/**
       * Said once, at the top, because it is the property that makes this screen safe
       * to hand to an office: the same rule produces the ceiling the app shows and the
       * ceiling the queue checks. One rule, two readers — never two calculations.
       */}
      <Notice tone="info">{t('config.creditRules.scope')}</Notice>

      {props.config.creditRules ? null : (
        <Notice tone="warning">{t('config.creditRules.usingDefaults')}</Notice>
      )}

      {CREDIT_FACILITIES.map((facility) => {
        const rule = draft[facility];
        const off = !props.config.flags[FACILITY_FLAGS[facility]];

        return (
          <fieldset key={facility} className="flex flex-col gap-sm border-t border-divider pt-md">
            <legend className="text-label text-text-primary">
              {t(`credit.facility.${facility}`)}
            </legend>

            {/* A rule for a facility the factory does not offer is not an error — a
                factory may set it up before turning it on — but the screen should not
                let somebody believe they have just changed what suppliers can borrow. */}
            {off ? (
              <p className="text-caption text-text-secondary">
                {t('config.creditRules.facilityOff')}
              </p>
            ) : null}

            <div className="grid gap-sm sm:grid-cols-2">
              <Field
                label={t('config.creditRules.basis')}
                hint={t(`config.creditRules.basisHint.${rule.basis}`)}
              >
                {({ id, describedBy }) => (
                  <Select
                    id={id}
                    aria-describedby={describedBy}
                    disabled={props.readOnly}
                    value={rule.basis}
                    onChange={(event) =>
                      set(facility, { basis: event.target.value as CreditRuleBasis })
                    }
                  >
                    {BASES.map((basis) => (
                      <option key={basis} value={basis}>
                        {t(`config.creditRules.basisLabel.${basis}`)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field
                label={t('config.creditRules.multiplier')}
                hint={t('config.creditRules.multiplierHint')}
              >
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    className="numeric"
                    type="number"
                    min={0.1}
                    step={0.5}
                    aria-describedby={describedBy}
                    disabled={props.readOnly}
                    value={rule.multiplier}
                    onChange={(event) =>
                      set(facility, { multiplier: Number(event.target.value) || 0 })
                    }
                  />
                )}
              </Field>

              {/* Only asked for when it is actually used. A months-to-average box beside
                  a rule that prices off this month's leaf is a number with no effect,
                  and an administrator who changes it and sees nothing happen stops
                  trusting the screen. */}
              {rule.basis === 'averageIncome' ? (
                <Field
                  label={t('config.creditRules.averageOverMonths')}
                  hint={t('config.creditRules.averageOverMonthsHint')}
                >
                  {({ id, describedBy }) => (
                    <Input
                      id={id}
                      className="numeric"
                      type="number"
                      min={1}
                      step={1}
                      aria-describedby={describedBy}
                      disabled={props.readOnly}
                      value={rule.averageOverMonths}
                      onChange={(event) =>
                        set(facility, { averageOverMonths: Number(event.target.value) || 0 })
                      }
                    />
                  )}
                </Field>
              ) : null}

              <Field
                label={t('config.creditRules.requiredMonths')}
                hint={t('config.creditRules.requiredMonthsHint')}
              >
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    className="numeric"
                    type="number"
                    min={0}
                    step={1}
                    aria-describedby={describedBy}
                    disabled={props.readOnly}
                    value={rule.requiredMonths}
                    onChange={(event) =>
                      set(facility, { requiredMonths: Number(event.target.value) || 0 })
                    }
                  />
                )}
              </Field>

              <Field
                label={t('config.creditRules.maxAmount')}
                hint={t('config.creditRules.maxAmountHint')}
              >
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    className="numeric"
                    type="number"
                    min={0}
                    step={1000}
                    placeholder={t('config.creditRules.noCap')}
                    aria-describedby={describedBy}
                    disabled={props.readOnly}
                    value={rule.maxAmount ?? ''}
                    onChange={(event) =>
                      /**
                       * Empty means **no cap**, not zero. `0` would offer every supplier
                       * a ceiling of nothing, which is a policy nobody meant to write —
                       * and `null` keeps "uncapped" a state rather than a figure the
                       * reader has to recognise.
                       */
                      set(facility, {
                        maxAmount: event.target.value === '' ? null : Number(event.target.value),
                      })
                    }
                  />
                )}
              </Field>
            </div>

            {/* What the four numbers actually mean, in a sentence. */}
            <p className="text-caption text-text-secondary">
              {t(`config.creditRules.summary.${rule.basis}`, {
                multiplier: rule.multiplier,
                months: rule.averageOverMonths,
              })}
              {rule.requiredMonths > 0
                ? ` ${t('config.creditRules.summaryHistory', { months: rule.requiredMonths })}`
                : ` ${t('config.creditRules.summaryNoHistory')}`}
              {rule.maxAmount !== null
                ? ` ${t('config.creditRules.summaryCap', { amount: formatAmount(rule.maxAmount) })}`
                : ''}
            </p>
          </fieldset>
        );
      })}

      {problems.length > 0 ? (
        <ul className="flex flex-col gap-xxs">
          {problems.map(({ facility, problem }) => (
            <li key={`${facility}-${problem}`} className="text-caption text-error">
              {t(`credit.facility.${facility}`)}: {t(`config.impact.creditRule.${problem}`)}
            </li>
          ))}
        </ul>
      ) : null}

      <SectionFooter
        {...props}
        patch={{ creditRules: draft }}
        dirty={dirty && problems.length === 0}
        onRevert={() => setDraft(props.config.creditRules ?? DEFAULT_CREDIT_RULES)}
      />
    </CardBody>
  );
}
