# Backend to-do

Backend fixes found while testing the admin console and the mobile app against staging.
Each item says what is wrong, where, and what to change.

## Status (4 October 2026)

**Nothing open.** Items #1 to #25 are done and have been removed from this file. The last
batch (#19 to #25) is in `285b489`, `94844db` and `b683ed2`, and was checked on staging:

- #19 change request detail sends `decidedAt` and `decidedById`.
- #20 refresh accepts the console's `Origin` (no more `403 csrf`).
- #21 bank details change requests can be approved.
- #22 credit request detail opens.
- #23 inquiries send `closedByName` and `createdByName`.
- #24 `manureProducts` is a list again, and saved wholesale.
- #25 inquiries are conversations (`messages`, `POST /inquiries/:id/messages`).

New items will be added below as they are found.
