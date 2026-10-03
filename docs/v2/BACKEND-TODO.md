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

---

## 10. Static content never reaches the mobile app: add one supplier endpoint

**Priority:** High. The office can write and publish static pages in the console, but no
supplier ever sees them.

**What is wrong**
Static pages have only **admin** endpoints (`/v1/admin/static-pages…`). There is no endpoint the
mobile app can call, so a published page goes nowhere.

**The mobile app is already built for this** (it reads the endpoint below for its FAQ, Terms and
Privacy policy screens). Until it exists, those screens show the copy bundled with the app.

**Where**
`apps/api/src/modules/supplier-app/supplier-content.controller.ts`, next to `news` and
`news/:id`. Copy their decorators and their `lang` handling (`this.language(lang)`).

### `GET /v1/pages/:slug?lang=si`

One published page.

```json
{
  "slug": "faq",
  "title": "Questions suppliers ask",
  "body": "## How is my rate set?\nBy the monthly auction.",
  "lang": "en",
  "usedFallback": true,
  "updatedAt": "2026-10-03T06:30:00.000Z"
}
```

- Use the requested language's translation, or the fallback language's (English) when that
  language is not written. Same rule as news: `resolveTranslation(...)`.
- `lang` is the language the copy is **actually in**; `usedFallback` is `true` when that is not
  the language asked for. (The app shows "not yet in your language" when it is.)
- `updatedAt` is that translation's `updatedAt`.
- `body` is sent **exactly as stored**. It may contain `## ` point lines (see #11); the app reads
  them.
- **`200 null`** (not `404`) when the page is not published, or the slug is valid but unwritten.
  This matches `GET /news/:id`.
- `404` only for a slug outside the six (`faq`, `savingsScheme`, `creditTerms`, `about`, `terms`,
  `privacy`), using the same `assertSlug` as `StaticPagesService`.
- Realm `supplier`, `@TenantScope('token', …)`, `@NoCapability('a supplier acts only on themselves')`,
  `@NoIdempotency('read-only')`, `@NoAudit('read-only')`.
- **No feature flag** (`@NoFeature(...)`): the fixed pages are not a feature a factory turns off,
  same as the admin side.
- Read only `published` pages. A draft must never reach a phone.

**Check**
1. In the console, open Static content, write the FAQ in English, publish it.
2. In the app, open Settings → FAQ. The console's FAQ shows instead of the bundled one.
3. Switch the app to Sinhala: the English FAQ shows with "not yet in your language".
4. Publish Privacy: Settings → Privacy policy shows it.

---

## 11. Default FAQ, Terms and Privacy for every factory, and keep their "points" text as it is

**Priority:** Medium. Without it, the console opens on empty pages and the app keeps showing
its own built-in copy.

### What changed in the frontend (no backend work, just so you know)

- The console now edits **FAQ, Terms and Privacy as a list of points**: add a question or a
  section, delete one, move it up or down, in each language.
- The mobile app has a **Privacy policy** screen now, next to Terms and FAQ, and shows each
  point as a tappable section.
- The points are stored **inside the normal `body` text**, so there is **no schema or API
  change**. The format is:

  ```
  Optional introduction.

  ## When is my monthly bill available?
  Bills are usually finalized within the first two weeks.

  ## How do I change my bank account?
  Update your bank details under Settings.
  ```

  A line starting with `## ` begins a point; the text until the next one is its answer.

**Please do NOT** trim lines, strip `#` characters or otherwise reformat `body` when saving a
static page translation. Store it exactly as sent, as today. (The 20,000 character limit is fine:
the longest seeded page is about 8,600.)

### Default pages: added by the backend, automatically, for every factory

Every factory should start with FAQ, Terms and Privacy already written, **without anybody
running a seed script by hand**: the factories that exist today, and every factory added later.

**The content is ready:** [`static-pages.seed.json`](static-pages.seed.json), next to this file.
FAQ (14 questions), Terms (introduction + 18 sections) and Privacy (2 sections), in English,
Sinhala and Tamil, copied word for word from what the app shows today, already in the points
format. `{{factory}}` in the text stands for the factory's name.

**1. Put the content in the backend**

Copy the JSON into the API, e.g. `apps/api/src/modules/content/defaults/static-pages.json`, so it
ships with the API build (not only in `prisma/seed/`, which the running API does not load).

**2. One function that adds what is missing**

In `StaticPagesService` (or a small `DefaultStaticPagesService` next to it):

```ts
async ensureDefaults(tx, factoryId: string, factoryName: string)
```

For each page in the JSON:
- If a `StaticPage` row for `(factoryId, slug)` **already exists, skip the page entirely.**
  Do not add, change or re-add any of its translations. Once a page exists it belongs to the
  office: if they deleted a FAQ question or a whole language, it must stay deleted.
- Otherwise create `StaticPage { factoryId, slug, status: 'published', publishedAt: now,
  publishedByName: 'System' }` and one `StaticPageTranslation` per language
  `{ title, body, updatedByName: 'System' }`, with every `{{factory}}` replaced by `factoryName`.
- Do it in one transaction per factory, and use `createMany({ skipDuplicates: true })` or
  `ON CONFLICT DO NOTHING`, so two API instances starting at once cannot double-insert.

**3. Call it automatically, in two places**

- **When the API starts** (`OnApplicationBootstrap` in the content module): run `ensureDefaults`
  for every row in `factories`. This fills in today's factories on the next deploy, and any
  factory created later on the following start. It is cheap: one existence check per factory per
  page, and nothing is written once the pages exist.
- **When a factory is created**: call it from the tenant creation in
  `apps/api/prisma/seed/tenant.ts` (used by `db:seed:dev`, `db:seed:app` and staging), and from any
  future "create factory" endpoint, so a new factory has its pages immediately, before a restart.

Log one line per factory that got pages (`static pages: added faq, terms, privacy for <slug>`), and
nothing when there was nothing to add.

**Not seeded:** `savingsScheme`, `creditTerms` and `about`. The app has no screens for them yet.

**Check**
1. Deploy. Open Static content in the console for an existing factory: FAQ, Terms and Privacy are
   live, in three languages, as lists of points, with that factory's own name in the text.
2. Delete a FAQ question in the console, save, restart the API: the question stays deleted.
3. Create a new tenant with the seed script: it has the three pages straight away.
4. Once #10 is done, the app's FAQ, Terms and Privacy policy show the same text, served by the API.

### "Questions about these terms?" in the app

No backend work. That block under the terms shows the factory's name, registration number,
location, telephone and email, which the app already reads from `GET /config` (`factory`). They
are edited in the console under **Configuration → The factory**, and the console's Terms page now
shows them with a link there.

---

## 12. Configuration: three sections cannot be saved (`unrecognized_keys`)

**Priority:** High. In the console, **Configuration → The factory**, **Collection & savings** and
**Banks** all fail to save.

**What is wrong**
`PATCH /v1/admin/config` validates the body with a `.strict()` schema (`configPatchSchema`,
`apps/api/src/modules/admin/admin.controller.ts`, around line 22) that lists only:
`flags, savings, manureProducts, teaPackets, creditRules, localization, theme, branding, push, payouts`.

The console also sends three more, so the whole save is refused:

```json
{ "code": "invalid", "details": { "issues": [
  { "code": "unrecognized_keys", "message": "Unrecognized key: \"factory\"" } ] } }
```

| Console section | Sends | Refused because |
|---|---|---|
| The factory | `factory` | not in the schema |
| Collection & savings | `collectionPoints` (with `savings` and `manureProducts` in the same request) | `collectionPoints` not in the schema, so savings and manure fail too |
| Banks | `banks` | not in the schema (although `columnFor` already maps it) |

`GET /admin/config` already **sends** all three, so the console shows them and lets the
administrator edit them, but nothing can be saved.

**Where**
- `admin.controller.ts`: `configPatchSchema`
- `apps/api/src/modules/admin/config-admin.service.ts`: `patch()` (around line 230)

**What to do**

**1. `banks`: the easy one.** It is a `client_config` column and `columnFor` already maps it.
Add to the schema:
```ts
banks: z.array(z.object({ name: z.string().trim().min(1), branches: z.array(z.string()) })).optional(),
```
and add `'banks'` to `WHOLESALE_BLOCKS` (it is the whole list, not a merge).

**2. `factory`: a different table.** These fields live on `factories`, not `client_config`
(the `read()` method already reads them from there). Add to the schema:
```ts
factory: z.object({
  name: z.string().trim().min(1).max(120).optional(),
  telephone: z.string().trim().min(1).max(40).optional(),
  regNo: z.string().trim().min(1).max(40).optional(),
  location: z.string().trim().min(1).max(200).optional(),
  supportEmail: z.string().trim().email().max(200).nullish(),
  supportHours: z.string().trim().max(200).nullish(),
  legalFooter: z.string().trim().max(1000).nullish(),
}).strict().optional(),
```
In `patch()`, take `factory` **out** of the `client_config` loop and write it with
`tx.factory.update({ where: { id: actor.factoryId }, data: { ...only the fields sent... } })`
(`regNo` → `reg_no`, etc. are mapped by Prisma). The console sends `null` for an empty optional
field (support hours, legal footer): store `null`. `name`, `telephone`, `regNo` and `location` are
required columns, so never write `null` or `''` to them. Leave out of the update any field not sent.
Remove `factory: 'factory'` from `columnFor`: there is no such `client_config` column.

**3. `collectionPoints`: also a different table** (`collection_points`). The console sends the full
list after the edit: `[{ "id": "<uuid or new>", "name": "MAKADURA" }, …]`. A new point has an id
that is not a uuid (e.g. `cp-new-point`).
- An item whose `id` is an existing point of this factory: update its `name`.
- An item whose `id` is not an existing point: create it (`code` = the name upper-cased with
  spaces as `-`, `active: true`).
- An existing **active** point missing from the list: set `active = false`. Never delete it:
  suppliers and deliveries reference it.
- The existing impact check already refuses removing a point that still has deliveries
  (`configImpact`); keep that working.

Schema:
```ts
collectionPoints: z.array(z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(80) })).optional(),
```

**4. Audit and version.** Keep one `config.update` audit entry per save with only the changed
blocks (as today), and bump `client_config.version` even when only `factory` or
`collectionPoints` changed, so the console's "someone else saved first" check still works.

**Check**
In the console, Configuration:
1. **The factory**: change the telephone, save. Reload: it stays. The mobile app's terms screen
   ("Questions about these terms?") shows the new number after its next config fetch.
2. **Collection & savings**: add a point, save. It appears in the Suppliers collection-point filter.
3. **Banks**: add a branch, save. Reload: it stays.
