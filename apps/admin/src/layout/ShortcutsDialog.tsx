/**
 * Every keyboard shortcut in one place (23 November 2026): press ? anywhere outside a box, or
 * choose "Keyboard shortcuts" in Ctrl+K. The console is a keyboard product, and a shortcut
 * nobody knows about is a shortcut nobody uses.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/ui/Dialog';
import { SHORTCUTS_EVENT } from './shortcutsEvent';


const ROWS: Array<{ keys: string[]; labelKey: string }> = [
  { keys: ['Ctrl', 'K'], labelKey: 'shortcuts.search' },
  { keys: ['?'], labelKey: 'shortcuts.help' },
  { keys: ['['], labelKey: 'shortcuts.sidebar' },
  { keys: ['A'], labelKey: 'shortcuts.approve' },
  { keys: ['R'], labelKey: 'shortcuts.reject' },
  { keys: ['J'], labelKey: 'shortcuts.next' },
  { keys: ['K'], labelKey: 'shortcuts.previous' },
  { keys: ['↑', '↓', 'Enter'], labelKey: 'shortcuts.rows' },
  { keys: ['Enter'], labelKey: 'shortcuts.nextBox' },
  { keys: ['Ctrl', 'Enter'], labelKey: 'shortcuts.saveSheet' },
  { keys: ['Esc'], labelKey: 'shortcuts.close' },
];

export function ShortcutsDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== '?' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      event.preventDefault();
      setOpen(true);
    }
    const onAsk = () => setOpen(true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(SHORTCUTS_EVENT, onAsk);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(SHORTCUTS_EVENT, onAsk);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen} title={t('shortcuts.title')} description={t('shortcuts.body')}>
      <table className="w-full text-body-small">
        <caption className="sr-only">{t('shortcuts.title')}</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">{t('shortcuts.keys')}</th>
            <th scope="col">{t('shortcuts.does')}</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.labelKey} className="border-b border-divider last:border-b-0">
              <td className="py-xs pr-md whitespace-nowrap">
                {row.keys.map((key, index) => (
                  <span key={key}>
                    {index > 0 ? <span className="px-xxs text-text-secondary">+</span> : null}
                    <kbd className="rounded-sm border border-border bg-surface-variant px-xs font-sans text-caption text-text-primary">
                      {key === 'Ctrl' && isMac ? '⌘' : key}
                    </kbd>
                  </span>
                ))}
              </td>
              <td className="py-xs text-text-primary">{t(row.labelKey)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}
