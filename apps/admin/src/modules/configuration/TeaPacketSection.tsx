/**
 * M14 — what a packet of tea is and what it costs.
 *
 * Its own section rather than three fields appended to *Operations*, and the reason is
 * the same one that gave banners their own sidebar row: **v1 shipped a flag with nothing
 * behind it.** A tea-packet price buried under a heading about collection points is a
 * price nobody finds, and the module downstream then runs on
 * `DEFAULT_TEA_PACKET_POLICY` — a real number, and not this factory's.
 *
 * Three fields, and the third is the one worth reading twice. `maxPacketsPerRequest` is a
 * **stock limit, not a credit limit**: it says how much of the store one supplier may take
 * at a time, which is why M18 has no eligibility working to show. Setting it to zero would
 * make every request refusable while the queue went on looking open, so it is refused
 * (`teaPacketPolicyProblems`) with the answer — turn the feature off instead.
 *
 * The line under the fields is the point of the screen, exactly as it is in
 * `ManureCatalogue`: **what a real request would put on a real account.** Somebody setting
 * a price should see the figure the supplier ends up owing, not only the number typed.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_TEA_PACKET_POLICY,
  teaPacketAmount,
  teaPacketPolicyProblems,
  teaPacketWeightKg,
  type TeaPacketPolicy,
} from '@tfd/domain';
import { CardBody } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { Notice } from '@/components/ui/states';
import { formatAmount } from '@/lib/format';
import { SectionFooter, type SectionProps } from './SectionFooter';

/** The example a price is judged against: a supplier asking for a handful. */
const EXAMPLE_PACKETS = 4;

export function TeaPacketSection(props: SectionProps) {
  const current = props.config.teaPackets ?? DEFAULT_TEA_PACKET_POLICY;
  const { t } = useTranslation();
  const [draft, setDraft] = useState<TeaPacketPolicy>(current);

  useEffect(() => {
    setDraft(props.config.teaPackets ?? DEFAULT_TEA_PACKET_POLICY);
  }, [props.config.teaPackets]);

  const problems = teaPacketPolicyProblems(draft);
  const dirty =
    draft.packGrams !== current.packGrams ||
    draft.pricePerPacket !== current.pricePerPacket ||
    draft.maxPacketsPerRequest !== current.maxPacketsPerRequest;

  const set = (patch: Partial<TeaPacketPolicy>) => setDraft({ ...draft, ...patch });

  return (
    <CardBody className="flex flex-col gap-md">
      {/**
       * The flag is off, so nothing here reaches anybody yet.
       *
       * Said rather than hidden, and said the same way the push section says it: an
       * administrator who came here to set a price should be told why the screen is inert,
       * not left with a form that saves and changes nothing they can see.
       */}
      {props.config.flags.enableTeaPackets ? null : (
        <Notice tone="info">{t('config.teaPackets.flagOff')}</Notice>
      )}

      {/**
       * Never configured — so M18 is quoting the bundled default at suppliers.
       *
       * The same warning the queue shows, repeated on the screen that fixes it. A factory
       * that has not answered this is not in a neutral state: it is in a state where a real
       * price the factory never agreed to is going onto real accounts.
       */}
      {props.config.teaPackets ? null : (
        <Notice tone="warning">
          {t('teaPackets.noPolicy.body', {
            price: formatAmount(DEFAULT_TEA_PACKET_POLICY.pricePerPacket),
          })}
        </Notice>
      )}

      <div className="grid gap-md sm:grid-cols-2">
        <Field label={t('config.teaPackets.packGrams')}>
          {({ id }) => (
            <Input
              id={id}
              className="numeric"
              type="number"
              min={1}
              step={50}
              disabled={props.readOnly}
              value={draft.packGrams}
              onChange={(event) => set({ packGrams: Number(event.target.value) || 0 })}
            />
          )}
        </Field>

        <Field label={t('config.teaPackets.pricePerPacket')}>
          {({ id }) => (
            <Input
              id={id}
              className="numeric"
              type="number"
              min={0}
              step={10}
              disabled={props.readOnly}
              value={draft.pricePerPacket}
              onChange={(event) => set({ pricePerPacket: Number(event.target.value) || 0 })}
            />
          )}
        </Field>
      </div>

      <Field label={t('config.teaPackets.maxPerRequest')} hint={t('config.teaPackets.maxHint')}>
        {({ id, describedBy }) => (
          <Input
            id={id}
            className="numeric"
            type="number"
            min={1}
            step={1}
            aria-describedby={describedBy}
            disabled={props.readOnly}
            value={draft.maxPacketsPerRequest}
            onChange={(event) =>
              set({ maxPacketsPerRequest: Number(event.target.value) || 0 })
            }
          />
        )}
      </Field>

      {/* What a real request costs, from the numbers currently in the fields. */}
      {problems.length === 0 ? (
        <p className="text-caption text-text-secondary">
          {t('teaPackets.packetsWithWeight', {
            packets: EXAMPLE_PACKETS,
            kg: teaPacketWeightKg(draft, EXAMPLE_PACKETS),
          })}{' '}
          · {formatAmount(teaPacketAmount(draft, EXAMPLE_PACKETS))}
        </p>
      ) : (
        <ul className="flex flex-col gap-xxs">
          {problems.map((problem) => (
            <li key={problem} className="text-caption text-error">
              {t(`config.impact.teaPacketPolicy.${problem}`)}
            </li>
          ))}
        </ul>
      )}

      <SectionFooter
        {...props}
        patch={{ teaPackets: draft }}
        dirty={dirty && problems.length === 0}
        onRevert={() => setDraft(props.config.teaPackets ?? DEFAULT_TEA_PACKET_POLICY)}
      />
    </CardBody>
  );
}
