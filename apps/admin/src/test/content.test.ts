/**
 * M11 and M12 against the mock API — and **AC-08 end to end**.
 *
 * The criterion is that editorial copy falls back to English when a translation is
 * missing *and* that the gap is visible to the editor. Both halves are testable and both
 * are here, because either one alone is a trap:
 *
 *  - A fallback with no visible gap is a console that silently ships English to Sinhala
 *    suppliers, and nobody finds out until one telephones.
 *  - A gap report with a fallback the app does not actually perform is worse — the editor
 *    signs off a preview of something that is never rendered.
 *
 * So the assertions are mostly identities between the two: what `preview` returns for a
 * language is what `resolveTranslation` in `@tfd/domain` returns for it, and what the gap
 * lists say is what the translations map actually contains.
 *
 * Two behaviours beyond the criterion get their own cases, because both were the reason
 * the module needed writing rather than the criterion:
 *
 *  - **Stale**, which AC-08's wording does not cover. Copy written *before* the English
 *    it was translated from is rendered by the app as though it were current, so nothing
 *    anywhere looks wrong and only this screen can catch it.
 *  - **Gaps are relative to the tenant**, so a factory that authors in English and Tamil
 *    is not missing Sinhala. An office told it has unfinished work it does not have stops
 *    reading the warnings.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  EDITORIAL_FALLBACK_LANGUAGE,
  STATIC_PAGE_SLUGS,
  isWritten,
  missingTranslations,
  resolveTranslation,
  staleTranslations,
} from '@tfd/domain';
import { newsRepository, staticPageRepository } from '@/services/repositories/contentRepository';
import { auditRepository } from '@/services/repositories/auditRepository';
import { isApiError } from '@/services/api/errors';
import { useAuthStore } from '@/auth/authStore';
import { signInAs, signInWithMfaAs, signOut } from './render';

const EDITOR = 'editor@galabodatea.lk';
const ADMIN = 'factoryadmin@galabodatea.lk';
const CLERK = 'clerk@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';

/** Whoever the fixture gives `content: write` to. Resolved once, so the suite says why. */
async function signInAsEditor() {
  await signInAs(EDITOR);
}

describe('M11 news', () => {
  beforeEach(() => {
    signOut();
  });

  it('carries an article in every state the editor has to tell apart', async () => {
    await signInAsEditor();
    const page = await newsRepository.list({ pageSize: 50 });

    const statuses = new Set(page.items.map((row) => row.status));
    expect(statuses).toContain('published');
    expect(statuses).toContain('draft');
    expect(statuses).toContain('archived');

    // The list's title is the **fallback** language's, always: a title that changed with
    // the selected tab would make the grid unreadable while translating.
    for (const row of page.items) {
      const article = await newsRepository.get(row.id);
      const fallback = article.translations[EDITORIAL_FALLBACK_LANGUAGE];
      expect(row.title).toBe(fallback?.title ?? '—');
    }
  }, 20_000);

  it('reports a missing translation on the record it is missing from (AC-08)', async () => {
    await signInAsEditor();
    const page = await newsRepository.list({ pageSize: 50 });

    for (const row of page.items) {
      const article = await newsRepository.get(row.id);

      // The gap lists are the server's, and they agree with the shared predicate — the
      // console renders warnings from the same function, so the two cannot diverge.
      expect(article.missingLanguages).toEqual(
        missingTranslations(article.translations, ['si', 'en', 'ta']),
      );
      expect(article.staleLanguages).toEqual(
        staleTranslations(article.translations, ['si', 'en', 'ta']),
      );

      // And a language reported missing really has nothing written in it — "present but
      // empty" must not count as translated.
      for (const lang of article.missingLanguages) {
        expect(isWritten(article.translations[lang])).toBe(false);
      }
      // The row and the record say the same thing.
      expect(row.missingLanguages).toEqual(article.missingLanguages);
    }
  }, 30_000);

  it('has something live with a gap, and a filter that finds it', async () => {
    await signInAsEditor();

    /**
     * The AC-08 working list, in the same sense M4's exception queue is AC-04's. A
     * criterion satisfied by a warning nobody can enumerate is satisfied on paper only:
     * an article published three weeks ago that a Sinhala supplier is still reading in
     * English will never be found by scrolling.
     */
    const incomplete = await newsRepository.list({ incomplete: true, pageSize: 50 });
    expect(incomplete.total).toBeGreaterThan(0);

    for (const row of incomplete.items) {
      expect(row.status).toBe('published');
      expect(row.missingLanguages.length + row.staleLanguages.length).toBeGreaterThan(0);
    }
  });

  it('previews the fallback the app would use, and says that it did', async () => {
    await signInAsEditor();
    const incomplete = await newsRepository.list({ incomplete: true, pageSize: 50 });
    const row = incomplete.items.find((candidate) => candidate.missingLanguages.length > 0)!;
    const article = await newsRepository.get(row.id);
    const missing = row.missingLanguages[0]!;

    const preview = await newsRepository.preview(row.id, missing);

    // Falling back, and saying so — a preview that looked like a translation would hide
    // the gap in the most convincing way available.
    expect(preview.usedFallback).toBe(true);
    expect(preview.fallbackLanguage).toBe(EDITORIAL_FALLBACK_LANGUAGE);
    expect(preview.translation?.lang).toBe(EDITORIAL_FALLBACK_LANGUAGE);

    // And it is the **same resolution** the shared function performs, which is the only
    // thing that makes the preview worth showing at all.
    const expected = resolveTranslation(article.translations, missing);
    expect(preview.translation?.title).toBe(expected?.translation.title);
    expect(preview.usedFallback).toBe(expected?.usedFallback);

    // A language that *is* written is not a fallback.
    const written = await newsRepository.preview(row.id, EDITORIAL_FALLBACK_LANGUAGE);
    expect(written.usedFallback).toBe(false);
  }, 20_000);

  it('flags a translation older than the English it came from (stale)', async () => {
    await signInAsEditor();
    const page = await newsRepository.list({ pageSize: 50 });

    // The fixture carries one deliberately: the English was corrected after both
    // translations were written.
    const stale = page.items.find((row) => row.staleLanguages.length > 0);
    expect(stale).toBeTruthy();

    const article = await newsRepository.get(stale!.id);
    const source = article.translations[EDITORIAL_FALLBACK_LANGUAGE]!;
    for (const lang of article.staleLanguages) {
      const translation = article.translations[lang]!;
      // Written — this is not a missing translation — and older than its source.
      expect(isWritten(translation)).toBe(true);
      expect(translation.updatedAt < source.updatedAt).toBe(true);
    }

    // Re-saving that language clears it, which is the whole workflow: the editor is told
    // what is behind, fixes it, and the flag goes away.
    const lang = article.staleLanguages[0]!;
    const updated = await newsRepository.saveTranslation(article.id, lang, {
      title: article.translations[lang]!.title,
      body: 'Re-translated after the English correction.',
    });
    expect(updated.staleLanguages).not.toContain(lang);
  }, 20_000);

  it('refuses a translation that says nothing', async () => {
    await signInAsEditor();
    const page = await newsRepository.list({ pageSize: 1 });
    const id = page.items[0]!.id;

    /**
     * An editor who opens a tab, types nothing and saves would otherwise leave a
     * translation that *exists*, counts as written everywhere it is read, and renders to
     * a supplier as a blank article. The gap AC-08 requires to be visible would vanish.
     *
     * Refused by the repository before it leaves the browser.
     */
    await expect(
      newsRepository.saveTranslation(id, 'si', { title: '   ', body: '   ' }),
    ).rejects.toMatchObject({ code: 'note-required' });

    await expect(
      newsRepository.saveTranslation(id, 'si', { title: 'A title', body: '' }),
    ).rejects.toMatchObject({ code: 'note-required' });
  });

  it('creates a draft, refuses one with no English, and publishes with gaps', async () => {
    await signInAsEditor();

    // No fallback copy: refused before it leaves the browser, because a record with
    // nothing to fall back to cannot be shown to anybody.
    await expect(
      newsRepository.create({
        translations: [{ lang: 'si', title: 'සිංහල පමණි', body: 'ඉංග්‍රීසි නැත.' }],
      }),
    ).rejects.toMatchObject({ code: 'fallback-translation-missing' });

    const created = await newsRepository.create({
      translations: [
        { lang: 'en', title: 'Weighing hours change from Monday', body: 'Makadura opens at 7.' },
      ],
    });
    // Created as a draft — nothing reaches a supplier by being written.
    expect(created.status).toBe('draft');
    expect(created.slug).toBe('weighing-hours-change-from-monday');
    expect(created.missingLanguages).toEqual(expect.arrayContaining(['si', 'ta']));

    /**
     * Publishing with gaps is **allowed**, and that is the AC-08 policy rather than a
     * compromise: `EDITORIAL_FALLBACK_LANGUAGE` is documented as "the fallback, not a
     * default", which only means anything if content can go out incomplete.
     */
    signOut();
    await signInAs(ADMIN);
    const published = await newsRepository.publish(created.id);
    expect(published.status).toBe('published');
    expect(published.missingLanguages).toEqual(expect.arrayContaining(['si', 'ta']));

    // Twice is refused rather than silently re-publishing.
    await expect(newsRepository.publish(created.id)).rejects.toMatchObject({
      code: 'already-published',
    });
  }, 30_000);

  it('records the gaps in the audit entry when something goes out incomplete (AC-09)', async () => {
    await signInAsEditor();
    const created = await newsRepository.create({
      translations: [{ lang: 'en', title: 'Poya day closure', body: 'No weighing on Poya.' }],
    });

    signOut();
    await signInAs(ADMIN);
    await newsRepository.publish(created.id);

    signOut();
    await signInWithMfaAs(MANAGER);
    const trail = await auditRepository.forEntity('newsArticle', created.id);
    const entry = trail.items.find((candidate) => candidate.action === 'news.publish');

    /**
     * "Who decided a Sinhala supplier could read this in English, and when" is the
     * question AC-08 turns into an argument six months later. A log that recorded only
     * the publish cannot answer it.
     */
    expect(entry).toBeTruthy();
    expect(entry?.after).toMatchObject({ status: 'published' });
    expect((entry?.after as { missingLanguages: string[] }).missingLanguages).toEqual(
      expect.arrayContaining(['si', 'ta']),
    );
  }, 30_000);

  it('takes an article down and archives it, and never deletes one', async () => {
    await signInAs(ADMIN);
    const page = await newsRepository.list({ status: 'published', pageSize: 5 });
    const id = page.items[0]!.id;

    const down = await newsRepository.unpublish(id);
    expect(down.status).toBe('draft');
    // Nothing to take down twice.
    await expect(newsRepository.unpublish(id)).rejects.toMatchObject({
      code: 'content-not-published',
    });

    const archived = await newsRepository.archive(id);
    expect(archived.status).toBe('archived');
    // Still there. An article a supplier read and may quote is a record (§12.1).
    await expect(newsRepository.get(id)).resolves.toMatchObject({ id });
  }, 20_000);

  it('lets an editor write and refuses them the publish (§12.1)', async () => {
    await signInAsEditor();
    const page = await newsRepository.list({ status: 'draft', pageSize: 5 });
    const id = page.items[0]!.id;

    // `content: W` — writing is theirs…
    await expect(
      newsRepository.saveTranslation(id, 'en', {
        title: 'Fertilizer distribution — September',
        body: 'Issued from the 8th at the factory store.',
      }),
    ).resolves.toBeTruthy();

    // …and putting it in front of every supplier is not. §12.1 gives `content: A` to the
    // factory administrator, and the server is what enforces it.
    const refused = await newsRepository.publish(id).catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('forbidden');
    expect(isApiError(refused) && refused.status).toBe(403);
  }, 20_000);

  it('gives a clerk read access and no write at all (§12.1)', async () => {
    await signInAs(CLERK);
    await expect(newsRepository.list({ pageSize: 1 })).resolves.toBeTruthy();

    const page = await newsRepository.list({ pageSize: 1 });
    const refused = await newsRepository
      .saveTranslation(page.items[0]!.id, 'en', { title: 'Nope', body: 'Not allowed.' })
      .catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('forbidden');
  });
});

describe('M12 static content', () => {
  beforeEach(() => {
    signOut();
  });

  it('returns every page in the closed set, written or not', async () => {
    await signInAsEditor();
    const pages = await staticPageRepository.list();

    // A closed set: the app links to these slugs, so a page missing from the list is a
    // link to nowhere and one invented here is copy nothing renders.
    expect(pages.map((page) => page.slug)).toEqual([...STATIC_PAGE_SLUGS]);

    // And a page the factory has never written is a **state**, not an absent row.
    const unwritten = pages.find((page) => page.status === 'draft');
    expect(unwritten).toBeTruthy();
    expect(unwritten!.translations[EDITORIAL_FALLBACK_LANGUAGE]).toBeUndefined();
  });

  it('has the FAQ written in every language (AC-11)', async () => {
    await signInAsEditor();
    const pages = await staticPageRepository.list();
    const faq = pages.find((page) => page.slug === 'faq')!;

    expect(faq.status).toBe('published');
    expect(faq.missingLanguages).toEqual([]);
    expect(faq.staleLanguages).toEqual([]);

    // And a Sinhala reader gets Sinhala, not a fallback.
    const preview = await staticPageRepository.preview('faq', 'si');
    expect(preview.usedFallback).toBe(false);
    expect(preview.translation?.lang).toBe('si');
  });

  it('falls back on a page written only in English', async () => {
    await signInAsEditor();
    const pages = await staticPageRepository.list();
    const partial = pages.find(
      (page) => page.status === 'published' && page.missingLanguages.includes('ta'),
    )!;

    const preview = await staticPageRepository.preview(partial.slug, 'ta');
    expect(preview.usedFallback).toBe(true);
    expect(preview.translation?.lang).toBe(EDITORIAL_FALLBACK_LANGUAGE);
  });

  it('shows nothing at all for a page nobody has written', async () => {
    await signInAsEditor();
    const pages = await staticPageRepository.list();
    const unwritten = pages.find((page) => page.status === 'draft')!;

    // The one state that must never reach a supplier, and the reason the fallback copy is
    // required before a publish. The app renders its own bundled default here.
    const preview = await staticPageRepository.preview(unwritten.slug, 'en');
    expect(preview.translation).toBeNull();

    signOut();
    await signInAs(ADMIN);
    await expect(staticPageRepository.publish(unwritten.slug)).rejects.toMatchObject({
      code: 'fallback-translation-missing',
    });
  }, 20_000);

  it('writes a never-written page, then publishes it once', async () => {
    await signInAsEditor();
    const before = await staticPageRepository.list();
    const target = before.find((page) => page.status === 'draft')!.slug;

    const saved = await staticPageRepository.saveTranslation(target, 'en', {
      title: 'Credit terms',
      body: 'Advances are settled against the account for the month they were taken in.',
    });
    // Saving does not publish: the page has never been live, so the app is still showing
    // its bundled default until somebody decides otherwise.
    expect(saved.status).toBe('draft');

    signOut();
    await signInAs(ADMIN);
    const published = await staticPageRepository.publish(target);
    expect(published.status).toBe('published');
    expect(published.publishedByName).toBeTruthy();

    // Once. After this an edit is live, which is why there is no second publish.
    await expect(staticPageRepository.publish(target)).rejects.toMatchObject({
      code: 'already-published',
    });
  }, 30_000);

  it('records the previous wording when a live page is edited', async () => {
    await signInAsEditor();
    const body = 'Leaf is bought by weight at the collection point, at the published rate.';
    await staticPageRepository.saveTranslation('terms', 'en', { title: 'Terms of supply', body });

    signOut();
    await signInWithMfaAs(MANAGER);
    const trail = await auditRepository.forEntity('staticPage', 'terms');
    const entry = trail.items.find(
      (candidate) => candidate.action === 'staticPage.translation.save',
    );

    /**
     * This entry is what makes "an edit to a live page goes out immediately" defensible
     * rather than a shortcut. A wrong change to the terms of supply is reconstructable
     * from the log, by name and with the previous wording — which is what a review step
     * would otherwise have been for.
     */
    expect(entry).toBeTruthy();
    expect(entry?.before).toMatchObject({ lang: 'en' });
    expect((entry?.before as { body: string }).body).toBeTruthy();
    expect(entry?.after).toMatchObject({ lang: 'en', body });
  }, 20_000);

  it('is not behind a feature flag, unlike news', async () => {
    /**
     * Terms, privacy and the FAQ are not a feature a factory buys or declines — the app
     * links to them from its own settings screen, and a tenant that could turn them off
     * would ship a binary with dead links in it. News is genuinely optional and is
     * flag-gated; this is the assertion that keeps the two from being conflated.
     */
    await signInAsEditor();
    const token = useAuthStore.getState().accessToken;

    const asTenant = (path: string, tenant: string) =>
      fetch(`http://localhost${path}`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Tenant': tenant },
      });

    // `highland` has `enableNews: false`.
    expect((await asTenant('/admin/news', 'highland')).status).toBe(403);
    expect((await asTenant('/admin/static-pages', 'highland')).status).toBe(200);
  });
});

describe('AC-08 · gaps are relative to what the factory publishes in', () => {
  beforeEach(() => {
    signOut();
  });

  it('does not report Sinhala missing to a factory that does not author in it', async () => {
    await signInAsEditor();
    const token = useAuthStore.getState().accessToken;

    const read = async (tenant: string) => {
      const response = await fetch('http://localhost/admin/static-pages', {
        headers: { Authorization: `Bearer ${token}`, 'X-Tenant': tenant },
      });
      return (await response.json()) as Array<{ slug: string; missingLanguages: string[] }>;
    };

    // Galaboda authors in si/en/ta; highland in en/ta only.
    const galaboda = await read('galaboda');
    const highland = await read('highland');

    const partial = (rows: Awaited<ReturnType<typeof read>>) =>
      rows.find((row) => row.slug === 'savingsScheme')!;

    // English-only copy: Galaboda is missing two languages, highland only one.
    expect(partial(galaboda).missingLanguages).toEqual(expect.arrayContaining(['si', 'ta']));
    expect(partial(highland).missingLanguages).toEqual(['ta']);
    // An office told it has work it does not have stops reading the warnings.
    expect(partial(highland).missingLanguages).not.toContain('si');
  });

  it('refuses a translation in a language the factory does not author in', async () => {
    await signInAsEditor();
    const token = useAuthStore.getState().accessToken;

    const response = await fetch('http://localhost/admin/static-pages/terms/translations/si', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant': 'highland',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'නියම', body: 'සිංහල පිටපත' }),
    });

    // Stored, it would be copy nothing renders — and a gap report nobody can trust.
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'invalid' });
  });
});
