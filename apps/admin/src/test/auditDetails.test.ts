/**
 * An audit entry's fields, as the office reads them — not as the server wrote them.
 *
 * The inputs are the four entries a real news article produced, copied from the panel
 * that used to print them as JSON.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import i18next from 'i18next';
import { auditDetailLines } from '@/lib/auditDetails';

const read = (before: unknown, after: unknown) =>
  auditDetailLines(before, after).map((line) => [line.label, line.before, line.after]);

describe('auditDetailLines', () => {
  beforeAll(async () => {
    await i18next.changeLanguage('en');
  });

  it('names a publish in words, languages included', () => {
    expect(
      read(undefined, { status: 'published', staleLanguages: [], missingLanguages: ['si', 'ta'] }),
    ).toEqual([
      ['Status', undefined, 'Live'],
      ['Out-of-date languages', undefined, 'None'],
      ['Missing languages', undefined, 'Sinhala, Tamil'],
    ]);
  });

  it('says a translation was saved in which language', () => {
    expect(read(undefined, { lang: 'si', title: 'sinhala title' })).toEqual([
      ['Language', undefined, 'Sinhala'],
      ['Title', undefined, 'sinhala title'],
    ]);
  });

  it('turns an attachment id into what happened to the picture', () => {
    expect(
      read(undefined, { coverImageAttachmentId: '8b39f1d2-9cb7-45df-a74c-418792213a3b' }),
    ).toEqual([['Cover image', undefined, 'New image uploaded']]);
    expect(read({ coverImageAttachmentId: 'd3d7d56b' }, { coverImageAttachmentId: null })).toEqual([
      ['Cover image', undefined, 'Removed'],
    ]);
  });

  it('reads a replaced cover as one sentence, with no ids and no empty URL line', () => {
    expect(
      read(
        { coverImageUrl: null, coverImageAttachmentId: 'd3d7d56b-09a4-4896-a9d4-e00a6c37d94b' },
        { coverImageAttachmentId: '8b39f1d2-9cb7-45df-a74c-418792213a3b' },
      ),
    ).toEqual([['Cover image', undefined, 'Image replaced with a new one']]);
  });

  it('reads a nested value field by field rather than as JSON', () => {
    expect(read(undefined, { action: { type: 'screen', path: 'news' } })).toEqual([
      ['Button opens', undefined, 'Type: screen, Path: news'],
    ]);
  });

  it('pairs before with after, hides bare ids and still shows a field nobody labelled', () => {
    expect(
      read(
        { status: 'draft', supplierId: 'abc-123' },
        { status: 'published', supplierId: 'abc-123', packetCount: 3 },
      ),
    ).toEqual([
      ['Status', 'Draft', 'Live'],
      ['Packet count', undefined, '3'],
    ]);
  });

  it('reads in the console language', async () => {
    await i18next.changeLanguage('si');
    expect(read(undefined, { missingLanguages: ['ta'] })).toEqual([
      ['නැති භාෂා', undefined, 'දෙමළ'],
    ]);
    await i18next.changeLanguage('en');
  });
});
