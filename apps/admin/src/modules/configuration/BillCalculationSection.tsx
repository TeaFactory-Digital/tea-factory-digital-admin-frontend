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
  factoryBillNumber,
  isFactorySyncEnabled,
} from '@tfd/domain';
import { CardBody } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Notice } from '@/components/ui/states';
import { formatAmount } from '@/lib/format';
import { SectionFooter, type SectionProps } from './SectionFooter';

/** The balance the interest example is worked on. */
const EXAMPLE_BALANCE = 10000;
/** The amount the rounding example is worked on: the galaboda slip's own balance. */
const EXAMPLE_PAYABLE = 68226.91;

export function BillCalculationSection(props: SectionProps) {
  const { t } = useTranslation();
  const savedSettings = props.config.billSettings ?? DEFAULT_BILL_SETTINGS;
  const savedRate = (props.config.advanceInterest ?? DEFAULT_ADVANCE_INTEREST).monthlyRatePercent;

  const [unit, setUnit] = useState(savedSettings.paymentUnit);
  const [serial, setSerial] = useState(savedSettings.nextBillSerial?.toString() ?? '');
  const [rate, setRate] = useState(String(savedRate));
  useEffect(() => {
    setUnit(savedSettings.paymentUnit);
    setSerial(savedSettings.nextBillSerial?.toString() ?? '');
    setRate(String(savedRate));
  }, [savedSettings.paymentUnit, savedSettings.nextBillSerial, savedRate]);

  const nextBillSerial = serial.trim() === '' ? undefined : Number(serial);
  const settings = { paymentUnit: unit, ...(nextBillSerial === undefined ? {} : { nextBillSerial }) };
  const monthlyRatePercent = rate.trim() === '' ? Number.NaN : Number(rate);

  const settingsProblem = billSettingsProblem(settings);
  const rateProblem = advanceInterestProblem({ monthlyRatePercent });
  const dirty =
    unit !== savedSettings.paymentUnit ||
    nextBillSerial !== savedSettings.nextBillSerial ||
    monthlyRatePercent !== savedRate;

  const paid = Math.floor(EXAMPLE_PAYABLE / unit) * unit;
  const year = new Date().getFullYear();

  return (
    <CardBody className="flex flex-col gap-md">
      {isFactorySyncEnabled(props.config) ? (
        <Notice tone="info">{t('config.bill.syncOn')}</Notice>
      ) : null}

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

      <div className="grid gap-md border-t border-divider pt-md sm:grid-cols-2">
        <Field
          label={t('config.interest.monthlyRate')}
          hint={t('config.interest.monthlyRateHint')}
          error={rateProblem ? t('config.interest.outOfRange', { max: MAX_ADVANCE_INTEREST_PERCENT }) : undefined}
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
      </div>

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
        patch={{ billSettings: settings, advanceInterest: { monthlyRatePercent } }}
        dirty={dirty && settingsProblem === null && rateProblem === null}
        onRevert={() => {
          setUnit(savedSettings.paymentUnit);
          setSerial(savedSettings.nextBillSerial?.toString() ?? '');
          setRate(String(savedRate));
        }}
      />
    </CardBody>
  );
}
