-- ============================================================
-- Aurelle — Supabase schema
-- ------------------------------------------------------------
-- Every object is prefixed `aurelle_` because this project also
-- hosts Linkeddit. Nothing here touches existing tables.
--
-- Security posture: RLS is ON for every table with NO policies.
-- That means the anon and authenticated keys can read nothing.
-- Only the service_role key (used by our Node server, never sent
-- to a browser) can touch this data. All customer access goes
-- through our API, which checks Clerk identity first.
-- ============================================================

-- ---------------------------------------------------------- products --
create table if not exists public.aurelle_products (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  cat         text not null,
  price       integer not null check (price > 0),
  mrp         integer not null check (mrp > 0),
  metal       text not null,
  badge       text,
  rating      numeric(2,1) default 4.5,
  reviews     integer default 0,
  stock       integer default 25 check (stock >= 0),
  blurb       text,
  img         text,
  img_alt     text,
  occasion    jsonb default '[]'::jsonb,
  swatches    jsonb default '[]'::jsonb,
  active      boolean default true,
  created_at  timestamptz default now(),
  constraint aurelle_mrp_gte_price check (mrp >= price)
);

-- --------------------------------------------------------- customers --
-- Mirrors Clerk users. Clerk owns identity; this row owns shop data.
create table if not exists public.aurelle_customers (
  id            uuid primary key default gen_random_uuid(),
  clerk_user_id text unique not null,
  email         text not null,
  first_name    text,
  last_name     text,
  phone         text,
  created_at    timestamptz default now(),
  last_seen_at  timestamptz default now()
);

-- ------------------------------------------------------------ admins --
-- Which Clerk users may open the dashboard. Membership here IS the
-- permission — a Clerk account alone grants nothing.
create table if not exists public.aurelle_admins (
  id            uuid primary key default gen_random_uuid(),
  clerk_user_id text unique,
  email         text unique not null,
  name          text,
  role          text default 'manager' check (role in ('owner','manager')),
  created_at    timestamptz default now()
);

-- ------------------------------------------------------------ orders --
create table if not exists public.aurelle_orders (
  id           uuid primary key default gen_random_uuid(),
  ref          text unique not null,
  customer_id  uuid references public.aurelle_customers(id) on delete set null,
  clerk_user_id text,
  first_name   text not null,
  last_name    text not null,
  email        text not null,
  phone        text not null,
  address      text not null,
  city         text not null,
  pincode      text not null,
  payment      text not null,
  subtotal     integer not null,
  shipping     integer not null,
  total        integer not null,
  status       text default 'placed'
               check (status in ('placed','packed','shipped','delivered','cancelled')),
  created_at   timestamptz default now()
);

create table if not exists public.aurelle_order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.aurelle_orders(id) on delete cascade,
  slug       text not null,
  name       text not null,
  finish     text,
  qty        integer not null check (qty > 0),
  unit_price integer not null,
  line_total integer not null
);

-- ---------------------------------------------------------- messages --
create table if not exists public.aurelle_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  order_ref  text,
  subject    text,
  body       text not null,
  handled    boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.aurelle_subscribers (
  email      text primary key,
  created_at timestamptz default now()
);

-- ----------------------------------------------------------- indexes --
create index if not exists aurelle_orders_status_idx   on public.aurelle_orders(status);
create index if not exists aurelle_orders_created_idx  on public.aurelle_orders(created_at desc);
create index if not exists aurelle_orders_clerk_idx    on public.aurelle_orders(clerk_user_id);
create index if not exists aurelle_items_order_idx     on public.aurelle_order_items(order_id);
create index if not exists aurelle_products_active_idx on public.aurelle_products(active);

-- --------------------------------------------------------------- RLS --
alter table public.aurelle_products    enable row level security;
alter table public.aurelle_customers   enable row level security;
alter table public.aurelle_admins      enable row level security;
alter table public.aurelle_orders      enable row level security;
alter table public.aurelle_order_items enable row level security;
alter table public.aurelle_messages    enable row level security;
alter table public.aurelle_subscribers enable row level security;

-- No policies are created on purpose. With RLS on and zero policies,
-- anon and authenticated roles are denied everything. service_role
-- bypasses RLS, so only our server can reach this data.

-- ============================================================
-- Atomic order creation.
-- PostgREST cannot span a transaction across HTTP calls, so the
-- price lookup, stock check, insert and decrement live here where
-- they either all happen or none do. Prices come from this table,
-- never from the browser.
-- ============================================================
create or replace function public.aurelle_create_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item          jsonb;
  prod          public.aurelle_products%rowtype;
  v_qty         integer;
  v_subtotal    integer := 0;
  v_shipping    integer;
  v_ref         text;
  v_order_id    uuid;
  v_customer_id uuid;
  v_line        integer;
begin
  if jsonb_array_length(coalesce(payload->'items', '[]'::jsonb)) = 0 then
    raise exception 'Order has no items';
  end if;

  -- Lock every requested row first so two shoppers cannot both take
  -- the last piece.
  for item in select * from jsonb_array_elements(payload->'items') loop
    select * into prod from public.aurelle_products
      where slug = item->>'slug' and active = true
      for update;

    if not found then
      raise exception 'Unknown product: %', item->>'slug';
    end if;

    v_qty := greatest(1, coalesce((item->>'qty')::integer, 1));

    if prod.stock < v_qty then
      raise exception '% is out of stock', prod.name;
    end if;

    v_subtotal := v_subtotal + (prod.price * v_qty);
  end loop;

  v_shipping := case when v_subtotal >= 999 then 0 else 79 end;
  v_ref := 'AUR' || lpad(floor(random() * 900000 + 100000)::text, 6, '0');

  -- Link to a customer record when the shopper is signed in.
  if payload->>'clerkUserId' is not null then
    select id into v_customer_id from public.aurelle_customers
      where clerk_user_id = payload->>'clerkUserId';
  end if;

  insert into public.aurelle_orders
    (ref, customer_id, clerk_user_id, first_name, last_name, email, phone,
     address, city, pincode, payment, subtotal, shipping, total)
  values
    (v_ref, v_customer_id, payload->>'clerkUserId',
     payload->>'firstName', payload->>'lastName', payload->>'email',
     payload->>'phone', payload->>'address', payload->>'city',
     payload->>'pincode', coalesce(payload->>'payment','UPI'),
     v_subtotal, v_shipping, v_subtotal + v_shipping)
  returning id into v_order_id;

  for item in select * from jsonb_array_elements(payload->'items') loop
    select * into prod from public.aurelle_products where slug = item->>'slug';
    v_qty  := greatest(1, coalesce((item->>'qty')::integer, 1));
    v_line := prod.price * v_qty;

    insert into public.aurelle_order_items
      (order_id, slug, name, finish, qty, unit_price, line_total)
    values
      (v_order_id, prod.slug, prod.name,
       coalesce(item->>'finish','Gold'), v_qty, prod.price, v_line);

    update public.aurelle_products
      set stock = stock - v_qty
      where slug = prod.slug;
  end loop;

  return jsonb_build_object(
    'ref', v_ref,
    'total', v_subtotal + v_shipping,
    'subtotal', v_subtotal,
    'shipping', v_shipping,
    'status', 'placed'
  );
end;
$$;

-- ============================================================
-- Dashboard statistics in one round trip.
-- ============================================================
create or replace function public.aurelle_stats()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'revenue', coalesce((select sum(total) from aurelle_orders where status <> 'cancelled'), 0),
    'orders',  (select count(*) from aurelle_orders),
    'pending', (select count(*) from aurelle_orders where status in ('placed','packed')),
    'unread',  (select count(*) from aurelle_messages where handled = false),
    'subscribers', (select count(*) from aurelle_subscribers),
    'products',    (select count(*) from aurelle_products where active),
    'customers',   (select count(*) from aurelle_customers),
    'aov', coalesce((
      select round(sum(total)::numeric / nullif(count(*), 0))
      from aurelle_orders where status <> 'cancelled'), 0),
    'lowStock', coalesce((
      select jsonb_agg(x) from (
        select slug, name, stock from aurelle_products
        where active and stock <= 10 order by stock limit 10) x), '[]'::jsonb),
    'byStatus', coalesce((
      select jsonb_agg(x) from (
        select status, count(*) as n from aurelle_orders group by status) x), '[]'::jsonb),
    'topProducts', coalesce((
      select jsonb_agg(x) from (
        select slug, name, sum(qty) as units, sum(line_total) as revenue
        from aurelle_order_items group by slug, name
        order by units desc limit 5) x), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(x order by x.day) from (
        select to_char(created_at, 'YYYY-MM-DD') as day,
               count(*) as orders, coalesce(sum(total), 0) as revenue
        from aurelle_orders
        where created_at > now() - interval '14 days'
        group by day) x), '[]'::jsonb)
  );
$$;

revoke all on function public.aurelle_create_order(jsonb) from anon, authenticated;
revoke all on function public.aurelle_stats() from anon, authenticated;
