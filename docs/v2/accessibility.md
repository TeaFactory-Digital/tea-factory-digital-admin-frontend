# Accessibility: the console

Two halves. The machine half runs on every change; the human half is a screen-reader pass
somebody does before the console is demonstrated or a release goes to a new factory.

## 1. The automated audit (done, in CI)

`apps/admin/e2e/accessibility.spec.ts` runs [axe](https://github.com/dequelabs/axe-core)
(`@axe-core/playwright` 4.14.0) against **WCAG 2.2 A and AA** on every screen, in the light
and the dark scheme. It signs in as the factory administrator for most screens and as the
manager for the queues and supplier records, and opens the first record of each list. It
also checks that every screen has exactly one `h1`. `npm run e2e` runs it with the rest.

First run, 30 October 2026: 79 findings, all fixed the same day.

| Finding | Where | Fix |
| --- | --- | --- |
| Contrast under 4.5:1 (`color-contrast`) | Every primary button (white on galaboda green #2E8B57, 4.24:1), links and selected chips in green | The brand package keeps every text pairing at AA itself (`packages/brand/src/contrast.ts`, `readablePalette`): a factory's `primary` is moved along its own hue only as far as it must (galaboda: #2E8B57 to #2A8050), the tint behind green text is lightened rather than the brand colour darkened further, and `textSecondary` the same. A colour that already passes is untouched. Any factory's colours, not only galaboda's |
| Tabs pointing at panels that do not exist (`aria-valid-attr-value`) | Language strip, dashboard range, users and roles, a supplier's income views | Not tabs: a choice that redraws the screen. Now a radio group (`components/ui/Segmented.tsx`): one Tab stop, the arrow keys move and choose, `aria-checked` on the chosen one. Real tabs with panels (a supplier's sections, reports) stay `Tabs` |
| Link name not starting with its visible text (`label-content-name-mismatch`, WCAG 2.5.3) | The factory mark at the top of the sidebar, named "Dashboard" while showing the factory's name | The name is the visible text, then "Dashboard" for screen readers |
| Link told apart by colour only (`link-in-text-block`) | "News" link inside a sentence on Notifications | Underlined |
| No `h1` | A screen the person may not open ("You do not have access"), a switched-off feature, records kept in the factory system | The guard states carry their own `h1` |

## 2. The screen-reader pass (to do, by a person)

Not something a test can judge: whether the order things are read in makes sense, whether
an announcement says something useful, whether a dialog can be finished without sight.

**Set-up.** NVDA (latest) with Firefox or Chrome on Windows, and VoiceOver with Safari on
macOS. A 1366×768 window, as in the office. Sign in as the clerk, then the manager. English
first, then Sinhala and Tamil (the voice must read the labels in the right language: the
document `lang` follows the console's language).

**For each flow, check:**

1. **Sign in.** Field names read; a wrong password is announced, not only shown.
2. **Finding your way.** `H` jumps to one `h1` per screen and its words say where you are;
   landmarks (`D` in NVDA, the rotor in VoiceOver) list the navigation and the main area.
3. **A data grid** (Suppliers, Bills). Column headers read with each cell; sorting is
   announced; the row link opens the record; the page controls say which page.
4. **A dialog** (Post a correction, Write a notification, a credit decision). Focus moves
   into it, stays there, and returns to the button that opened it on close; the required
   fields say so; a refusal is read out.
5. **A choice of one** (the language strip, the dashboard range). Read as a radio group with
   its name; the arrows change it; a language with nothing written says "missing".
6. **Toasts.** "Saved", "Refused" and the reason are announced once, without moving focus.
7. **Month close.** The checklist reads in order; the publish confirmation states what will
   happen before the button.
8. **Corrections** (a supplier's Money tab). The list reads amount, month, reason and status
   together; the "Which way" choice reads the full sentence for the target chosen.
9. **Notifications.** The reach figures are read before the send; the warning that a
   language will get the English is read in the confirmation.

Record each problem with the screen, the reader and browser, what was heard, and what was
expected. *Not covered here:* the supplier app (TalkBack and VoiceOver on phones), which has
its own pass.
