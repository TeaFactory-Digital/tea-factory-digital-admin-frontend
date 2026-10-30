/**
 * A composed notification in each of the factory's languages: the fallback required, the
 * others optional, and a supplier reading in a language left empty gets the fallback.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  halfWrittenNotificationLanguages,
  missingNotificationLanguages,
  notificationCopyFor,
} from '@tfd/domain';
import { notificationRepository } from '@/services/repositories/notificationRepository';
import { signInAs, signOut } from './render';

const ADMIN = 'factoryadmin@galabodatea.lk';
const english = { title: 'Factory closed on Poya', body: 'No weighing on Friday. Collection resumes Saturday.' };
const sinhala = { title: 'පොහොය දින කර්මාන්තශාලාව වසා ඇත', body: 'සිකුරාදා කිරීම නැත. සෙනසුරාදා නැවත එකතු කරයි.' };

beforeEach(() => signOut());

describe('the rules', () => {
  it('names the languages a supplier would read the fallback in', () => {
    expect(missingNotificationLanguages({ si: sinhala }, ['en', 'si', 'ta'])).toEqual(['ta']);
    expect(missingNotificationLanguages({ si: { title: ' ', body: '' } }, ['en', 'si', 'ta'])).toEqual(['si', 'ta']);
  });

  it('refuses half a translation', () => {
    expect(halfWrittenNotificationLanguages({ si: { title: sinhala.title, body: '' }, ta: { title: '', body: '' } })).toEqual(['si']);
  });

  it('gives each reader their own language, or the fallback', () => {
    expect(notificationCopyFor(english, { si: sinhala }, 'si')).toMatchObject({ ...sinhala, usedFallback: false });
    expect(notificationCopyFor(english, { si: sinhala }, 'ta')).toMatchObject({ ...english, usedFallback: true });
    expect(notificationCopyFor(english, { si: sinhala }, 'en')).toMatchObject({ ...english, usedFallback: false });
  });
});

describe('sending', () => {
  it('sends every written language, and the log says which', async () => {
    await signInAs(ADMIN);
    const receipt = await notificationRepository.send({
      category: 'billPublished',
      ...english,
      translations: { si: sinhala, ta: { title: '', body: '' } },
      audience: { kind: 'allSuppliers' },
    });
    const log = await notificationRepository.list({ page: 0, pageSize: 50 });
    const sent = log.items.find((one) => one.id === receipt.id)!;
    expect(sent).toMatchObject({ title: english.title, languages: ['en', 'si'] });
  });

  it('refuses a language with a title and no message before it leaves the browser', async () => {
    await signInAs(ADMIN);
    await expect(
      notificationRepository.send({
        category: 'billPublished',
        ...english,
        translations: { ta: { title: 'தொழிற்சாலை மூடப்பட்டுள்ளது', body: '' } },
        audience: { kind: 'allSuppliers' },
      }),
    ).rejects.toMatchObject({ code: 'invalid', details: { languages: ['ta'] } });
  });
});
