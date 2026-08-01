/**
 * The five editable sections of the `client_config` row.
 *
 * **Every section is drafted locally and saved as a unit.** Not for tidiness — it is what
 * lets the impact list state the cost of the *complete* change before anything is
 * committed. A field that saved on blur would mean "remove Deniyaya and add Kamburupitiya"
 * hits the server as two patches, the first of which is refused for orphaning delivery
 * rows that the second would have kept.
 *
 * They are separate sections rather than one long form for the same reason M14 sends a
 * `PATCH` and not a `PUT`: two administrators editing different parts of the row is normal,
 * and a save should carry only what its author touched.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import {
  NOTIFICATION_CATEGORIES,
  SUPPORTED_LANGUAGES,
  type ConfigPatch,
  type ConfigUsage,
  type FeatureFlagName,
  type LanguageCode,
  type NotificationCategory,
  type RuntimeConfig,
} from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { CardBody } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import { ImpactList } from './ImpactList';
import { RevertButton, StringListEditor } from './StringListEditor';

/** What every section receives. `save` returns a promise so the footer can show progress. */
export interface SectionProps {
  config: RuntimeConfig;
  usage: ConfigUsage;
  readOnly: boolean;
  saving: boolean;
  save: (patch: ConfigPatch) => Promise<unknown>;
}

/**
 * Save, revert, and the consequences of what is currently drafted.
 *
 * The button is disabled by **either** nothing having changed or the change being blocked,
 * and the two are said differently: "nothing to save" and "this would hide records the
 * factory owes" are not the same message, and collapsing them into a greyed-out button
 * with no explanation is how a screen becomes a support call.
 */
function SectionFooter({
  patch,
  config,
  usage,
  dirty,
  readOnly,
  saving,
  save,
  onRevert,
}: SectionProps & { patch: ConfigPatch; dirty: boolean; onRevert: () => void }) {
  const { t } = useTranslation();

  // Computed locally from the shared rule, so the consequence appears while the toggle is
  // being considered rather than after it is pressed.
  const impacts = useMemo(
    () => (dirty ? adminConfigRepository.impactOf(patch, config, usage) : []),
    [patch, config, usage, dirty],
  );
  const blocked = impacts.some((impact) => impact.severity === 'blocks');

  if (readOnly) {
    return (
      <p className="border-t border-divider pt-md text-caption text-text-secondary">
        {t('config.readOnly')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-sm border-t border-divider pt-md">
      <ImpactList impacts={impacts} />

      <div className="flex flex-wrap items-center gap-sm">
        <Button
          variant="primary"
          disabled={!dirty || blocked}
          loading={saving}
          iconLeft={<Save className="size-icon-sm" aria-hidden />}
          onClick={() => void save(patch)}
        >
          {t('config.save')}
        </Button>
        <RevertButton onRevert={onRevert} disabled={!dirty} />

        <p className="text-caption text-text-secondary">
          {blocked
            ? t('config.blockedHint')
            : dirty
              ? t('config.unsavedHint')
              : t('config.nothingToSave')}
        </p>
      </div>
    </div>
  );
}

/** Deep-equality by serialisation. Config values are plain JSON, so this is exact. */
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/* ─────────────────────────── 1. Factory identity ─────────────────────────── */

/**
 * The fields that appear on documents rather than on screens.
 *
 * `regNo` and `legalFooter` are printed on every Green Leaf Account (M5), which is why they
 * are here and not in a branding section: a factory correcting its registration number is
 * correcting a legal document, not a logo.
 */
export function FactorySection(props: SectionProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(props.config.factory);
  useEffect(() => setDraft(props.config.factory), [props.config.factory]);

  const dirty = !same(draft, props.config.factory);
  const field = (key: keyof typeof draft) => ({
    value: draft[key] ?? '',
    onChange: (event: { target: { value: string } }) =>
      setDraft({ ...draft, [key]: event.target.value }),
  });

  return (
    <CardBody className="flex flex-col gap-md">
      <div className="grid gap-md md:grid-cols-2">
        <Field label={t('config.factory.name')} required hint={t('config.factory.nameHint')}>
          {({ id, describedBy, required }) => (
            <Input id={id} aria-describedby={describedBy} required={required} disabled={props.readOnly} {...field('name')} />
          )}
        </Field>
        <Field label={t('config.factory.regNo')} hint={t('config.factory.regNoHint')}>
          {({ id, describedBy }) => (
            <Input id={id} aria-describedby={describedBy} className="numeric" disabled={props.readOnly} {...field('regNo')} />
          )}
        </Field>
        <Field label={t('config.factory.telephone')}>
          {({ id }) => <Input id={id} className="numeric" disabled={props.readOnly} {...field('telephone')} />}
        </Field>
        <Field label={t('config.factory.location')}>
          {({ id }) => <Input id={id} disabled={props.readOnly} {...field('location')} />}
        </Field>
        <Field label={t('config.factory.supportEmail')}>
          {({ id }) => <Input id={id} type="email" disabled={props.readOnly} {...field('supportEmail')} />}
        </Field>
        <Field label={t('config.factory.supportHours')}>
          {({ id }) => <Input id={id} disabled={props.readOnly} {...field('supportHours')} />}
        </Field>
      </div>

      <Field label={t('config.factory.legalFooter')} hint={t('config.factory.legalFooterHint')}>
        {({ id, describedBy }) => (
          <Input id={id} aria-describedby={describedBy} disabled={props.readOnly} {...field('legalFooter')} />
        )}
      </Field>

      <SectionFooter
        {...props}
        patch={{ factory: draft }}
        dirty={dirty}
        onRevert={() => setDraft(props.config.factory)}
      />
    </CardBody>
  );
}

/* ─────────────────────────── 2. Feature flags ─────────────────────────── */

/** Which module each flag gates, so a toggle is not an unexplained switch. */
const FLAG_MODULES: Record<FeatureFlagName, string> = {
  enableSavings: 'M8',
  enableAdvances: 'M7',
  enableLoans: 'M7',
  enableManure: 'M7',
  enableInquiry: 'M10',
  enableNews: 'M11',
  enablePushNotifications: 'M13',
  enablePromoBanner: 'M11',
  enablePayouts: 'M6',
  enableReports: 'M16',
};

/**
 * The ten flags, and the module each one removes.
 *
 * This is the section with teeth. A flag turns a surface off **end to end** (AC-07) — the
 * sidebar row goes, the route refuses, the dashboard omits the queue, and the API answers
 * `403 feature-disabled`. For most flags that is a choice a factory is entitled to make.
 * For the ones holding money it is refused, and the footer says why with the figure.
 */
export function FeaturesSection(props: SectionProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(props.config.flags);
  useEffect(() => setDraft(props.config.flags), [props.config.flags]);

  const dirty = !same(draft, props.config.flags);
  const names = Object.keys(props.config.flags) as FeatureFlagName[];

  return (
    <CardBody className="flex flex-col gap-md">
      <ul className="flex flex-col divide-y divide-divider">
        {names.map((name) => (
          <li key={name} className="flex flex-wrap items-start gap-sm py-sm">
            <label className="flex min-w-0 flex-1 items-start gap-sm">
              <input
                type="checkbox"
                className="mt-xxs size-4 shrink-0 accent-primary"
                checked={draft[name]}
                disabled={props.readOnly}
                onChange={(event) => setDraft({ ...draft, [name]: event.target.checked })}
              />
              <span className="flex min-w-0 flex-col">
                <span className="text-body-small font-medium text-text-primary">
                  {t(`config.flag.${name}`)}
                </span>
                {/* The module, named. "enableManure — off" is a setting; "removes the
                    manure credit queue (M7)" is a decision. */}
                <span className="text-caption text-text-secondary">
                  {t('config.flagGates', { module: FLAG_MODULES[name] })}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <SectionFooter
        {...props}
        patch={{ flags: draft }}
        dirty={dirty}
        onRevert={() => setDraft(props.config.flags)}
      />
    </CardBody>
  );
}

/* ─────────────────────── 3. Collection points, banks, savings ─────────────────────── */

/**
 * The three lists the operational modules read from.
 *
 * Each one is referenced by records elsewhere and each row therefore shows what depends on
 * it — a collection point by its delivery rows, a bank by the suppliers whose details name
 * it. Removing a point with leaf filed to it is **refused**: a delivery names its point and
 * nothing else, so the rows would be orphaned. Removing a bank only stops it being offered.
 */
export function OperationsSection(props: SectionProps) {
  const { t } = useTranslation();

  const [points, setPoints] = useState(props.config.collectionPoints.map((point) => point.name));
  const [banks, setBanks] = useState(props.config.banks);
  const [rates, setRates] = useState(props.config.savings.perKgOptions);

  useEffect(() => {
    setPoints(props.config.collectionPoints.map((point) => point.name));
    setBanks(props.config.banks);
    setRates(props.config.savings.perKgOptions);
  }, [props.config.collectionPoints, props.config.banks, props.config.savings]);

  const currentPoints = props.config.collectionPoints.map((point) => point.name);
  const dirty =
    !same(points, currentPoints) ||
    !same(banks, props.config.banks) ||
    !same(rates, props.config.savings.perKgOptions);

  const patch: ConfigPatch = {
    // An id is derived for a new point and preserved for an existing one, because M3's
    // pickers key on the name while reports will want a stable id.
    collectionPoints: points.map((name) => ({
      id:
        props.config.collectionPoints.find((point) => point.name === name)?.id ??
        `cp-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name,
    })),
    banks,
    savings: { perKgOptions: rates },
  };

  return (
    <CardBody className="flex flex-col gap-lg">
      <StringListEditor
        items={points}
        onChange={setPoints}
        label={t('config.points')}
        addLabel={t('config.addPoint')}
        placeholder="MAKADURA"
        usage={props.usage.deliveriesByPoint}
        readOnly={props.readOnly}
      />

      <div className="flex flex-col gap-sm">
        <StringListEditor
          items={banks.map((bank) => bank.name)}
          onChange={(next) =>
            setBanks(
              next.map(
                (name) => banks.find((bank) => bank.name === name) ?? { name, branches: [] },
              ),
            )
          }
          label={t('config.banks')}
          addLabel={t('config.addBank')}
          placeholder="Bank of Ceylon"
          usage={props.usage.suppliersByBank}
          readOnly={props.readOnly}
        />

        {/* Branches per bank. Nested because a branch means nothing without its bank, and
            a supplier's details name both. */}
        {banks.map((bank, index) => (
          <div key={bank.name} className="ml-md border-l-2 border-divider pl-md">
            <StringListEditor
              items={bank.branches}
              onChange={(branches) =>
                setBanks(banks.map((one, i) => (i === index ? { ...one, branches } : one)))
              }
              label={t('config.branchesOf', { bank: bank.name })}
              addLabel={t('config.addBranch')}
              placeholder="Akuressa"
              readOnly={props.readOnly}
            />
          </div>
        ))}
      </div>

      <StringListEditor
        items={rates.map(String)}
        onChange={(next) =>
          // Numeric and sorted: the app renders these as a picker, and an unsorted list of
          // savings rates is a picker somebody scrolls past their own answer in.
          setRates(
            [...new Set(next.map(Number).filter((value) => Number.isFinite(value) && value >= 0))].sort(
              (a, b) => a - b,
            ),
          )
        }
        label={t('config.savingsRates')}
        addLabel={t('config.addRate')}
        placeholder="25"
        readOnly={props.readOnly}
      />

      <SectionFooter
        {...props}
        patch={patch}
        dirty={dirty}
        onRevert={() => {
          setPoints(currentPoints);
          setBanks(props.config.banks);
          setRates(props.config.savings.perKgOptions);
        }}
      />
    </CardBody>
  );
}

/* ─────────────────── 4. Languages, branding and theme ─────────────────── */

/**
 * What the supplier sees, in which language and which colours.
 *
 * `contentLanguages` is the one with a cross-module consequence: it is what M11 and M12
 * count a missing translation against (AC-08), so dropping a language stops copy in it
 * being reported as a gap. Warned about with the number of records affected. **English
 * cannot be dropped** — every content fallback resolves to it, so a record without it
 * has nothing to show anybody.
 */
export function AppearanceSection(props: SectionProps) {
  const { t } = useTranslation();

  const [content, setContent] = useState(props.config.localization.contentLanguages);
  const [defaultLang, setDefaultLang] = useState(props.config.localization.defaultLanguage);
  const [branding, setBranding] = useState(props.config.branding);
  const [colors, setColors] = useState(props.config.theme?.colors?.light ?? {});

  useEffect(() => {
    setContent(props.config.localization.contentLanguages);
    setDefaultLang(props.config.localization.defaultLanguage);
    setBranding(props.config.branding);
    setColors(props.config.theme?.colors?.light ?? {});
  }, [props.config.localization, props.config.branding, props.config.theme]);

  const dirty =
    !same(content, props.config.localization.contentLanguages) ||
    defaultLang !== props.config.localization.defaultLanguage ||
    !same(branding, props.config.branding) ||
    !same(colors, props.config.theme?.colors?.light ?? {});

  const patch: ConfigPatch = {
    localization: { contentLanguages: content, defaultLanguage: defaultLang },
    branding,
    theme: { colors: { light: colors } },
  };

  return (
    <CardBody className="flex flex-col gap-lg">
      <fieldset className="flex flex-col gap-sm">
        <legend className="text-label text-text-primary">{t('config.contentLanguages')}</legend>
        <p className="text-caption text-text-secondary">{t('config.contentLanguagesHint')}</p>

        {SUPPORTED_LANGUAGES.map((lang) => (
          <label key={lang} className="flex items-center gap-sm text-body-small text-text-primary">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={content.includes(lang)}
              // English is the fallback everything resolves to, so it is not optional. The
              // API refuses dropping it too (`fallback-language-required`).
              disabled={props.readOnly || lang === 'en'}
              onChange={(event) =>
                setContent(
                  event.target.checked
                    ? [...content, lang].filter((one, i, all) => all.indexOf(one) === i)
                    : content.filter((one) => one !== lang),
                )
              }
            />
            {t(`content.language.${lang}`)}
            {lang === 'en' ? (
              <span className="text-caption text-text-secondary">
                {t('config.fallbackRequired')}
              </span>
            ) : null}
            {props.usage.contentByLanguage[lang] ? (
              <span className="text-caption text-text-secondary">
                {t('config.recordsWritten', { count: props.usage.contentByLanguage[lang] })}
              </span>
            ) : null}
          </label>
        ))}
      </fieldset>

      <Field label={t('config.defaultLanguage')} hint={t('config.defaultLanguageHint')}>
        {({ id, describedBy }) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            fullWidth={false}
            disabled={props.readOnly}
            value={defaultLang}
            onChange={(event) => setDefaultLang(event.target.value as LanguageCode)}
          >
            {props.config.localization.supportedLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {t(`content.language.${lang}`)}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="grid gap-md md:grid-cols-2">
        <Field label={t('config.logoUrl')} hint={t('config.logoUrlHint')}>
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              disabled={props.readOnly}
              value={branding.logoUrl ?? ''}
              onChange={(event) => setBranding({ ...branding, logoUrl: event.target.value })}
            />
          )}
        </Field>
        <Field label={t('config.faviconUrl')}>
          {({ id }) => (
            <Input
              id={id}
              disabled={props.readOnly}
              value={branding.faviconUrl ?? ''}
              onChange={(event) => setBranding({ ...branding, faviconUrl: event.target.value })}
            />
          )}
        </Field>
      </div>

      {/* Two colours, not the whole palette. `primary` and `secondary` are what a factory
          recognises as "our colour"; the rest of the ramp is derived by `@tfd/brand`, and
          exposing forty tokens would be handing an office a design system to maintain. */}
      <div className="grid gap-md md:grid-cols-2">
        {(['primary', 'secondary'] as const).map((token) => (
          <Field key={token} label={t(`config.colour.${token}`)}>
            {({ id }) => (
              <div className="flex items-center gap-sm">
                <input
                  id={id}
                  type="color"
                  className="h-11 w-16 rounded-md border border-border bg-surface"
                  disabled={props.readOnly}
                  value={colors[token] ?? '#2E8B57'}
                  onChange={(event) => setColors({ ...colors, [token]: event.target.value })}
                />
                <Input
                  aria-label={t(`config.colour.${token}`)}
                  className="numeric w-32"
                  fullWidth={false}
                  disabled={props.readOnly}
                  value={colors[token] ?? ''}
                  onChange={(event) => setColors({ ...colors, [token]: event.target.value })}
                />
              </div>
            )}
          </Field>
        ))}
      </div>

      <SectionFooter
        {...props}
        patch={patch}
        dirty={dirty}
        onRevert={() => {
          setContent(props.config.localization.contentLanguages);
          setDefaultLang(props.config.localization.defaultLanguage);
          setBranding(props.config.branding);
          setColors(props.config.theme?.colors?.light ?? {});
        }}
      />
    </CardBody>
  );
}

/* ───────────────────────────── 5. Push ───────────────────────────── */

/**
 * Which notification categories this factory sends, and which a new device accepts.
 *
 * The second list is not a duplicate of the first. `categories` is what the factory *may*
 * send — M13 reads it to decide whether a trigger is even available. `defaultCategories` is
 * what a supplier is opted into when they install the app, and M13 defaults its automatic
 * triggers from it. A category in the second but not the first is a device consenting to
 * something that can never arrive, so the editor keeps the second a subset of the first.
 */
export function PushSection(props: SectionProps) {
  const { t } = useTranslation();

  const current = props.config.push;
  const [categories, setCategories] = useState<NotificationCategory[]>(current?.categories ?? []);
  const [defaults, setDefaults] = useState<NotificationCategory[]>(current?.defaultCategories ?? []);
  const [topicPrefix, setTopicPrefix] = useState(current?.topicPrefix ?? props.config.tenantId);

  useEffect(() => {
    setCategories(props.config.push?.categories ?? []);
    setDefaults(props.config.push?.defaultCategories ?? []);
    setTopicPrefix(props.config.push?.topicPrefix ?? props.config.tenantId);
  }, [props.config.push, props.config.tenantId]);

  const dirty =
    !same(categories, current?.categories ?? []) ||
    !same(defaults, current?.defaultCategories ?? []) ||
    topicPrefix !== (current?.topicPrefix ?? props.config.tenantId);

  const pushDisabled = !props.config.flags.enablePushNotifications;

  return (
    <CardBody className="flex flex-col gap-lg">
      {/* The honest state `hillcountry` is in: the flag is on and nothing is configured, or
          the flag is off and configuring is pointless. Said rather than left to be
          discovered from M13 refusing. */}
      {pushDisabled ? (
        <p className="rounded-md bg-warning-muted px-md py-sm text-body-small text-warning">
          {t('config.pushFlagOff')}
        </p>
      ) : null}

      <Field label={t('config.topicPrefix')} hint={t('config.topicPrefixHint')}>
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            className="w-64"
            fullWidth={false}
            disabled={props.readOnly}
            value={topicPrefix}
            onChange={(event) => setTopicPrefix(event.target.value)}
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-sm">
        <legend className="text-label text-text-primary">{t('config.pushCategories')}</legend>
        <p className="text-caption text-text-secondary">{t('config.pushCategoriesHint')}</p>

        {NOTIFICATION_CATEGORIES.map((category) => {
          const enabled = categories.includes(category);
          return (
            <div key={category} className="flex flex-wrap items-center gap-md">
              <label className="flex min-w-56 items-center gap-sm text-body-small text-text-primary">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={enabled}
                  disabled={props.readOnly}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...categories, category]
                      : categories.filter((one) => one !== category);
                    setCategories(next);
                    // Kept a subset: a default the factory cannot send is a device
                    // consenting to something that never arrives.
                    if (!event.target.checked) {
                      setDefaults(defaults.filter((one) => one !== category));
                    }
                  }}
                />
                {t(`notifications.category.${category}`)}
              </label>

              <label className="flex items-center gap-sm text-caption text-text-secondary">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={defaults.includes(category)}
                  disabled={props.readOnly || !enabled}
                  onChange={(event) =>
                    setDefaults(
                      event.target.checked
                        ? [...defaults, category]
                        : defaults.filter((one) => one !== category),
                    )
                  }
                />
                {t('config.optedInByDefault')}
              </label>
            </div>
          );
        })}
      </fieldset>

      <SectionFooter
        {...props}
        patch={{ push: { topicPrefix, categories, defaultCategories: defaults } }}
        dirty={dirty}
        onRevert={() => {
          setCategories(props.config.push?.categories ?? []);
          setDefaults(props.config.push?.defaultCategories ?? []);
          setTopicPrefix(props.config.push?.topicPrefix ?? props.config.tenantId);
        }}
      />
    </CardBody>
  );
}
