# Backend to-do

Small backend fixes found while testing the admin console against staging.
Each one says what is wrong, where, and what to change.

---

## 1. News cover image does not show in the mobile app

**Priority:** High. Suppliers never see the picture.

**What is wrong**
The admin console uploads a cover image as an attachment (`coverImageAttachmentId`).
For those articles the `coverImageUrl` column is `null`.
The supplier news endpoints send that column as it is, so the app gets `null` and shows no picture.

**Where**
`apps/api/src/modules/supplier-app/supplier-content.controller.ts`

- `GET /v1/news` (around line 87)
- `GET /v1/news/:id` (around line 132)

Both do `coverImageUrl: row.coverImageUrl`.

**What to do**

1. In both queries, add the attachment to the `include`:
   ```ts
   include: { translations: true, coverImageAttachment: { select: { storageKey: true } } }
   ```
2. Build `coverImageUrl` the same way the admin side already does in
   `NewsService.coverUrl()` (`apps/api/src/modules/content/news.service.ts`, around line 39):
   - attachment present: return `storage.signDownload(storageKey)`
   - otherwise: return `row.coverImageUrl`
3. Best: reuse that one helper instead of writing a second copy.

**Check**
Upload a cover in the admin console, publish the article, open it in the app. The picture shows.
Articles uploaded before the fix start working too. No re-upload needed.

---

## 2. Dashboard: the adoption trend counts fewer requests than the adoption card

**Priority:** Medium. The two numbers on the dashboard can disagree.

**What is wrong**
In `GET /admin/dashboard`:

- `app.appRequestShare` counts **change requests + credit requests + tea packet requests**.
- `adoptionTrend[].appShare` counts **change requests only**.

So "this month" on the chart and "this month" on the card can show different percentages.

**Where**
`apps/api/src/modules/admin/dashboard.service.ts`

- `appAdoption()` (around line 236): uses a `UNION ALL` of the three tables. Correct.
- `adoptionTrend()` (around line 314): selects `FROM change_requests` only. Needs fixing.

**What to do**
In `adoptionTrend()`, read from the same `UNION ALL` of the three tables that `appAdoption()` uses,
then group by month as it does now. Keep everything else the same:

- `NULL` when a month has no requests (not `0`)
- oldest month first
- no `count(*)` in the output (it is a `bigint`, and `JSON.stringify` throws on it)

**Check**
For the current month, `adoptionTrend` last value ÷ 100 equals `app.appRequestShare`.

---

## 3. Please do NOT change: `appShare` is a percentage

Just so nobody "fixes" this by accident.

- `adoptionTrend[].appShare` is sent as **0 to 100** (`100` means 100%).
- `app.appRequestShare` is sent as **0 to 1** (`1` means 100%).

They are different, which is confusing, but the admin console now converts the trend
(divides by 100 in `dashboardRepository.ts`). If the backend changes the trend to 0 to 1,
the chart will show 1% instead of 100%.

**If you do want to make them the same:** tell the frontend first. The `/ 100` in
`apps/admin/src/services/repositories/dashboardRepository.ts` (`toAdoptionTrend`) and the mock in
`apps/admin/src/services/mocks/handlers.ts` must change in the same release.

---

## 4. Optional: last-edited info on the news list

**Priority:** Low. Nice to have.

`GET /admin/news` sends `createdAt`, `createdByName`, `publishedAt` and `publishedByName`, but not who
edited the article last or when. The console used to have a "Last edit" column. It was removed
because these fields never arrived.

**If you want it back**, add to each row:

- `updatedAt`: the newest `updatedAt` across the article's translations
- `updatedByName`: the name on that same translation

Tell the frontend when it ships and the column can come back.
