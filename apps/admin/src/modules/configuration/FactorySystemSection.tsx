/**
 * The factory-system sync switch: where suppliers, leaf, rates, bills and balances come from.
 *
 * Two choices, shown as two cards with what each one means, because the switch changes
 * which screens exist and who calculates a supplier's bill. Choosing the other one says
 * what will appear or disappear before Save, and the screen asks once more on Save.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Cloud, PencilLine } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { isFactorySyncEnabled } from '@tfd/domain';
import { CardBody } from '@/components/ui/Card';
import { Notice } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import { SectionFooter, type SectionProps } from './SectionFooter';

export function FactorySystemSection(props: SectionProps) {
  const { t } = useTranslation();
  const saved = isFactorySyncEnabled(props.config);
  const [enabled, setEnabled] = useState(saved);
  useEffect(() => setEnabled(saved), [saved]);

  const dirty = enabled !== saved;

  return (
    <CardBody className="flex flex-col gap-lg">
      <div role="radiogroup" aria-label={t('config.section.factorySystem')} className="grid gap-md md:grid-cols-2">
        <ModeCard
          icon={Cloud}
          selected={enabled}
          disabled={props.readOnly}
          onSelect={() => setEnabled(true)}
          title={t('records.mode.sync.title')}
          body={t('records.mode.sync.body')}
          points={[t('records.mode.sync.p1'), t('records.mode.sync.p2'), t('records.mode.sync.p3')]}
        />
        <ModeCard
          icon={PencilLine}
          selected={!enabled}
          disabled={props.readOnly}
          onSelect={() => setEnabled(false)}
          title={t('records.mode.manual.title')}
          body={t('records.mode.manual.body')}
          points={[
            t('records.mode.manual.p1'),
            t('records.mode.manual.p2'),
            t('records.mode.manual.p3'),
          ]}
        />
      </div>

      {dirty ? (
        <Notice tone="warning">
          {enabled ? t('records.mode.toSync') : t('records.mode.toManual')}
        </Notice>
      ) : null}

      <SectionFooter
        {...props}
        patch={{ factorySync: { enabled } }}
        dirty={dirty}
        onRevert={() => setEnabled(saved)}
      />
    </CardBody>
  );
}

function ModeCard({
  icon: Icon,
  selected,
  disabled,
  onSelect,
  title,
  body,
  points,
}: {
  icon: LucideIcon;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  title: string;
  body: string;
  points: string[];
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex flex-col gap-sm rounded-lg border p-lg text-left transition-colors',
        selected
          ? 'border-primary bg-primary-muted'
          : 'border-border bg-surface hover:bg-surface-variant',
        disabled && 'cursor-not-allowed opacity-70',
      )}
    >
      <span className="flex items-center gap-sm">
        <Icon className="size-icon-md text-primary" aria-hidden />
        <span className="flex-1 text-subtitle font-semibold text-text-primary">{title}</span>
        {selected ? <CheckCircle2 className="size-icon-md text-primary" aria-hidden /> : null}
      </span>
      <span className="text-body-small text-text-secondary">{body}</span>
      <ul className="flex list-disc flex-col gap-xxs pl-lg text-body-small text-text-primary">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </button>
  );
}
