# Adding a new factory

**For:** the platform team, the developers, and the factory's own administrator.
**In short:** one API and one console serve every factory, so a new factory is **data and
configuration, not code**. Each factory is a *tenant* identified by a short **slug** (for
example `hillside`). Only the supplier app is built separately per factory, because each
factory publishes its own app with its own name and icon.

| Part | Shared or per factory | Who |
|---|---|---|
| API (`tea-factory-digital-backend`) | Shared; one database, rows keyed on the factory | Platform team |
| Admin console (`tea-factory-digital-admin-frontend`) | Shared bundle; the subdomain picks the factory | Platform team, then the factory administrator |
| Supplier app (`tea-factory-digital-mobile-frontend`) | **One build per factory** | Mobile developer |

## 0. Decide first

- [ ] **Slug:** lower-case letters and digits, e.g. `hillside`. It becomes the console
      subdomain and the app's `X-Tenant`, and it **never changes**.
- [ ] **The factory's real details:** registered name, telephone, reg. no. (as on the
      bill), location, support email and hours. These print on every bill; never use
      placeholders.
- [ ] **Collection points** (code and name), e.g. `HATTON:Hatton`.
- [ ] **Factory system sync: on or off.** On: the factory's own system feeds the platform
      every hour. Off: the office keeps suppliers, leaf, rates and bills in the console
      ([factory-records.md](./factory-records.md)).
- [ ] **The first administrator:** name and email.

## 1. Backend: create the factory (platform team)

- [ ] Run the onboarding command with the details above
      ([BACKEND-TODO #47](./BACKEND-TODO.md); until it exists, call `seedTenant()` from
      `apps/api/prisma/seed/tenant.ts` the way `staging.ts` does).
      It creates the factory, its configuration with every feature flag written, the bank
      list, the collection points, the first `factoryAdmin` account, and the default static
      pages and notification triggers in Sinhala, Tamil and English with the factory's name.
- [ ] Hand the administrator their one-time password in person. They change it at first
      sign-in.
- [ ] Add the console's address to `CORS_ORIGINS` on the API and redeploy.

## 2. DNS and hosting (platform team)

- [ ] Point `<slug>.admin.<domain>` at the console deployment. The console reads the
      factory from the subdomain, so nothing is rebuilt.
- [ ] The API answers every factory at one host; the app and the console say which factory
      with the `X-Tenant` header (or the subdomain).

## 3. Console: brand and configure

**Optional, developer:** a bundled brand in `packages/brand/src/clients/index.ts` (logo and
colours). Without one the console starts on the neutral base brand and repaints in the
factory's colours as soon as `GET /config` answers.

**The factory administrator**, signed in at `<slug>.admin.<domain>`, under
**Configuration**:

- [ ] **The factory:** details as they appear on the bill.
- [ ] **Features:** switch off what the factory does not offer (loans, manure, tea packets,
      news...). A switched-off feature disappears from the app and the console together.
- [ ] **Factory system:** sync on or off (see step 0).
- [ ] **Collection & savings:** collection points, savings rates, withdrawal month,
      fertilizer catalogue with bag sizes and prices.
- [ ] **Banks & branches:** check the list the app offers suppliers.
- [ ] **Languages & branding:** logo, colours, languages.
- [ ] **Notifications:** which categories may be sent.
- [ ] **Tea packets:** packet size, price and monthly limit. Until set, the app does not let
      suppliers ask for packets.
- [ ] **Credit rules:** how each ceiling is worked out (basis, multiplier, months, cap).
- [ ] **Bill calculation:** pay in Rs. 1, 5 or 10; the next bill number after the factory's
      last paper bill; advance interest per month.
- [ ] **Common notes:** the office's ready-made sentences.
- [ ] **Static content:** read the default terms, privacy, FAQ, savings scheme, credit terms
      and about pages in all three languages, and edit them for this factory.
- [ ] **Users & roles:** add the clerks, managers (at least **two**, so one can approve what
      the other proposes) and the content editor.

## 4. The factory's records

**Sync on:**
- [ ] The factory's system vendor builds the read-only endpoint in
      [factory-system-team.md](./factory-system-team.md), checked against
      [factory-updates-sample.json](./factory-updates-sample.json).
- [ ] The first full pull is checked against one month of the factory's paper bills.

**Sync off:**
- [ ] Import the suppliers, then their opening balances, from Excel/CSV
      (**Suppliers → Import**; each screen offers a template).
- [ ] Enter or import the month's leaf (**Factory records → Leaf intake**), the rate, and the
      deduction rates (transport per collection point, stamps, caps).
- [ ] Generate one month's bills and have the factory's accountant check them against their
      own before publishing.

## 5. Supplier app: one build for this factory (mobile developer)

Follow "Add a new client" in the app repo's `docs/white-label.md`. In short:

- [ ] `src/config/clients/<slug>/index.ts`, copied from `default`: identity, colours,
      `api.headers['X-Tenant'] = '<slug>'`, and **its own `push.topicPrefix`** (sharing
      another factory's would let that factory's notifications reach these suppliers).
- [ ] Register it: `ClientId` in `src/config/types.ts`, `clients` in
      `src/config/clients/index.ts`, `VALID_CLIENTS` in `src/config/env.ts`.
- [ ] `.env.<slug>` with `APP_CLIENT=<slug>` and the production `API_BASE_URL`; build with
      `ENVFILE=.env.<slug>` (read on Android through `dotenv.gradle`, on iOS by the pod).
- [ ] Android product flavour and iOS scheme: package name, app name, icon, splash colour
      (the splash colour must equal the factory's primary colour).
- [ ] A Firebase project (or app) for push, and the store listings.

## 6. Before suppliers get the app

- [ ] Sign in to the console as each role and open the screens that role uses.
- [ ] Sign in to the app as one real supplier: the bill, savings and requests show this
      factory's figures, and nothing from another factory.
- [ ] Send one request from the app; it appears in the console queue, is decided, and the
      phone is notified.
- [ ] Publish a news article; it reaches the phone in the supplier's language.
