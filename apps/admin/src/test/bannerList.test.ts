/**
 * `GET /admin/banners` as the API sends it now (`title`, not `headline`), read through the
 * repository. Reading only `headline` left every row's title blank.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/services/mocks/server';
import { bannerRepository } from '@/services/repositories/bannerRepository';
import { signInAs, signOut } from './render';

const ROW = {
  id: '9754e79e-0c5b-4e13-9aab-bff9ade2e684',
  status: 'published',
  imageUrl: 'https://example.test/banner.jpg',
  imageAspectRatio: 1.5,
  action: { url: 'https://tea-factory-digital-web-marketing.vercel.app/', type: 'url' },
  startsAt: '2026-10-03T18:16:00.000Z',
  endsAt: '2026-10-30T18:30:00.000Z',
  window: 'live',
  title: 'test2',
  hasImage: true,
  missingLanguages: ['si', 'ta'],
  staleLanguages: [],
  publishedByName: 'The Administrator',
  updatedAt: '2026-10-03T18:17:58.870Z',
  updatedByName: 'The Administrator',
};

describe('the banner list', () => {
  beforeEach(async () => {
    signOut();
    await signInAs('factoryadmin@galabodatea.lk');
    server.use(http.get('*/admin/banners', () => HttpResponse.json([ROW])));
  });

  it('reads the title, artwork, button and editor the API sends', async () => {
    const [row] = (await bannerRepository.list()).items;
    expect(row).toMatchObject({
      title: 'test2',
      hasImage: true,
      imageUrl: ROW.imageUrl,
      action: ROW.action,
      updatedByName: 'The Administrator',
      missingLanguages: ['si', 'ta'],
      staleLanguages: [],
    });
  });

  it('searches by that title', async () => {
    expect((await bannerRepository.list({ q: 'TEST2' })).items).toHaveLength(1);
    expect((await bannerRepository.list({ q: 'nothing' })).items).toHaveLength(0);
  });
});
