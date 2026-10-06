import { describe, expect, it } from 'vitest';
import { auditActionLabel } from '@/lib/auditLabels';
import { en } from '@/i18n/locales/en';

const t = (key: string) => (en as Record<string, string>)[key] ?? key;

describe('audit action labels', () => {
  it('labels the names the API registry writes, not only the contract names', () => {
    expect(auditActionLabel('consoleUser.create', t)).toBe('Added a console user');
    expect(auditActionLabel('auth.signIn', t)).toBe('Signed in');
    expect(auditActionLabel('supplier.profileUpdate', t)).toBe(
      'Changed their own details in the app',
    );
  });

  it('uses the imperative cancel verbs the server writes', () => {
    expect(auditActionLabel('creditRequest.cancel', t)).toBe('Withdrew a credit request');
    expect(auditActionLabel('teaPacketRequest.cancel', t)).toBe('Withdrew a tea packet request');
    expect(auditActionLabel('news.scheduleCancel', t)).toBe('Cancelled a scheduled news article');
  });

  it('still falls through to the raw verb for an action it does not know', () => {
    expect(auditActionLabel('something.new', t)).toBe('something.new');
  });
});
