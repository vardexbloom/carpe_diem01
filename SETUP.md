# Carpe Diem: setup for the database, checkout and Cashfree

Without any of this the site still runs as a labelled **demo** (sample products, ordering switched off).

## 1. Environment variables (put them in `.env.local`, and later in Vercel)

| Name | Secret? | Where to find it |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | no | `http://localhost:3000` while testing, your real https address later |
| `NEXT_PUBLIC_SUPABASE_URL` | no | Supabase dashboard > Project Settings > API (Project URL) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | no | Supabase > Project Settings > API Keys > publishable key (`sb_publishable_...`) |
| `SUPABASE_SECRET_KEY` | **yes** | Supabase > Project Settings > API Keys > secret key (`sb_secret_...`) |
| `CASHFREE_APP_ID` | **yes** | Cashfree dashboard > Developers > API Keys (use the **Test** environment first) |
| `CASHFREE_SECRET_KEY` | **yes** | same page. Cashfree signs webhooks with this same key, so there is no separate webhook secret |
| `CASHFREE_ENV` | no | `sandbox` for testing, `production` only when Cashfree has approved your account |

Never paste the secret values into a chat. Online payment stays switched off until `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV` and `NEXT_PUBLIC_SITE_URL` are all set. COD works with just the three Supabase values.

## 2. Create the tables (Supabase dashboard > SQL Editor, no Terminal needed)

1. Safety check first. Run this; it must return **no rows** (otherwise a table with the same name already exists and you should tell me before going on):
   `select table_name from information_schema.tables where table_schema='public' and table_name in ('categories','products','product_images','product_variants','store_settings','admin_users','orders','order_items','payments','order_events','inventory_movements','webhook_events');`
2. Paste all of `supabase/migrations/20261112000001_catalog_orders.sql` and run it. It runs as one transaction: if anything clashes it changes nothing.
3. Paste all of `supabase/seed.sql` and run it. This adds the 10 **demo** products (sample prices, sample stock, demo photos). Replace them with real stock later.
4. Run `npm install`, then `npm run dev`.

## 3. Settings you must set before going live

Run in the SQL Editor (values are in paise: 4900 = Rs 49):

    update store_settings set value = '{"flat_paise": 4900, "free_above_paise": 99900}' where key = 'shipping';
    update store_settings set value = '{"enabled": true, "fee_paise": 3000, "max_total_paise": 300000}' where key = 'cod';

Right now shipping is **free** and COD has no fee and no limit. These are placeholders, not decisions.

## 4. Cashfree

1. Cashfree dashboard (Test) > Developers > Webhooks: add `https://YOUR-SITE/api/webhooks/cashfree` and tick *Payment success*, *Payment failed*, *Payment user dropped*. It must be a public https address, so test webhooks on a deployed preview (or a tunnel such as ngrok), not on plain localhost.
2. Online orders are only confirmed after the server hears from Cashfree (webhook, or the order page asking Cashfree directly). The browser saying "success" never counts.
3. Cashfree production needs KYC and a live site with returns, shipping, privacy and terms pages. Those pages are not written yet because they need your real rules.

## 5. Release stock from abandoned online payments (required)

An online order holds its stock for 30 minutes. This job gives it back. Enable it once: Supabase > Database > Extensions > turn on `pg_cron`, then run:

    select cron.schedule('release-expired-orders', '*/10 * * * *', 'select public.release_expired_orders()');

## 6. Make yourself an admin later

The admin app is the next milestone. Admin rights live in the `admin_users` table and can only be added by you in the SQL Editor.

## Known limits

- A brand-new unknown product address returns a "not found" page with status 200 the first time it is requested (404 afterwards); it is marked noindex.
- The checkout rate limiter is per server instance; add a shared store before heavy traffic.
- Product colours are not in the storefront yet (the database supports them).
