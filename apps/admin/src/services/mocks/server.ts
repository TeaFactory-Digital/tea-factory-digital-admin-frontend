/**
 * The Node-side mock, for Vitest.
 *
 * Same handlers as the browser worker — which is the point. A test that passes
 * against different fixtures from the ones the developer clicked through is a
 * test that proves nothing about the console.
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
