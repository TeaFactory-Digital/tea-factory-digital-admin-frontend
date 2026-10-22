/**
 * How the bills calculated here are paid, numbered and charged, so they read like the
 * factory's own printed slip: the payment rounded to the factory's unit, the factory's own
 * bill numbers continuing from its last paper bill, and the interest on an advance.
 *
 * With the sync on the factory system's bills carry their own figures, so the section says
 * these are not used rather than hiding: an administrator about to switch the sync off
 * should be able to set them first.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_ADVANCE_INTEREST,
  DEFAULT_BILL_SETTINGS,
  MAX_ADVANCE_INTEREST_PERCENT,
  PAYMENT_UNITS,
  advanceInterestFor,
  advanceInterestProblem,
  billSettingsProblem,
  billSourceOf,
  type LoanInterestRecovery,
  type BillSource,
  factoryBillNumber,
  isFactorySyncEnabled,
} from '@tfd/domain';
import { CardBody } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Notice } from '@/components/ui/states';
import { formatAmount } from '@/lib/format';
import { InfoTip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/cn';
import { BILL_SOURCE_AND_RECOVERY_ON_SERVER } from '@/lib/serverReady';
import { SectionFooter, type SectionProps } from './SectionFooter';

/** The balance the interest example is worked on. */
const EXAMPLE_BALANCE = 10000;
/** The amount the rounding example is worked on: the galaboda slip's own balance. */
const EXAMPLE_PAYABLE = 68226.91;

export function BillCalculationSection(props: SectionProps) {
  const { t } = useTranslation();
  const savedSettings = props.config.billSettings ?? DEFAULT_BILL_SETTINGS;
  const savedRate = (props.config.advanceInterest ?? DEFAULT_ADVANCE_INTEREST).monthlyRatePercent;
  // A loan bears no interest unless the factory sets a rate here.
  const savedLoanRate = (props.config.loanInterest ?? DEFAULT_ADVANCE_INTEREST).monthlyRatePercent;

  const savedRecovery: LoanInterestRecovery = props.config.loanInterest?.recovery ?? 'onTop';
  const [recovery, setRecovery] = useState<LoanInterestRecovery>(savedRecovery);

  const savedSource = billSourceOf(savedSettings);
  const [source, setSource] = useState<BillSource>(savedSource);
  const [unit, setUnit] = useState(savedSettings.paymentUnit);
  const [serial, setSerial] = useState(savedSettings.nextBillSerial?.toString() ?? '');
  const [rate, setRate] = useState(String(savedRate));
  const [loanRate, setLoanRate] = useState(String(savedLoanRate));
  useEffect(() => {
    setSource(savedSource);
    setUnit(savedSettings.paymentUnit);
    setSerial(savedSettings.nextBillSerial?.toString() ?? '');
    setRate(String(savedRate));
    setLoanRate(String(savedLoanRate));
    setRecovery(savedRecovery);
  }, [
    savedRecovery,
    savedSource,
    savedSettings.paymentUnit,
    savedSettings.nextBillSerial,
    savedRate,
    savedLoanRate,
  ]);

  const nextBillSerial = serial.trim() === '' ? undefined : Number(serial);
  const settings = {
    paymentUnit: unit,
    ...(BILL_SOURCE_AND_RECOVERY_ON_SERVER ? { source } : {}),
    ...(nextBillSerial === undefined ? {} : { nextBillSerial }),
  };
  const monthlyRatePercent = rate.trim() === '' ? Number.NaN : Number(rate);
  const loanRatePercent = loanRate.trim() === '' ? Number.NaN : Number(loanRate);

  const settingsProblem = billSettingsProblem(settings);
  const rateProblem = advanceInterestProblem({ monthlyRatePercent });
  const loanRateProblem = advanceInterestProblem({ monthlyRatePercent: loanRatePercent });
  const dirty =
    source !== savedSource ||
    unit !== savedSettings.paymentUnit ||
    nextBillSerial !== savedSettings.nextBillSerial ||
    monthlyRatePercent !== savedRate ||
    loanRatePercent !== savedLoanRate ||
    recovery !== savedRecovery;

  const paid = Math.floor(EXAMPLE_PAYABLE / unit) * unit;
  const year = new Date().getFullYear();

  return (
    <CardBody className="flex flex-col gap-md">
      {isFactorySyncEnabled(props.config) ? (
        <Notice tone="info">{t('config.bill.syncOn')}</Notice>
      ) : null}
      {BILL_SOURCE_AND_RECOVERY_ON_SERVER ? (
        <Field label={t('config.bill.source')} hint={t(`config.bill.sourceHint.${source}`)}>
          {({ id, describedBy }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              disabled={props.readOnly}
              value={source}
              onChange={(event) => setSource(event.target.value as BillSource)}
            >
              <option value="imported">{t('config.bill.sourceImported')}</option>
              <option value="calculated">{t('config.bill.sourceCalculated')}</option>
            </Select>
          )}
        </Field>
      ) : null}

      {/* Rounding and bill numbers are this console's only when it calculates the bills;
          an imported bill keeps the factory's own. */}
      {source === 'calculated' ? (
        <>
          <div className="grid gap-md sm:grid-cols-2">
            <Field label={t('config.bill.paymentUnit')} hint={t('config.bill.paymentUnitHint')}>
              {({ id, describedBy }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  disabled={props.readOnly}
                  value={unit}
                  onChange={(event) => setUnit(Number(event.target.value))}
                >
                  {PAYMENT_UNITS.map((one) => (
                    <option key={one} value={one}>
                      {t('config.bill.unit', { unit: one })}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              label={t('config.bill.nextSerial')}
              hint={t('config.bill.nextSerialHint')}
              error={settingsProblem === 'bill-serial' ? t('config.bill.serialInvalid') : undefined}
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  className="numeric"
                  inputMode="numeric"
                  disabled={props.readOnly}
                  placeholder="210870"
                  value={serial}
                  onChange={(event) => setSerial(event.target.value)}
                />
              )}
            </Field>
          </div>

          <p className="text-caption text-text-secondary">
            {t('config.bill.unitExample', {
              payable: formatAmount(EXAMPLE_PAYABLE),
              paid: formatAmount(paid),
              coins: formatAmount(Math.round((EXAMPLE_PAYABLE - paid) * 100) / 100),
            })}{' '}
            {nextBillSerial !== undefined && settingsProblem === null
              ? t('config.bill.serialExample', { billNo: factoryBillNumber(year, nextBillSerial) })
              : t('config.bill.serialNone')}
          </p>
        </>
      ) : null}

      <div className="grid gap-md border-t border-divider pt-md sm:grid-cols-2">
        <Field
          label={t('config.interest.monthlyRate')}
          hint={t('config.interest.monthlyRateHint')}
          error={
            rateProblem
              ? t('config.interest.outOfRange', { max: MAX_ADVANCE_INTEREST_PERCENT })
              : undefined
          }
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              className="numeric"
              type="number"
              min={0}
              max={MAX_ADVANCE_INTEREST_PERCENT}
              step={0.25}
              disabled={props.readOnly}
              value={rate}
              onChange={(event) => setRate(event.target.value)}
            />
          )}
        </Field>

        <Field
          label={t('config.interest.loanRate')}
          hint={t('config.interest.loanRateHint')}
          error={
            loanRateProblem
              ? t('config.interest.outOfRange', { max: MAX_ADVANCE_INTEREST_PERCENT })
              : undefined
          }
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              className="numeric"
              type="number"
              min={0}
              max={MAX_ADVANCE_INTEREST_PERCENT}
              step={0.25}
              disabled={props.readOnly}
              value={loanRate}
              onChange={(event) => setLoanRate(event.target.value)}
            />
          )}
        </Field>
      </div>

      {/* How a loan's interest is recovered: only worth asking once there is a rate. */}
      {BILL_SOURCE_AND_RECOVERY_ON_SERVER && loanRatePercent > 0 && !loanRateProblem ? (
        <fieldset className="flex flex-col gap-xs">
          <legend className="pb-xs text-label text-text-primary">
            {t('config.interest.recovery')}
          </legend>
          {(['onTop', 'withinInstalment'] as const).map((option) => (
            <label
              key={option}
              className={cn(
                'flex items-center gap-sm rounded-md border px-md py-sm text-body-small',
                recovery === option ? 'border-primary bg-primary-muted' : 'border-border',
                props.readOnly && 'opacity-70',
              )}
            >
              <input
                type="radio"
                name="loan-interest-recovery"
                value={option}
                checked={recovery === option}
                disabled={props.readOnly}
                onChange={() => setRecovery(option)}
                className="accent-primary"
              />
              <span className="flex-1 text-text-primary">
                {t(`config.interest.recovery.${option}`)}
              </span>
              <InfoTip label={t(`config.interest.recovery.${option}`)} compact>
                {t(`config.interest.recovery.${option}Tip`)}
              </InfoTip>
            </label>
          ))}
        </fieldset>
      ) : null}

      {rateProblem ? null : (
        <p className="text-caption text-text-secondary">
          {monthlyRatePercent > 0
            ? t('config.interest.example', {
                balance: formatAmount(EXAMPLE_BALANCE),
                interest: formatAmount(advanceInterestFor(EXAMPLE_BALANCE, { monthlyRatePercent })),
              })
            : t('config.interest.none')}
        </p>
      )}
      <p className="text-caption text-text-secondary">{t('config.interest.how')}</p>

      <SectionFooter
        {...props}
        patch={{
          billSettings: settings,
          advanceInterest: { monthlyRatePercent },
          loanInterest: {
            monthlyRatePercent: loanRatePercent,
            ...(BILL_SOURCE_AND_RECOVERY_ON_SERVER ? { recovery } : {}),
          },
        }}
        dirty={
          dirty && settingsProblem === null && rateProblem === null && loanRateProblem === null
        }
        onRevert={() => {
          setSource(savedSource);
          setUnit(savedSettings.paymentUnit);
          setSerial(savedSettings.nextBillSerial?.toString() ?? '');
          setRate(String(savedRate));
          setLoanRate(String(savedLoanRate));
          setRecovery(savedRecovery);
        }}
      />
    </CardBody>
  );
}
