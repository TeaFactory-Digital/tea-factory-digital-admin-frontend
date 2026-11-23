/**
 * Watches for new requests and raises the alerts the person switched on (23 November 2026):
 * the chime whenever one arrives, and a desktop notification while the console is not the
 * tab in front. Clicking the notification brings the console forward on that request.
 *
 * It reads the same feed as the bell, and while an alert is on it keeps polling in a
 * background tab (every 30 seconds), which is the point: the bell alone pauses there.
 * Items already in the feed when the console opens are not announced, only new arrivals.
 */

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { qk } from '@/query/queryKeys';
import { activityRepository } from '@/services/repositories/activityRepository';
import { ALERT_KINDS, getAlerts, notificationsSupported, playChime, subscribeAlerts } from '@/lib/requestAlerts';
import { activityPath, activitySentence } from './activityText';
import { ACTIVITY_LIMIT } from './useActivity';

export function useRequestAlertSettings() {
  return useSyncExternalStore(subscribeAlerts, getAlerts, getAlerts);
}

export function useRequestAlerts(): void {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const alerts = useRequestAlertSettings();
  const on = alerts.sound || alerts.desktop;

  const feed = useQuery({
    queryKey: qk.activity,
    queryFn: () => activityRepository.feed(ACTIVITY_LIMIT),
    enabled: on,
    refetchInterval: on ? 30_000 : false,
    refetchIntervalInBackground: on,
    staleTime: 15_000,
    throwOnError: false,
  });

  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    const items = feed.data?.items;
    if (!on || !items) return;
    if (!seen.current) {
      seen.current = new Set(items.map((item) => item.id));
      return;
    }
    const known = seen.current;
    const fresh = items.filter((item) => !known.has(item.id) && ALERT_KINDS.has(item.kind));
    items.forEach((item) => known.add(item.id));
    if (fresh.length === 0) return;

    if (alerts.sound) playChime();
    if (
      alerts.desktop &&
      notificationsSupported() &&
      Notification.permission === 'granted' &&
      document.visibilityState === 'hidden'
    ) {
      const first = fresh[0]!;
      const notification = new Notification(
        fresh.length === 1 ? t('alerts.newOne') : t('alerts.newMany', { count: fresh.length }),
        {
          body: fresh
            .slice(0, 3)
            .map((item) => activitySentence(item, t))
            .join('\n'),
          tag: 'tfd-new-request',
          icon: '/brand/logo.svg',
        },
      );
      notification.onclick = () => {
        window.focus();
        void navigate(fresh.length === 1 ? activityPath(first) : '/');
        notification.close();
      };
    }
  }, [feed.data, on, alerts.sound, alerts.desktop, t, navigate]);
}
