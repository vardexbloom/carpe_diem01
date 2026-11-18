\set ON_ERROR_STOP on
\pset pager off
create temp table results(name text, ok boolean);
-- helpers run as postgres; role switching via set local role
create function pg_temp.t(n text, c boolean) returns void language plpgsql as $$ begin insert into results values (n, coalesce(c,false)); end $$;
grant all on results to public; grant execute on function pg_temp.t(text, boolean) to public;

-- fixtures
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111','admin@x.test'),('22222222-2222-2222-2222-222222222222','cust@x.test'),('33333333-3333-3333-3333-333333333333','other@x.test');
insert into public.admin_users (user_id) values ('11111111-1111-1111-1111-111111111111');

-- 1. anonymous visitor: catalogue yes, orders/payments no
set role anon;
select pg_temp.t('anon reads active products', (select count(*) from public.products) = 10);
select pg_temp.t('anon reads variants with stock', (select sum(stock) from public.product_variants) > 0);
select pg_temp.t('anon reads public settings', (select count(*) from public.store_settings) = 3);
do $$ begin begin perform 1 from public.orders; exception when insufficient_privilege then perform pg_temp.t('anon cannot read orders', true); return; end; perform pg_temp.t('anon cannot read orders', false); end $$;
do $$ begin begin perform 1 from public.payments; exception when insufficient_privilege then perform pg_temp.t('anon cannot read payments', true); return; end; perform pg_temp.t('anon cannot read payments', false); end $$;
do $$ begin begin perform public.create_order('abcdefgh12','cod','{}'::jsonb,'[]'::jsonb); exception when insufficient_privilege then perform pg_temp.t('anon cannot call create_order', true); return; end; perform pg_temp.t('anon cannot call create_order', false); end $$;
do $$ begin begin perform public.mark_order_paid(gen_random_uuid(),'x',1); exception when insufficient_privilege then perform pg_temp.t('anon cannot call mark_order_paid', true); return; end; perform pg_temp.t('anon cannot call mark_order_paid', false); end $$;
do $$ begin begin insert into public.products (slug,name,price_paise) values ('hack','Hack',1); exception when insufficient_privilege or others then perform pg_temp.t('anon cannot insert product', true); return; end; perform pg_temp.t('anon cannot insert product', false); end $$;
do $$ begin update public.product_variants set stock = 9999; perform pg_temp.t('anon cannot update stock', (select max(stock) from public.product_variants) < 9999); exception when others then perform pg_temp.t('anon cannot update stock', true); end $$;
reset role;

-- 2. logged-in customer cannot call server functions or write catalogue
set role authenticated; select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
do $$ begin begin perform public.cancel_order(gen_random_uuid(),'x'); exception when insufficient_privilege then perform pg_temp.t('customer cannot call cancel_order', true); return; end; perform pg_temp.t('customer cannot call cancel_order', false); end $$;
do $$ declare n int; begin update public.products set price_paise = 1; get diagnostics n = row_count; perform pg_temp.t('customer cannot change prices (0 rows)', n = 0); end $$;
do $$ begin begin update public.admin_users set role='super_admin'; insert into public.admin_users (user_id) values ('22222222-2222-2222-2222-222222222222'); exception when others then perform pg_temp.t('customer cannot make themselves admin', true); return; end; perform pg_temp.t('customer cannot make themselves admin', false); end $$;
reset role;

-- 3. create_order (service role)
set role service_role;
create temp table o1 as select public.create_order('idem-key-0001','cod',
  '{"name":"Asha Rao","phone":"9876543210","email":"","address1":"12 MG Road","address2":"","city":"Bengaluru","state":"Karnataka","pincode":"560001"}',
  '[{"slug":"dream-glow-tee","size":"M","qty":2},{"slug":"dream-glow-tee","size":"M","qty":1},{"slug":"smoke-grey-wide-jeans","size":"L","qty":1}]', null) as r;
select pg_temp.t('create_order ok (duplicate lines merged)', (select (r->>'ok')::bool from o1));
select pg_temp.t('server price: 3x150 + 1x500 = 950 rupees', (select (r->>'total_paise')::int from o1) = 95000);
select pg_temp.t('COD order awaits confirmation', (select r->>'status' from o1) = 'pending_cod_confirmation');
select pg_temp.t('stock reserved (M tee 6 -> 3)', (select stock from public.product_variants where sku='CD-DREAM-GLOW-TEE-M') = 3);
select pg_temp.t('inventory movement logged', (select count(*) from public.inventory_movements where reason='order') = 2);
create temp table o1b as select public.create_order('idem-key-0001','cod','{}','[]',null) as r;
select pg_temp.t('same idempotency key replays, no 2nd order', (select (r->>'replayed')::bool from o1b) and (select count(*) from public.orders)=1);
select pg_temp.t('replay did not take stock twice', (select stock from public.product_variants where sku='CD-DREAM-GLOW-TEE-M') = 3);
select pg_temp.t('order item snapshots name+price', (select count(*) from public.order_items where product_name='Dream Glow Tee' and unit_price_paise=15000 and qty=3) = 1);
-- client-sent price is ignored: price is not even an input
select pg_temp.t('oversell blocked', (select (public.create_order('idem-key-0002','cod','{"name":"Asha Rao","phone":"9876543210","address1":"12 MG Road","city":"Bengaluru","state":"Karnataka","pincode":"560001"}','[{"slug":"dream-glow-tee","size":"M","qty":4}]')->>'ok')::bool) = false);
select pg_temp.t('oversell reports available stock', (select public.create_order('idem-key-0003','cod','{"name":"Asha Rao","phone":"9876543210","address1":"12 MG Road","city":"Bengaluru","state":"Karnataka","pincode":"560001"}','[{"slug":"dream-glow-tee","size":"M","qty":4}]')->'issues'->0->>'code') = 'insufficient_stock');
select pg_temp.t('bad phone rejected', (select public.create_order('idem-key-0004','cod','{"name":"Asha Rao","phone":"12345","address1":"12 MG Road","city":"Bengaluru","state":"Karnataka","pincode":"560001"}','[{"slug":"dream-glow-tee","size":"S","qty":1}]')->'issues'->0->>'field') = 'phone');
select pg_temp.t('unknown product rejected', (select public.create_order('idem-key-0005','cod','{"name":"Asha Rao","phone":"9876543210","address1":"12 MG Road","city":"Bengaluru","state":"Karnataka","pincode":"560001"}','[{"slug":"nope","size":"S","qty":1}]')->'issues'->0->>'code') = 'unavailable');
select pg_temp.t('negative/huge qty rejected', (select (public.create_order('idem-key-0006','cod','{"name":"Asha Rao","phone":"9876543210","address1":"12 MG Road","city":"Bengaluru","state":"Karnataka","pincode":"560001"}','[{"slug":"dream-glow-tee","size":"S","qty":-5}]')->>'ok')::bool) = false);
select pg_temp.t('failed attempts created no orders', (select count(*) from public.orders) = 1);

-- 4. online order, payment lifecycle
create temp table o2 as select public.create_order('idem-key-0010','online','{"name":"Ravi K","phone":"9000000001","email":"r@x.in","address1":"5 Park Street","city":"Kolkata","state":"West Bengal","pincode":"700016"}','[{"slug":"olive-wash-tee","size":"L","qty":1}]') as r;
select pg_temp.t('online order pending_payment', (select r->>'status' from o2) = 'pending_payment');
select pg_temp.t('wrong amount does not confirm', (select public.mark_order_paid((select (r->>'order_id')::uuid from o2),'cfp1',1000,'{}')->>'error') = 'amount_mismatch');
select pg_temp.t('amount mismatch -> payment_review', (select status from public.orders where id=(select (r->>'order_id')::uuid from o2)) = 'payment_review');

select pg_temp.t('correct amount confirms', (select public.mark_order_paid((select (r->>'order_id')::uuid from o2),'cfp2',15000,'{}')->>'ok')::bool);
select pg_temp.t('order confirmed + paid', (select status||'/'||payment_status from public.orders where id=(select (r->>'order_id')::uuid from o2)) = 'confirmed/paid');
select pg_temp.t('webhook replay is idempotent', (select (public.mark_order_paid((select (r->>'order_id')::uuid from o2),'cfp2',15000,'{}')->>'replayed')::bool));
select pg_temp.t('only one success payment row for cfp2', (select count(*) from public.payments where provider_payment_id='cfp2') = 1);
select pg_temp.t('second payment flagged as duplicate', (select (public.mark_order_paid((select (r->>'order_id')::uuid from o2),'cfp3',15000,'{}')->>'duplicate')::bool));
select pg_temp.t('paid order cannot be auto-cancelled', (select public.cancel_order((select (r->>'order_id')::uuid from o2),'x')->>'error') = 'paid_requires_refund');
select pg_temp.t('COD order cannot be marked paid online', (select public.mark_order_paid((select (r->>'order_id')::uuid from o1),'cfpx',95000)->>'error') = 'not_an_online_order');

-- 5. cancel gives stock back once
select pg_temp.t('cancel COD order ok', (select (public.cancel_order((select (r->>'order_id')::uuid from o1),'customer asked')->>'ok')::bool));
select pg_temp.t('stock restored (M tee back to 6)', (select stock from public.product_variants where sku='CD-DREAM-GLOW-TEE-M') = 6);
select pg_temp.t('second cancel does not restock again', (select (public.cancel_order((select (r->>'order_id')::uuid from o1),'again')->>'replayed')::bool) and (select stock from public.product_variants where sku='CD-DREAM-GLOW-TEE-M') = 6);

-- 6. expiry sweep + late payment recovers stock
create temp table o3 as select public.create_order('idem-key-0020','online','{"name":"Ravi K","phone":"9000000001","address1":"5 Park Street","city":"Kolkata","state":"West Bengal","pincode":"700016"}','[{"slug":"rugby-stripe-polo","size":"M","qty":3}]') as r;
select pg_temp.t('polo M x3 reserved', (select stock from public.product_variants where sku='CD-RUGBY-STRIPE-POLO-M') = 0);
update public.orders set expires_at = now() - interval '1 minute' where id=(select (r->>'order_id')::uuid from o3);
select pg_temp.t('sweep cancels expired unpaid order', public.release_expired_orders() = 1);
select pg_temp.t('expired order stock returned', (select stock from public.product_variants where sku='CD-RUGBY-STRIPE-POLO-M') = 3);
create temp table m3 as select public.mark_order_paid((select (r->>'order_id')::uuid from o3),'cfp9',45000,'{}') as r;
select pg_temp.t('late payment re-takes stock and confirms', (select (r->>'ok')::bool from m3) and (select status from public.orders where id=(select (r->>'order_id')::uuid from o3))='confirmed' and (select stock from public.product_variants where sku='CD-RUGBY-STRIPE-POLO-M')=0);
create temp table o4 as select public.create_order('idem-key-0021','online','{"name":"Ravi K","phone":"9000000001","address1":"5 Park Street","city":"Kolkata","state":"West Bengal","pincode":"700016"}','[{"slug":"star-patch-jeans","size":"L","qty":1}]') as r;
select public.cancel_order((select (r->>'order_id')::uuid from o4),'expired');
update public.product_variants set stock = 0 where sku='CD-STAR-PATCH-JEANS-L';
create temp table m4 as select public.mark_order_paid((select (r->>'order_id')::uuid from o4),'cfp10',50000,'{}') as r;
select pg_temp.t('late payment with no stock -> payment_review', (select (r->>'needs_review')::bool from m4) and (select status||'/'||payment_status from public.orders where id=(select (r->>'order_id')::uuid from o4))='payment_review/paid');
select public.record_payment_attempt((select (r->>'order_id')::uuid from o2),'cfp-fail','failed',15000,'{}');
select pg_temp.t('failed attempt cannot downgrade a success', (select count(*) from public.payments where provider_payment_id='cfp-fail')=1 and (select payment_status from public.orders where id=(select (r->>'order_id')::uuid from o2))='paid');

-- 7. settings-driven rules
update public.store_settings set value='{"flat_paise":4900,"free_above_paise":99900}' where key='shipping';
update public.store_settings set value='{"enabled":true,"fee_paise":3000,"max_total_paise":50000}' where key='cod';
select pg_temp.t('shipping + COD fee added by server', (select (public.price_cart('[{"slug":"olive-wash-tee","size":"M","qty":1}]','cod')->>'total_paise')::int) = 15000+4900+3000);
select pg_temp.t('free shipping above threshold', (select (public.price_cart('[{"slug":"smoke-grey-wide-jeans","size":"M","qty":2}]','online')->>'shipping_paise')::int) = 0);
select pg_temp.t('COD max order limit enforced', (select public.price_cart('[{"slug":"smoke-grey-wide-jeans","size":"M","qty":2}]','cod')->'issues'->0->>'code') = 'cod_limit');
update public.store_settings set value='{"enabled":false,"fee_paise":0,"max_total_paise":null}' where key='cod';
select pg_temp.t('COD can be switched off', (select public.price_cart('[{"slug":"olive-wash-tee","size":"M","qty":1}]','cod')->'issues'->0->>'code') = 'cod_unavailable');
reset role;

-- 8. customer sees only their own order; admin sees all
update public.orders set user_id='22222222-2222-2222-2222-222222222222' where id=(select (r->>'order_id')::uuid from o2);
set role authenticated; select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222"}',false);
select pg_temp.t('customer sees own order only', (select count(*) from public.orders)=1 and (select count(*) from public.order_items)=1);
select set_config('request.jwt.claims','{"sub":"33333333-3333-3333-3333-333333333333"}',false);
select pg_temp.t('other customer sees nothing', (select count(*) from public.orders)=0 and (select count(*) from public.order_items)=0);
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111"}',false);
select pg_temp.t('admin sees all orders', (select count(*) from public.orders)=4);
select pg_temp.t('admin sees payments', (select count(*) from public.payments)>0);
do $$ begin update public.products set price_paise = price_paise where slug='olive-wash-tee'; perform pg_temp.t('admin can edit products', true); exception when others then perform pg_temp.t('admin can edit products', false); end $$;
update public.products set is_active=false where slug='la-raglan-tee';
select pg_temp.t('admin sees inactive product', (select count(*) from public.products where slug='la-raglan-tee')=1);
reset role; set role anon;
select pg_temp.t('anon cannot see inactive product', (select count(*) from public.products where slug='la-raglan-tee')=0);
reset role;

select case when ok then 'PASS' else 'FAIL' end as r, name from results order by ok, name;
select count(*) filter (where ok) || ' / ' || count(*) as summary from results;
