/**
 * When the connection comes back, say so once (26 November 2026). TanStack Query refetches
 * what is on screen by itself (`refetchOnReconnect`); this only tells the clerk the figures
 * are being brought up to date, so they do not reload the page to be sure.
 *
 * No sound: it is not an answer to anything the person did.
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/components/ui/Toast';
import { useOnline } from '@/lib/useOnline';

export function useConnectionNotice(): void {
  const { t } = useTranslation();
  const toast = useToast();
  const online = useOnline();
  const wasOffline = useRef(!online);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      toast.success(t('connection.back'), t('connection.backHint'));
    }
  }, [online, t, toast]);
}
