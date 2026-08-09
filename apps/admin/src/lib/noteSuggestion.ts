/**
 * The one piece of text arithmetic behind the ready-made decision notes.
 *
 * Its own module rather than a function inside `DecisionNoteField`, for two
 * reasons: fast refresh only re-renders a file that exports components alone, and
 * the whitespace rule below is the part worth testing without a DOM.
 */

/**
 * Adds the sentence to the note, or takes it back out if it is already there.
 *
 * Adding never overwrites — a clerk's own words survive every chip they press, and
 * two chips compose into one note. Removing collapses the run of spaces it leaves
 * behind but keeps newlines: a clerk who wrote two paragraphs meant them.
 */
export function toggleNoteSuggestion(note: string, text: string): string {
  if (note.includes(text)) {
    return note
      .replace(text, '')
      .replace(/[^\S\n]{2,}/g, ' ')
      .trim();
  }
  const existing = note.trim();
  return existing ? `${existing} ${text}` : text;
}
