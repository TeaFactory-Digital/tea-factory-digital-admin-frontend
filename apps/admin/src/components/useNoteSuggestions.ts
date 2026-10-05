/**
 * The chips under a note or reply box: the factory's own sentences when it has saved some
 * (Configuration, then Common notes; BACKEND-TODO #38), the built-in ones otherwise.
 *
 * Read in the console's language, falling back to English and then to whichever language
 * the chip was written in, so a chip saved only in Sinhala still shows to an English reader
 * rather than vanishing. Read from `GET /admin/config`, which every role that decides a
 * request may read; a role that may not keeps the built-in sentences.
 */

import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { can, type NoteSuggestionKey } from '@tfd/domain';
import { useAuthStore } from '@/auth/authStore';
import { qk } from '@/query/queryKeys';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import type { NoteSuggestion } from './DecisionNoteField';

function pick(words: Record<string, string>, language: string): string {
  return words[language] || words.en || Object.values(words).find(Boolean) || '';
}

export function useNoteSuggestions(
  key: NoteSuggestionKey,
  defaults: NoteSuggestion[],
): NoteSuggestion[] {
  const { i18n } = useTranslation();
  const grants = useAuthStore((s) => s.grants);
  const config = useQuery({
    queryKey: qk.adminConfig,
    queryFn: () => adminConfigRepository.get(),
    enabled: can(grants, 'flagsAndBranding', 'read'),
    staleTime: 5 * 60_000,
  });

  const saved = config.data?.config.noteSuggestions?.[key];
  if (!saved || saved.length === 0) return defaults;
  const language = i18n.language.slice(0, 2);
  return saved
    .map((chip) => ({ label: pick(chip.label, language), text: pick(chip.text, language) }))
    .filter((chip) => chip.label && chip.text);
}
