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

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_SAVINGS_POLICY,
  NOTIFICATION_CATEGORIES,
  SUPPORTED_LANGUAGES,
  emailSchema,
  type ConfigPatch,
  type FeatureFlagName,
  type LanguageCode,
  type NotificationCategory,
  type SavingsPolicy,
} from '@tfd/domain';
import { CardBody } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Field, Input, Select } from '@/components/ui/Field';
import { Label } from '@/components/ui/Label';
import { formatMonthName } from '@/lib/format';
import { SectionFooter, type SectionProps } from './SectionFooter';
import { ManureCatalogue } from './ManureCatalogue';
import { StringListEditor } from './StringListEditor';

export type { SectionProps };

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** The savings policy this row carries, defaulted for one written before §21.9 was answered. */
function policyOf(config: SectionProps['config']): SavingsPolicy {
  return {
    withdrawalMonth: config.savings.withdrawalMonth ?? DEFAULT_SAVINGS_POLICY.withdrawalMonth,
    annualInterestRate:
      config.savings.annualInterestRate ?? DEFAULT_SAVINGS_POLICY.annualInterestRate,
  };
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

  const supportEmail = draft.supportEmail?.trim() ?? '';
  const supportEmailError =
    supportEmail.length > 0 && !emailSchema.safeParse(supportEmail).success
      ? t('validation.email')
      : undefined;

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
        <Field label={t('config.factory.supportEmail')} error={supportEmailError}>
          {({ id, invalid }) => (
            <Input id={id} type="email" invalid={invalid} disabled={props.readOnly} {...field('supportEmail')} />
          )}
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
        dirty={dirty && !supportEmailError}
        onRevert={() => setDraft(props.config.factory)}
      />
    </CardBody>
  );
}

/* ─────────────────────────── 2. Feature flags ─────────────────────────── */

/**
 * What each flag gates, so a toggle is not an unexplained switch.
 *
 * **Two kinds of answer now, and the distinction is v2's.** Some flags remove a console
 * module *and* an app screen; the rest remove only an app screen, because the console is
 * the app's management surface and most of what the app can be told to hide has no office
 * equivalent. Saying "M7" against `enableManure` and "the app" against
 * `enableBiometricLogin` is more honest than inventing a module id for a phone setting.
 */
const FLAG_GATES: Record<FeatureFlagName, string> = {
  enableSavings: 'M8',
  enableAdvances: 'M7',
  enableLoans: 'M7',
  enableManure: 'M7',
  enableTeaPackets: 'M18',
  enableInquiry: 'M10',
  enableNews: 'M11',
  enablePushNotifications: 'M13',
  enablePromoBanner: 'M11',

  // App-only. `app` is resolved through `config.flagGatesApp` rather than being a
  // module id, so the caption reads as a sentence instead of a citation to nothing.
  enableOnboarding: 'app',
  enableBiometricLogin: 'app',
  enableDarkModeToggle: 'app',
  enableProfileTab: 'app',
  enableAutoLock: 'app',

  /* v1: enablePayouts: 'M6', enableReports: 'M16' — both gone with the modules. */
};

/**
 * The fourteen flags, and what each one removes.
 *
 * This is the section with teeth, and in v2 it is **the point of the whole console**:
 * these are the app's flags, and this screen is the only place they can be changed
 * without a release. v1 held ten of them — six of the app's were missing entirely and two
 * were console-only — so a factory that wanted to turn off biometric sign-in had to ask a
 * developer, which is precisely what AC-12 says must not be true.
 *
 * A flag turns a surface off **end to end** (AC-07): the sidebar row goes where there is
 * one, the route refuses, the app hides the screen, and the API answers
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
            <Label className="flex min-w-0 flex-1 items-start gap-sm">
              <Checkbox
                className="mt-xxs shrink-0"
                checked={draft[name]}
                disabled={props.readOnly}
                onCheckedChange={(checked) => setDraft({ ...draft, [name]: checked === true })}
              />
              <span className="flex min-w-0 flex-col">
                <span className="text-body-small font-medium text-text-primary">
                  {t(`config.flag.${name}`)}
                </span>
                {/* What it removes, named. "enableManure — off" is a setting; "removes
                    the manure credit queue (M7)" is a decision. An app-only flag says so
                    rather than citing a module that does not exist. */}
                <span className="text-caption text-text-secondary">
                  {FLAG_GATES[name] === 'app'
                    ? t('config.flagGatesApp')
                    : t('config.flagGates', { module: FLAG_GATES[name] })}
                </span>
              </span>
            </Label>
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
  // §21.9's answer, as two values: the month withdrawals may be asked for, and the rate the
  // factory records. Defaulted for a `client_config` row written before it was answered.
  const savedPolicy = policyOf(props.config);
  const [policy, setPolicy] = useState(savedPolicy);
  // §21.10: the fertilizer catalogue a supplier's app request picks from.
  const [manureProducts, setManureProducts] = useState(props.config.manureProducts ?? []);

  useEffect(() => {
    setPoints(props.config.collectionPoints.map((point) => point.name));
    setBanks(props.config.banks);
    setRates(props.config.savings.perKgOptions);
    setPolicy(policyOf(props.config));
    setManureProducts(props.config.manureProducts ?? []);
  }, [props.config, props.config.collectionPoints, props.config.banks, props.config.savings]);

  const currentPoints = props.config.collectionPoints.map((point) => point.name);
  const dirty =
    !same(points, currentPoints) ||
    !same(banks, props.config.banks) ||
    !same(rates, props.config.savings.perKgOptions) ||
    !same(policy, savedPolicy) ||
    !same(manureProducts, props.config.manureProducts ?? []);

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
    savings: { perKgOptions: rates, ...policy },
    manureProducts,
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

      {/* §21.10: what a supplier may ask for on credit. A catalogue, so it sits with the
          banks and the collection points — the *rates* need two people and live on M4. */}
      <ManureCatalogue
        products={manureProducts}
        onChange={setManureProducts}
        readOnly={props.readOnly}
      />

      {/**
       * The scheme's rules (§21.9), beside the rates they govern.
       *
       * Here rather than in a section of their own because an administrator setting up the
       * savings scheme is answering one question — *how does this factory's savings work* —
       * and splitting the rates from the month they can be taken out in would make that two
       * screens.
       */}
      <div className="grid gap-md md:grid-cols-2">
        <Field label={t('config.withdrawalMonth')} hint={t('config.withdrawalMonthHint')}>
          {({ id, describedBy }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              disabled={props.readOnly}
              value={String(policy.withdrawalMonth)}
              onChange={(event) =>
                setPolicy({ ...policy, withdrawalMonth: Number(event.target.value) })
              }
            >
              {MONTHS.map((month) => (
                <option key={month} value={month}>
                  {formatMonthName(month)}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label={t('config.interestRate')} hint={t('config.interestRateHint')}>
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              type="number"
              min={0}
              max={100}
              step={0.25}
              className="numeric"
              disabled={props.readOnly}
              value={policy.annualInterestRate}
              onChange={(event) =>
                setPolicy({ ...policy, annualInterestRate: Number(event.target.value) || 0 })
              }
            />
          )}
        </Field>
      </div>

      {/* The half of §21.9 that is still open, said where somebody would expect the console
          to start paying interest by itself. */}
      <p className="rounded-md bg-surface-variant px-md py-sm text-caption text-text-secondary">
        {t('config.interestNotApplied')}
      </p>

      <SectionFooter
        {...props}
        patch={patch}
        dirty={dirty}
        onRevert={() => {
          setPoints(currentPoints);
          setBanks(props.config.banks);
          setRates(props.config.savings.perKgOptions);
          setPolicy(policyOf(props.config));
          setManureProducts(props.config.manureProducts ?? []);
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
          <Label key={lang} className="flex items-center gap-sm text-body-small text-text-primary">
            <Checkbox
              checked={content.includes(lang)}
              // English is the fallback everything resolves to, so it is not optional. The
              // API refuses dropping it too (`fallback-language-required`).
              disabled={props.readOnly || lang === 'en'}
              onCheckedChange={(checked) =>
                setContent(
                  checked === true
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
          </Label>
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
              <Label className="flex min-w-56 items-center gap-sm text-body-small text-text-primary">
                <Checkbox
                  checked={enabled}
                  disabled={props.readOnly}
                  onCheckedChange={(checked) => {
                    const next = checked === true
                      ? [...categories, category]
                      : categories.filter((one) => one !== category);
                    setCategories(next);
                    // Kept a subset: a default the factory cannot send is a device
                    // consenting to something that never arrives.
                    if (checked !== true) {
                      setDefaults(defaults.filter((one) => one !== category));
                    }
                  }}
                />
                {t(`notifications.category.${category}`)}
              </Label>

              <Label className="flex items-center gap-sm text-caption text-text-secondary">
                <Checkbox
                  checked={defaults.includes(category)}
                  disabled={props.readOnly || !enabled}
                  onCheckedChange={(checked) =>
                    setDefaults(
                      checked === true
                        ? [...defaults, category]
                        : defaults.filter((one) => one !== category),
                    )
                  }
                />
                {t('config.optedInByDefault')}
              </Label>
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
