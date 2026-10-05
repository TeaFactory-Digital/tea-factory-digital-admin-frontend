/**
 * The four queues' filters are strict on the API: an unknown key is a `422` that empties the
 * queue. Staging refused every queue for `sort` and `dir` before this.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/services/mocks/server';
import { toQueueParams } from '@/services/endpoints/params';
import { creditRepository } from '@/services/repositories/creditRepository';
import { signInAs, signOut } from './render';

beforeEach(() => signOut());

describe('queue requests', () => {
  it('never carry sort or dir', () => {
    expect(toQueueParams({ status: 'pending', sort: 'ageHours', dir: 'asc', page: 0 })).toEqual({
      status: 'pending',
      page: '0',
    });
  });

  it('send only the keys the API accepts', async () => {
    let seen = '';
    server.use(
      http.get('*/admin/credit-requests', ({ request }) => {
        seen = new URL(request.url).search;
        return HttpResponse.json({ items: [], page: 0, pageSize: 25, total: 0, nextPage: null });
      }),
    );
    await signInAs('clerk@galabodatea.lk');
    await creditRepository.list({ status: 'pending', supplierId: 'x', page: 0, pageSize: 25 });
    const keys = [...new URLSearchParams(seen).keys()];
    const allowed = ['status', 'supplierId', 'q', 'page', 'pageSize', 'facility', 'overCeiling'];
    expect(keys.every((key) => allowed.includes(key))).toBe(true);
  });
});
