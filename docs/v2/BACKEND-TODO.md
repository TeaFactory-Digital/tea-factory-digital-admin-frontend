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

---

## 5. Suppliers list: six fields are missing

**Priority:** Medium. The console hides these columns until the fields arrive.

**What is wrong**
`GET /admin/suppliers` sends only 8 fields per row:
`id, supplierCode, name, division, status, collectionPoint, hasBankDetails, hasApp`.

The suppliers screen has columns for six more, and they are all empty today.

**Where**
`apps/api/src/modules/suppliers/suppliers.service.ts`, `list()` (around line 58).
Add each field to the `select` and to the `rows.map(...)` that builds the row.

**What to add to each row**

| Field | Type | Where it comes from |
|---|---|---|
| `nic` | string | `supplier.nic` (a column, just select it) |
| `paymentMethod` | `"cheque"`, `"bankTransfer"` or `"cash"` | `supplier.paymentMethod` (a column) |
| `savingsPerKg` | number | `supplier.savingsPerKg` (a column). It is a `Decimal`: send it as a **number**, e.g. `toNumber(...)`. `0` means opted out, send `0`, not `null`. |
| `lastDeliveryAt` | ISO string or `null` | newest `dayDate` in `LeafDelivery` for this supplier where `voidedAt` is `null`. `null` if none. |
| `pendingRequests` | number | count of this supplier's change requests + credit requests + tea packet requests with status `pending`, plus inquiries with status `open`. `0` if none. |
| `lastAppSignInAt` | ISO string or `null` | `SupplierAppAccount.lastSignInAt` (a column). `null` if never, or if there is no account. |

**Please keep the list fast**
Do the two counts and the "latest" lookups for the **whole page in one query each**
(`groupBy` / `GROUP BY supplier_id` over the page's ids), not one query per row.
A page is up to 200 suppliers.

**Please do NOT**
- Put a full bank account number in the list. `hasBankDetails` (true/false) is enough.
- Send `null` for `savingsPerKg` or `pendingRequests`. Use `0`.

**Check**
Open `/suppliers` in the console. The NIC, Savings /kg, Last delivery and Pending columns
appear on their own, with no frontend change. "Paid by" shows the method, and the App
column shows "last <date>" under "Signed in".

**Already fixed in the frontend (no backend change needed)**
- `collectionPoint` is an object `{ id, name }`. The console now reads `.name`.
- The collection point filter now sends `collectionPointId` (the id), which is what the API
  reads. Before, it sent `collectionPoint=<name>`, which the API ignored, so the filter did nothing.

---

## 6. Supplier detail page: six fields are missing

**Priority:** Medium. The page used to crash on this. The frontend now handles it, but the
page cannot show balances until these arrive.

**What is wrong**
`GET /admin/suppliers/:id` does not send these six fields, which the supplier page reads.

**Where**
`apps/api/src/modules/suppliers/suppliers.service.ts`, `byId()` (around line 123).
Add each field to the object that `byId()` returns.

**What to add**

| Field | Type | Where it comes from |
|---|---|---|
| `hasBankDetails` | boolean | `bankDetails !== null`. The list already sends this; send it here too. |
| `lastDeliveryAt` | ISO string or `null` | same as in the list (#5): newest `LeafDelivery.dayDate` where `voidedAt` is `null` |
| `pendingRequests` | number | same as in the list (#5). `0` if none. |
| `deviceCount` | number | count of `Device` rows for this supplier. `0` if none. |
| `savingsBalance` | number | the supplier's current savings balance (from `SavingsEntry` minus `SavingsWithdrawal`, or wherever the savings statement reads it). Send a **number**, not a `Decimal`. |
| `creditBalances` | `{ advance, loan, manure }`, all numbers | what the supplier still owes on each facility: one `CreditAccount` row per facility. Use the same balance the credit eligibility check uses (`balance`, or `externalBalance` when `balanceSource` says the factory system's figure is authoritative). Send `0` for a facility with no row, **always all three keys**. |

**Please do NOT**
- Send `creditBalances` as `null` or leave out a key. The page reads `creditBalances.advance`,
  `.loan` and `.manure`.
- Send a full bank account number. `accountNumberMasked` is what the page shows.

**Check**
Open a supplier in the console (`/suppliers/<id>`). On the Payout tab, the savings balance and the
three credit balances show numbers instead of "Credit balances are not available here yet."

**Already fixed in the frontend (no backend change needed)**
- The page no longer crashes when `creditBalances` is missing.
- `collectionPoint` is read as `{ id, name }`, and the bank number as `accountNumberMasked`.

---

## 7. Supplier notifications: add the title of each send

**Priority:** Low. The tab works without it, but shows the category name instead of the message title.

**What is wrong**
`GET /admin/suppliers/:id/notifications` sends each item in `sends` without a `title`.
The office cannot tell two "Bill published" messages apart.

**Where**
`apps/api/src/modules/notifications/notifications.service.ts`, `forSupplier()` (around line 346).
The query already loads `send.translations`. Only the mapping is missing.

**What to do**
In `sends: sends.map(...)`, add:

- `title`: the send's title in the factory's fallback language (English), from `row.send.translations`.

Nothing else needs to change. The console already reads `sends`, `sendId` and `optedIn`.

**Check**
Open a supplier, go to the Notifications tab. Under "Recent", each row shows the message title
with the category beside it.

**Already fixed in the frontend (no backend change needed)**
- The tab no longer stays blank. It read `recentSends`; the API sends `sends`.
- "Does the factory send this category?" is worked out by the console from the factory's
  config (`push.categories`), so the API does not need to send it.
- When push notifications are switched off for the factory, the tab now says so instead of
  showing nothing.

---

## 8. Banner image does not show in the mobile app (or in the console)

**Priority:** High. An uploaded banner image is saved but never shown anywhere.

**What is wrong**
The console uploads banner artwork as an attachment and saves it with
`PATCH /admin/banners/:id { imageAttachmentId, imageAspectRatio }`. That part works: the id is stored
in `Banner.imageAttachmentId`.

But every place that **reads** a banner sends only the `imageUrl` column, which is `null` for an
uploaded image. So:

- the mobile app gets no `imageUrl` and shows the banner without a picture;
- the console's banner editor and list show no picture either.

This is the same problem as #1 (news cover), for banners.

**Where**
- `apps/api/src/modules/supplier-app/supplier-content.controller.ts`, the active banner endpoint
  (around line 179): `imageUrl: row.imageUrl ?? undefined`. **This is the one the phone reads.**
- `apps/api/src/modules/content/banners.service.ts`:
  - `list()` (around line 59): `imageUrl: row.imageUrl` and `hasImage: Boolean(row.imageUrl)`
  - the single-banner read (around line 283): same
  - `preview()` (around line 333): `imageUrl: banner.imageUrl`

**What to do**
1. In each query above, add the attachment to the `include`:
   ```ts
   include: { translations: true, imageAttachment: { select: { storageKey: true } } }
   ```
2. Build `imageUrl` the way `NewsService.coverUrl()` does (`news.service.ts`, around line 39):
   - attachment present (and storage configured): `storage.signDownload(storageKey)`
   - otherwise: `row.imageUrl`
3. Set `hasImage` from that result, not from the column.
4. `BannersService` has no storage service yet: inject the same one `NewsService` uses.
   Best: move `coverUrl()` into one shared helper and use it for news, banners and the
   supplier endpoints (#1), so there is one copy.

**Check**
In the console, open a banner, upload artwork, save, publish it with a live window.
- The editor shows the picture after a page reload.
- The mobile app's banner shows the picture.

---

## 9. Optional: accept the image when a banner is created

**Priority:** Low. The console already works around it.

`POST /admin/banners` uses a `.strict()` schema (`bannerDraftSchema` in `content.controller.ts`,
around line 84) with no `imageAttachmentId`, although `BannersService.create()` already supports it.
So the console creates the banner first, then attaches the image with a second `PATCH`.

**If you want one request:** add to `bannerDraftSchema`:
```ts
imageAttachmentId: z.string().uuid().optional(),
```
Tell the frontend, and the second request can go.
