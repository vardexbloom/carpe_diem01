-- Carpe Diem P1: catalogue, orders, payments, security rules.
-- Additive only: every table is created with plain CREATE TABLE, so if a table with the same name
-- already exists in your Supabase project this script fails and rolls back, changing nothing.
begin;

-- ---------- helpers ----------
create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- catalogue ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(name) between 1 and 60),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(name) between 1 and 120),
  description text not null default '',
  category_id uuid references public.categories(id) on delete set null,
  price_paise integer not null check (price_paise >= 0),
  mrp_paise integer check (mrp_paise is null or mrp_paise >= price_paise), -- only fill with a price really charged before
  is_active boolean not null default true,
  is_new boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();
create index products_active_idx on public.products (is_active, sort_order);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  alt text not null default '',
  position integer not null default 0,
  is_demo boolean not null default true -- true = placeholder photo, shown with a "Demo photo" label
);
create index product_images_product_idx on public.product_images (product_id, position);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null check (length(size) between 1 and 10),
  color text not null default '' check (length(color) <= 30),
  sku text not null unique check (length(sku) between 3 and 60),
  stock integer not null default 0 check (stock >= 0),
  is_active boolean not null default true,
  unique (product_id, size, color)
);
create index product_variants_product_idx on public.product_variants (product_id);

create table public.store_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'super_admin' check (role in ('super_admin')),
  created_at timestamptz not null default now()
);

-- ---------- orders ----------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no bigint generated always as identity (start with 1001),
  public_token uuid not null unique default gen_random_uuid(), -- unguessable link for the guest order page
  user_id uuid references auth.users(id) on delete set null,
  idempotency_key text not null unique,
  status text not null check (status in ('pending_payment','pending_cod_confirmation','confirmed','packed','shipped','delivered','cancelled','refunded','payment_review')),
  payment_method text not null check (payment_method in ('online','cod')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','failed','refunded')),
  customer_name text not null check (length(customer_name) between 2 and 80),
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  address_line1 text not null check (length(address_line1) between 5 and 200),
  address_line2 text not null default '' check (length(address_line2) <= 200),
  city text not null check (length(city) between 2 and 60),
  state text not null check (length(state) between 2 and 60),
  pincode text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  subtotal_paise integer not null check (subtotal_paise >= 0),
  shipping_paise integer not null default 0 check (shipping_paise >= 0),
  cod_fee_paise integer not null default 0 check (cod_fee_paise >= 0),
  discount_paise integer not null default 0 check (discount_paise >= 0),
  total_paise integer not null check (total_paise >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  stock_released boolean not null default false,
  expires_at timestamptz,
  paid_at timestamptz,
  courier text not null default '',
  tracking_no text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger orders_updated before update on public.orders for each row execute function public.set_updated_at();
create index orders_user_idx on public.orders (user_id);
create index orders_status_idx on public.orders (status, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_id uuid,
  product_name text not null, -- snapshot: stays correct even if the product is edited later
  sku text not null,
  size text not null,
  color text not null default '',
  unit_price_paise integer not null check (unit_price_paise >= 0),
  qty integer not null check (qty between 1 and 20),
  line_total_paise integer generated always as (unit_price_paise * qty) stored
);
create index order_items_order_idx on public.order_items (order_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'cashfree',
  provider_payment_id text not null,
  amount_paise integer not null check (amount_paise >= 0),
  status text not null check (status in ('success','failed','dropped')),
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);
create index payments_order_idx on public.payments (order_id);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  note text not null default '',
  actor text not null default 'system',
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, id);

create table public.inventory_movements (
  id bigint generated always as identity primary key,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('order','order_cancelled','payment_recovered','admin_adjustment','restock')),
  order_id uuid references public.orders(id) on delete set null,
  actor text not null default 'system',
  created_at timestamptz not null default now()
);
create index inventory_movements_variant_idx on public.inventory_movements (variant_id, id desc);

create table public.webhook_events (
  event_key text primary key,
  provider text not null,
  event_type text not null,
  received_at timestamptz not null default now()
);

-- ---------- admin check ----------
create function public.is_admin() returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.admin_users where user_id = (select auth.uid()))
$$;

-- ---------- pricing: the single source of truth for cart totals ----------
create function public.price_cart(p_items jsonb, p_method text) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  r record; v record;
  v_lines jsonb := '[]'::jsonb; v_issues jsonb := '[]'::jsonb;
  v_subtotal integer := 0; v_ship integer := 0; v_cod integer := 0; v_total integer;
  v_cfg jsonb; v_qty integer;
begin
  if p_method not in ('online','cod') then
    v_issues := v_issues || jsonb_build_object('code','bad_method');
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'issues', v_issues || jsonb_build_object('code','empty_cart'));
  end if;
  if jsonb_array_length(p_items) > 30 then
    return jsonb_build_object('ok', false, 'issues', v_issues || jsonb_build_object('code','too_many_lines'));
  end if;

  for r in
    select i->>'slug' as slug, i->>'size' as size, coalesce(i->>'color','') as color,
           sum(case when (i->>'qty') ~ '^[0-9]{1,3}$' then (i->>'qty')::integer else 0 end) as qty
    from jsonb_array_elements(p_items) i
    group by 1, 2, 3 order by 1, 2, 3
  loop
    v_qty := r.qty;
    if v_qty < 1 or v_qty > 10 then
      v_issues := v_issues || jsonb_build_object('code','bad_qty','slug',r.slug,'size',r.size);
      continue;
    end if;
    select pv.id as variant_id, pv.stock, pv.sku, pv.color, p.id as product_id, p.name, p.price_paise
      into v
      from public.product_variants pv join public.products p on p.id = pv.product_id
      where p.slug = r.slug and pv.size = r.size and pv.color = r.color and pv.is_active and p.is_active;
    if not found then
      v_issues := v_issues || jsonb_build_object('code','unavailable','slug',r.slug,'size',r.size);
    elsif v.stock < v_qty then
      v_issues := v_issues || jsonb_build_object('code','insufficient_stock','slug',r.slug,'size',r.size,'available',v.stock);
    else
      v_subtotal := v_subtotal + v.price_paise * v_qty;
      v_lines := v_lines || jsonb_build_object('variant_id',v.variant_id,'product_id',v.product_id,'slug',r.slug,'name',v.name,
        'sku',v.sku,'size',r.size,'color',v.color,'qty',v_qty,'unit_price_paise',v.price_paise,'line_total_paise',v.price_paise * v_qty);
    end if;
  end loop;

  select value into v_cfg from public.store_settings where key = 'shipping';
  v_ship := coalesce((v_cfg->>'flat_paise')::integer, 0);
  if (v_cfg->>'free_above_paise') is not null and v_subtotal >= (v_cfg->>'free_above_paise')::integer then v_ship := 0; end if;

  if p_method = 'cod' then
    select value into v_cfg from public.store_settings where key = 'cod';
    if coalesce((v_cfg->>'enabled')::boolean, false) is not true then
      v_issues := v_issues || jsonb_build_object('code','cod_unavailable');
    else
      v_cod := coalesce((v_cfg->>'fee_paise')::integer, 0);
    end if;
  elsif p_method = 'online' then
    select value into v_cfg from public.store_settings where key = 'online_payments';
    if coalesce((v_cfg->>'enabled')::boolean, false) is not true then
      v_issues := v_issues || jsonb_build_object('code','online_unavailable');
    end if;
  end if;

  v_total := v_subtotal + v_ship + v_cod;

  if p_method = 'cod' then
    select value into v_cfg from public.store_settings where key = 'cod';
    if (v_cfg->>'max_total_paise') is not null and v_total > (v_cfg->>'max_total_paise')::integer then
      v_issues := v_issues || jsonb_build_object('code','cod_limit','max_total_paise',(v_cfg->>'max_total_paise')::integer);
    end if;
  end if;

  return jsonb_build_object('ok', jsonb_array_length(v_issues) = 0, 'lines', v_lines, 'issues', v_issues,
    'subtotal_paise', v_subtotal, 'shipping_paise', v_ship, 'cod_fee_paise', v_cod, 'total_paise', v_total);
end $$;

-- ---------- create_order: validates, locks stock, writes the order atomically ----------
create function public.create_order(p_idempotency_key text, p_method text, p_customer jsonb, p_items jsonb, p_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o public.orders; v_cart jsonb; l jsonb; v_id uuid;
  v_name text := btrim(coalesce(p_customer->>'name','')); v_phone text := btrim(coalesce(p_customer->>'phone',''));
  v_email text := nullif(btrim(coalesce(p_customer->>'email','')),'');
  v_a1 text := btrim(coalesce(p_customer->>'address1','')); v_a2 text := btrim(coalesce(p_customer->>'address2',''));
  v_city text := btrim(coalesce(p_customer->>'city','')); v_state text := btrim(coalesce(p_customer->>'state',''));
  v_pin text := btrim(coalesce(p_customer->>'pincode',''));
  v_bad jsonb := '[]'::jsonb;
begin
  if p_idempotency_key is null or length(p_idempotency_key) not between 8 and 100 then
    return jsonb_build_object('ok', false, 'issues', jsonb_build_array(jsonb_build_object('code','bad_idempotency_key')));
  end if;
  perform pg_advisory_xact_lock(hashtext(p_idempotency_key));

  select * into o from public.orders where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('ok', true, 'replayed', true, 'order_id', o.id, 'order_no', o.order_no, 'public_token', o.public_token,
      'status', o.status, 'payment_method', o.payment_method, 'total_paise', o.total_paise);
  end if;

  if length(v_name) not between 2 and 80 then v_bad := v_bad || jsonb_build_object('code','invalid_customer','field','name'); end if;
  if v_phone !~ '^[6-9][0-9]{9}$' then v_bad := v_bad || jsonb_build_object('code','invalid_customer','field','phone'); end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_bad := v_bad || jsonb_build_object('code','invalid_customer','field','email'); end if;
  if length(v_a1) not between 5 and 200 then v_bad := v_bad || jsonb_build_object('code','invalid_customer','field','address1'); end if;
  if length(v_a2) > 200 then v_bad := v_bad || jsonb_build_object('code','invalid_customer','field','address2'); end if;
  if length(v_city) not between 2 and 60 then v_bad := v_bad || jsonb_build_object('code','invalid_customer','field','city'); end if;
  if length(v_state) not between 2 and 60 then v_bad := v_bad || jsonb_build_object('code','invalid_customer','field','state'); end if;
  if v_pin !~ '^[1-9][0-9]{5}$' then v_bad := v_bad || jsonb_build_object('code','invalid_customer','field','pincode'); end if;
  if jsonb_array_length(v_bad) > 0 then return jsonb_build_object('ok', false, 'issues', v_bad); end if;

  v_cart := public.price_cart(p_items, p_method);
  if not (v_cart->>'ok')::boolean then return jsonb_build_object('ok', false, 'issues', v_cart->'issues'); end if;

  -- lock the variant rows (fixed order, so two checkouts cannot deadlock), then price again on the locked rows
  perform 1 from public.product_variants
    where id in (select (x->>'variant_id')::uuid from jsonb_array_elements(v_cart->'lines') x) order by id for update;
  v_cart := public.price_cart(p_items, p_method);
  if not (v_cart->>'ok')::boolean then return jsonb_build_object('ok', false, 'issues', v_cart->'issues'); end if;

  insert into public.orders (user_id, idempotency_key, status, payment_method, customer_name, phone, email, address_line1, address_line2,
      city, state, pincode, subtotal_paise, shipping_paise, cod_fee_paise, total_paise, expires_at)
  values (p_user_id, p_idempotency_key, case p_method when 'cod' then 'pending_cod_confirmation' else 'pending_payment' end, p_method,
      v_name, v_phone, v_email, v_a1, v_a2, v_city, v_state, v_pin,
      (v_cart->>'subtotal_paise')::integer, (v_cart->>'shipping_paise')::integer, (v_cart->>'cod_fee_paise')::integer, (v_cart->>'total_paise')::integer,
      case p_method when 'online' then now() + interval '30 minutes' end)
  returning * into o;

  for l in select * from jsonb_array_elements(v_cart->'lines') loop
    v_id := (l->>'variant_id')::uuid;
    insert into public.order_items (order_id, variant_id, product_id, product_name, sku, size, color, unit_price_paise, qty)
      values (o.id, v_id, (l->>'product_id')::uuid, l->>'name', l->>'sku', l->>'size', l->>'color', (l->>'unit_price_paise')::integer, (l->>'qty')::integer);
    update public.product_variants set stock = stock - (l->>'qty')::integer where id = v_id;
    insert into public.inventory_movements (variant_id, delta, reason, order_id) values (v_id, -(l->>'qty')::integer, 'order', o.id);
  end loop;

  insert into public.order_events (order_id, status, note) values (o.id, o.status, 'Order placed (' || p_method || ')');
  return jsonb_build_object('ok', true, 'replayed', false, 'order_id', o.id, 'order_no', o.order_no, 'public_token', o.public_token,
    'status', o.status, 'payment_method', o.payment_method, 'total_paise', o.total_paise);
end $$;

-- ---------- cancel_order: gives stock back exactly once ----------
create function public.cancel_order(p_order_id uuid, p_reason text default 'cancelled') returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.orders; it record;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'order_not_found'); end if;
  if o.status = 'cancelled' then return jsonb_build_object('ok', true, 'replayed', true); end if;
  if o.payment_status = 'paid' then return jsonb_build_object('ok', false, 'error', 'paid_requires_refund'); end if;
  if o.status in ('shipped','delivered','refunded') then return jsonb_build_object('ok', false, 'error', 'not_cancellable'); end if;
  if not o.stock_released then
    for it in select variant_id, qty from public.order_items where order_id = o.id and variant_id is not null order by variant_id loop
      update public.product_variants set stock = stock + it.qty where id = it.variant_id;
      insert into public.inventory_movements (variant_id, delta, reason, order_id) values (it.variant_id, it.qty, 'order_cancelled', o.id);
    end loop;
  end if;
  update public.orders set status = 'cancelled', stock_released = true where id = o.id;
  insert into public.order_events (order_id, status, note) values (o.id, 'cancelled', left(p_reason, 200));
  return jsonb_build_object('ok', true, 'replayed', false);
end $$;

create function public.release_expired_orders() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; n integer := 0;
begin
  for r in select id from public.orders where status = 'pending_payment' and payment_status = 'unpaid' and expires_at < now() loop
    if (public.cancel_order(r.id, 'payment window expired')->>'ok')::boolean then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- ---------- mark_order_paid: only called by server code after Cashfree confirmation ----------
create function public.mark_order_paid(p_order_id uuid, p_provider_payment_id text, p_amount_paise integer, p_raw jsonb default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare o public.orders; it record; v_ok boolean := true;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'order_not_found'); end if;
  if o.payment_method <> 'online' then return jsonb_build_object('ok', false, 'error', 'not_an_online_order'); end if;
  if exists (select 1 from public.payments where provider = 'cashfree' and provider_payment_id = p_provider_payment_id and status = 'success') then
    return jsonb_build_object('ok', true, 'replayed', true);
  end if;

  if p_amount_paise <> o.total_paise then
    insert into public.payments (order_id, provider_payment_id, amount_paise, status, raw)
      values (o.id, p_provider_payment_id, p_amount_paise, 'success', p_raw) on conflict (provider, provider_payment_id) do nothing;
    update public.orders set status = 'payment_review' where id = o.id and payment_status <> 'paid';
    insert into public.order_events (order_id, status, note) values (o.id, 'payment_review', 'Amount mismatch: paid ' || p_amount_paise || ' vs order ' || o.total_paise || ' paise');
    return jsonb_build_object('ok', false, 'error', 'amount_mismatch');
  end if;

  insert into public.payments (order_id, provider_payment_id, amount_paise, status, raw)
    values (o.id, p_provider_payment_id, p_amount_paise, 'success', p_raw) on conflict (provider, provider_payment_id) do nothing;

  if o.payment_status = 'paid' then
    insert into public.order_events (order_id, status, note) values (o.id, o.status, 'Duplicate payment ' || p_provider_payment_id || ': refund needed');
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  if o.stock_released then  -- payment arrived after the window closed: try to take the stock again
    for it in select variant_id, qty from public.order_items where order_id = o.id and variant_id is not null order by variant_id loop
      perform 1 from public.product_variants where id = it.variant_id and stock >= it.qty for update;
      if not found then v_ok := false; end if;
    end loop;
    if not v_ok then
      update public.orders set status = 'payment_review', payment_status = 'paid', paid_at = now() where id = o.id;
      insert into public.order_events (order_id, status, note) values (o.id, 'payment_review', 'Paid after expiry and stock is gone: refund or restock needed');
      return jsonb_build_object('ok', true, 'needs_review', true);
    end if;
    for it in select variant_id, qty from public.order_items where order_id = o.id and variant_id is not null order by variant_id loop
      update public.product_variants set stock = stock - it.qty where id = it.variant_id;
      insert into public.inventory_movements (variant_id, delta, reason, order_id) values (it.variant_id, -it.qty, 'payment_recovered', o.id);
    end loop;
  end if;

  update public.orders set status = 'confirmed', payment_status = 'paid', paid_at = now(), stock_released = false where id = o.id;
  insert into public.order_events (order_id, status, note) values (o.id, 'confirmed', 'Payment verified (' || p_provider_payment_id || ')');
  return jsonb_build_object('ok', true, 'replayed', false);
end $$;

create function public.record_payment_attempt(p_order_id uuid, p_provider_payment_id text, p_status text, p_amount_paise integer, p_raw jsonb default null) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_status not in ('failed','dropped') then raise exception 'bad status'; end if;
  perform 1 from public.orders where id = p_order_id;
  if not found then return; end if;
  insert into public.payments (order_id, provider_payment_id, amount_paise, status, raw)
    values (p_order_id, p_provider_payment_id, p_amount_paise, p_status, p_raw)
    on conflict (provider, provider_payment_id) do update set status = excluded.status, raw = excluded.raw where public.payments.status <> 'success';
  update public.orders set payment_status = 'failed' where id = p_order_id and payment_status = 'unpaid';
  insert into public.order_events (order_id, status, note) values (p_order_id, 'payment_' || p_status, 'Payment ' || p_provider_payment_id || ' ' || p_status);
end $$;

-- Server-only functions: nobody except the service role may call them.
revoke all on function public.price_cart(jsonb, text), public.create_order(text, text, jsonb, jsonb, uuid), public.cancel_order(uuid, text),
  public.release_expired_orders(), public.mark_order_paid(uuid, text, integer, jsonb), public.record_payment_attempt(uuid, text, text, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.price_cart(jsonb, text), public.create_order(text, text, jsonb, jsonb, uuid), public.cancel_order(uuid, text),
  public.release_expired_orders(), public.mark_order_paid(uuid, text, integer, jsonb), public.record_payment_attempt(uuid, text, text, integer, jsonb)
  to service_role;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------- table privileges ----------
revoke all on public.categories, public.products, public.product_images, public.product_variants, public.store_settings, public.admin_users,
  public.orders, public.order_items, public.payments, public.order_events, public.inventory_movements, public.webhook_events from anon, authenticated;
grant select on public.categories, public.products, public.product_images, public.product_variants, public.store_settings to anon, authenticated;
grant insert, update, delete on public.categories, public.products, public.product_images, public.product_variants, public.store_settings to authenticated; -- gated by admin policies
grant select on public.admin_users, public.order_items, public.payments, public.order_events, public.inventory_movements to authenticated;
grant select, update on public.orders to authenticated;
grant insert on public.inventory_movements to authenticated;
grant all on public.categories, public.products, public.product_images, public.product_variants, public.store_settings, public.admin_users,
  public.orders, public.order_items, public.payments, public.order_events, public.inventory_movements, public.webhook_events to service_role;

-- ---------- row level security ----------
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.store_settings enable row level security;
alter table public.admin_users enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.order_events enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.webhook_events enable row level security; -- no policies: service role only

create policy categories_read on public.categories for select to anon, authenticated using (true);
create policy products_read on public.products for select to anon, authenticated using (is_active);
create policy images_read on public.product_images for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.is_active));
create policy variants_read on public.product_variants for select to anon, authenticated
  using (is_active and exists (select 1 from public.products p where p.id = product_id and p.is_active));
create policy settings_read on public.store_settings for select to anon, authenticated using (is_public);

create policy categories_admin on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy products_admin on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy images_admin on public.product_images for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy variants_admin on public.product_variants for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy settings_admin on public.store_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_users_self on public.admin_users for select to authenticated using (user_id = (select auth.uid()));

create policy orders_own on public.orders for select to authenticated using (user_id = (select auth.uid()));
create policy orders_admin_read on public.orders for select to authenticated using (public.is_admin());
create policy orders_admin_update on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy items_own on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));
create policy items_admin on public.order_items for select to authenticated using (public.is_admin());
create policy payments_admin on public.payments for select to authenticated using (public.is_admin());
create policy events_own on public.order_events for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));
create policy events_admin on public.order_events for select to authenticated using (public.is_admin());
create policy movements_admin_read on public.inventory_movements for select to authenticated using (public.is_admin());
create policy movements_admin_insert on public.inventory_movements for insert to authenticated with check (public.is_admin());

-- ---------- default settings (change these in the admin later) ----------
insert into public.store_settings (key, value, is_public) values
  ('shipping', '{"flat_paise": 0, "free_above_paise": null}', true),
  ('cod', '{"enabled": true, "fee_paise": 0, "max_total_paise": null}', true),
  ('online_payments', '{"enabled": true}', true);

commit;
