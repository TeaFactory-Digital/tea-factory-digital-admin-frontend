/**
 * A static page written as **points**: FAQ questions, terms sections, privacy sections.
 *
 * Stored inside the page's ordinary `body` text, so no schema or API change is needed:
 *
 *     Optional introduction, any number of paragraphs.
 *
 *     ## When is my monthly bill available?
 *     Bills are usually finalized within the first two weeks.
 *
 *     ## How do I change my bank account?
 *     Update it under Settings.
 *
 * A line starting with `## ` begins a point; everything up to the next one is its text.
 * The console edits this as a list (add, delete, reorder), and the mobile app renders it
 * as tappable sections. A body with no `## ` line is plain text, which is what every page
 * written before this was, so nothing already stored changes meaning.
 *
 * **The mobile app carries a copy of this parser** (`src/utils/pagePoints.ts` there).
 * Change both, or the two will disagree about where a point ends.
 */

import type { StaticPageSlug } from './constants';

export interface PagePoint {
  title: string;
  body: string;
}

export interface PagePoints {
  /** Text before the first point. Empty when the page starts straight with a point. */
  intro: string;
  points: PagePoint[];
}

/** The pages edited as a list of points rather than as one block of text. */
export const POINT_PAGES: readonly StaticPageSlug[] = ['faq', 'terms', 'privacy'];

const MARKER = /^##(?:\s(.*))?$/;

export function parsePagePoints(body: string): PagePoints {
  const intro: string[] = [];
  const points: Array<{ title: string; lines: string[] }> = [];

  for (const line of body.replace(/\r\n/g, '\n').split('\n')) {
    const match = MARKER.exec(line);
    if (match) {
      points.push({ title: (match[1] ?? '').trim(), lines: [] });
    } else if (points.length > 0) {
      points[points.length - 1]!.lines.push(line);
    } else {
      intro.push(line);
    }
  }

  return {
    intro: intro.join('\n').trim(),
    points: points.map((point) => ({ title: point.title, body: point.lines.join('\n').trim() })),
  };
}

export function serializePagePoints({ intro, points }: PagePoints): string {
  const parts = intro.trim() ? [intro.trim()] : [];
  for (const point of points) {
    // A title is one line: a newline in it would end the marker line early.
    const title = point.title.replace(/\s*\n\s*/g, ' ').trim();
    parts.push(point.body.trim() ? `## ${title}\n${point.body.trim()}` : `## ${title}`);
  }
  return parts.join('\n\n');
}

/** Whether a body is written as points at all. */
export function hasPagePoints(body: string): boolean {
  return parsePagePoints(body).points.length > 0;
}

/**
 * What is wrong with a list of points, or `null` when it is fine to save.
 *
 * A point needs both halves: a question with no answer, or an answer under no question, is
 * a broken row on a supplier's phone.
 */
export function pagePointsProblem(value: PagePoints): 'no-points' | 'incomplete-point' | null {
  if (value.points.length === 0) return value.intro.trim() ? null : 'no-points';
  return value.points.some((point) => !point.title.trim() || !point.body.trim())
    ? 'incomplete-point'
    : null;
}
