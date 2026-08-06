/**
 * M14 Configuration — the `client_config` row.
 *
 * **This screen is AC-12.** white-label.md: *"A new factory is a DNS record and a
 * `client_config` row. No build, no deploy."* So the criterion is not whether this screen
 * exists — it is whether the **last** field a factory needs is on it. One value that still
 * requires a developer makes AC-12 false, which is why the sections here cover the whole
 * payload rather than the parts that were convenient.
 *
 * Two things shape the layout:
 *
 *  - **A section rail, not one long form.** Five independently-saved sections, the selected
 *    one in the URL, matching M12. A single form would mean one save carrying every field
 *    an administrator did not touch, which is exactly what `PATCH`-per-section avoids on
 *    the wire.
 *  - **No grid, so no fill-height column.** This page scrolls naturally. Worth stating
 *    because the short-screen bug came from stacking a tall card above a grid in a column
 *    that fills the window — there is no grid here to crush.
 *
 * The dangerous part is not the editing, it is that these edits reach across every other
 * module and the person making them cannot see any of them from here. So every section
 * shows the cost of what is drafted **before** it is saved, computed from the same
 * `configImpact` the API refuses with — see `ImpactList`.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  Building2,
  FileSpreadsheet,
  Languages,
  Bell as BellIcon,
  SlidersHorizontal,
  Warehouse,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ConfigPatch } from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { ErrorState, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { errorMessageKey } from '@/lib/errorMessage';
import {
  AppearanceSection,
  FactorySection,
  FeaturesSection,
  OperationsSection,
  PushSection,
} from './ConfigSections';
import { PayoutFileSection } from './PayoutFileSection';
import type { SectionProps } from './SectionFooter';
import { useAdminConfig, useSaveConfig } from './hooks';

const SECTIONS: Array<{
  id: string;
  icon: LucideIcon;
  Component: (props: SectionProps) => React.ReactElement;
}> = [
  { id: 'factory', icon: Building2, Component: FactorySection },
  { id: 'features', icon: SlidersHorizontal, Component: FeaturesSection },
  { id: 'operations', icon: Warehouse, Component: OperationsSection },
  { id: 'appearance', icon: Languages, Component: AppearanceSection },
  { id: 'push', icon: BellIcon, Component: PushSection },
  // Last, because it is the only section that is an *answer to an open question* rather
  // than a setting — see §21.17 and `payoutExport.ts`.
  { id: 'payoutFile', icon: FileSpreadsheet, Component: PayoutFileSection },
];

export function ConfigurationScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [confirmingSave, setConfirmingSave] = useState<ConfigPatch | null>(null);

  // §12.1: `flagsAndBranding` is `W` for the factory and platform admins, `R` for the
  // manager. A manager may read the configuration and not change it.
  const canEdit = useCan('flagsAndBranding', 'write');

  const query = useAdminConfig();
  const save = useSaveConfig();

  /** The section in the URL, checked against the known set rather than trusted. */
  const requested = params.get('section');
  const section = SECTIONS.find((one) => one.id === requested) ?? SECTIONS[0]!;

  function selectSection(id: string) {
    const next = new URLSearchParams(params);
    next.set('section', id);
    setParams(next, { replace: true });
  }

  if (query.isPending) {
    return (
      <div className="flex justify-center py-xxxl">
        <Spinner />
      </div>
    );
  }
  if (query.error || !query.data) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  const { config, usage } = query.data;

  async function submit(patch: ConfigPatch) {
    setConfirmingSave(patch);
  }

  async function confirmSave() {
    if (!confirmingSave) return;
    try {
      await save.mutateAsync({ patch: confirmingSave, config, usage });
      setConfirmingSave(null);
      /**
       * The toast says what *else* changed, because a config save is the only edit in the
       * console whose effect is mostly somewhere the reader is not looking — the sidebar,
       * the theme, another module's tabs.
       */
      toast.success(t('config.saved'), t('config.savedHint'));
    } catch (cause) {
      toast.error(t('config.saveFailed'), t(errorMessageKey(cause)));
    }
  }

  const sectionProps: SectionProps = {
    config,
    usage,
    readOnly: !canEdit,
    saving: save.isPending,
    save: submit,
  };

  return (
    <>
      <PageHeader
        title={t('configuration.title')}
        description={t('configuration.subtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-md">
            {/* The tenant id, shown and **not editable**: it comes from the subdomain, and
                everything else is keyed on it. The API refuses a patch containing it
                (`tenant-immutable`). */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex flex-col rounded-md border border-border bg-surface px-md py-sm text-left"
                >
                  <span className="text-caption text-text-secondary">{t('config.tenantId')}</span>
                  <span className="numeric text-subtitle text-text-primary">{config.tenantId}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <p className="text-body-small text-text-primary">{t('config.tenantIdHint')}</p>
              </PopoverContent>
            </Popover>
            {!canEdit ? <Badge tone="neutral">{t('config.readOnlyBadge')}</Badge> : null}
          </div>
        }
      />

      <div className="grid gap-lg lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
        <Card>
          <CardHeader title={t('config.sections')} />
          <CardBody className="p-0">
            <ul>
              {SECTIONS.map((one) => {
                const Icon = one.icon;
                const active = one.id === section.id;
                return (
                  <li key={one.id}>
                    <button
                      type="button"
                      onClick={() => selectSection(one.id)}
                      aria-current={active ? 'true' : undefined}
                      className={cn(
                        'flex w-full items-start gap-sm border-l-2 px-lg py-sm text-left',
                        active
                          ? 'border-primary bg-primary-muted'
                          : 'border-transparent hover:bg-surface-variant',
                      )}
                    >
                      <Icon
                        className="mt-xxs size-icon-sm shrink-0 text-text-secondary"
                        aria-hidden
                      />
                      <span className="flex min-w-0 flex-col">
                        <span
                          className={cn(
                            'text-body-small',
                            active ? 'font-semibold text-primary' : 'text-text-primary',
                          )}
                        >
                          {t(`config.section.${one.id}`)}
                        </span>
                        <span className="text-caption text-text-secondary">
                          {t(`config.sectionHint.${one.id}`)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t(`config.section.${section.id}`)}
            description={t(`config.sectionDescription.${section.id}`)}
          />
          {/* Keyed by section, so switching remounts the editor and cannot carry one
              section's unsaved draft into another's fields. */}
          <section.Component key={section.id} {...sectionProps} />
        </Card>
      </div>

      {/* AC-12, stated on the screen it is about. An administrator who does not know this
          screen is the whole onboarding path will ask a developer for the next change. */}
      <p className="rounded-md bg-surface-variant px-lg py-sm text-caption text-text-secondary">
        {t('config.ac12Note')}
      </p>

      <ConfirmDialog
        open={confirmingSave !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmingSave(null);
        }}
        title={t('config.confirmSaveTitle')}
        description={t('config.confirmSaveBody')}
        confirmLabel={t('config.save')}
        confirmVariant="primary"
        onConfirm={() => void confirmSave()}
      />
    </>
  );
}
