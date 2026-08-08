/**
 * Where the banner's button goes.
 *
 * **The one control in this console that authors a navigation instruction for the app**,
 * and the reason it gets its own file rather than being two inputs on the editor.
 *
 * The app's contract (`banners.md`) is that an action it cannot resolve produces artwork
 * with no button, silently. That is the right behaviour on a phone — a supplier can
 * always close a banner, and a console newer than the app will eventually send action
 * types that did not exist when the binary shipped. It is a terrible property to author
 * against: from the office, a banner with a dead button looks exactly like a banner with
 * a working one.
 *
 * So this field runs `bannerTarget()` — **the function the phone runs** — on every
 * keystroke and says what the app would do with what is currently typed. Not a
 * description of the rules; the rules themselves, executed.
 *
 * The two kinds are separate inputs rather than one URL box, because they are genuinely
 * different journeys and the mistake worth preventing is typing one into the other:
 * `teafactory://manure` is what an editor writes when they want the manure screen, and
 * it is refused **by name** with the answer ("use the in-app screen") rather than as
 * "unsupported scheme".
 */

import { useTranslation } from 'react-i18next';
import { ExternalLink, Smartphone } from 'lucide-react';
import type { BannerAction } from '@tfd/domain';
import { bannerActionProblem, bannerTarget } from '@tfd/domain';
import { Field, Input } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Notice } from '@/components/ui/states';

/**
 * Paths the app is known to resolve, offered as a datalist.
 *
 * A **suggestion, not a whitelist** — the field still accepts anything matching the path
 * rule, because the app's linking config gains routes without this console being
 * redeployed and a hard list here would go stale in the direction that blocks work. What
 * it buys is that the common case is a click rather than a guess at spelling.
 */
const KNOWN_SCREENS = ['home', 'news', 'savings', 'manure', 'advance', 'loan', 'inquiry', 'settings'];

export function BannerActionField({
  value,
  onChange,
  disabled,
}: {
  value: BannerAction;
  onChange: (next: BannerAction) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  const problem = bannerActionProblem(value);
  const target = bannerTarget(value);

  return (
    <div className="flex flex-col gap-sm">
      <Field label={t('banners.action.kind')} hint={t('banners.action.kindHint')}>
        {({ id, describedBy }) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            disabled={disabled}
            value={value.type}
            onChange={(event) =>
              // Switching kind resets the payload rather than carrying it across. A path
              // is not a URL with a scheme missing, and keeping the text would produce
              // exactly the `teafactory://` shaped mistake this field exists to catch.
              onChange(
                event.target.value === 'screen'
                  ? { type: 'screen', path: '' }
                  : { type: 'url', url: '' },
              )
            }
          >
            <option value="screen">{t('banners.action.screen')}</option>
            <option value="url">{t('banners.action.url')}</option>
          </Select>
        )}
      </Field>

      {value.type === 'screen' ? (
        <Field
          label={t('banners.action.pathLabel')}
          hint={t('banners.action.pathHint')}
          error={problem && value.path ? t(problem) : undefined}
        >
          {({ id, describedBy, invalid }) => (
            <>
              <Input
                id={id}
                list="banner-known-screens"
                placeholder="news/news-1"
                aria-describedby={describedBy}
                invalid={invalid}
                disabled={disabled}
                value={value.path}
                onChange={(event) => onChange({ type: 'screen', path: event.target.value })}
              />
              <datalist id="banner-known-screens">
                {KNOWN_SCREENS.map((path) => (
                  <option key={path} value={path} />
                ))}
              </datalist>
            </>
          )}
        </Field>
      ) : (
        <Field
          label={t('banners.action.urlLabel')}
          hint={t('banners.action.urlHint')}
          error={problem && value.url ? t(problem) : undefined}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="text"
              inputMode="url"
              placeholder="https://example.lk/notice"
              aria-describedby={describedBy}
              invalid={invalid}
              disabled={disabled}
              value={value.url}
              onChange={(event) => onChange({ type: 'url', url: event.target.value })}
            />
          )}
        </Field>
      )}

      {/**
       * What the app will actually do, in words, before anybody publishes.
       *
       * Positive confirmation rather than only an error, because "no error" and "this
       * works" are different claims and the field has spent its life being the one that
       * fails quietly. Showing the resolved target is also how an editor notices they
       * pasted a tracking URL that normalised into something else.
       */}
      {target ? (
        <Notice tone="info">
          <span className="inline-flex items-center gap-xs">
            {target.kind === 'path' ? (
              <Smartphone className="size-icon-xs" aria-hidden />
            ) : (
              <ExternalLink className="size-icon-xs" aria-hidden />
            )}
            {target.kind === 'path'
              ? t('banners.action.resolvedScreen', { path: target.path })
              : t('banners.action.resolvedUrl', { url: target.url })}
          </span>
        </Notice>
      ) : null}
    </div>
  );
}
