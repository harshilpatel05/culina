create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  invoice_number text not null unique,
  issued_at timestamptz not null default now(),
  due_at timestamptz,
  subtotal numeric(12, 2) not null default 0,
  tax_percent numeric(6, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  service_charge_percent numeric(6, 2) not null default 0,
  service_charge_amount numeric(12, 2) not null default 0,
  discount_percent numeric(6, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  grand_total numeric(12, 2) not null default 0,
  notes text,
  created_by_staff_id uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_restaurant_id_idx on public.invoices (restaurant_id);
create index if not exists invoices_order_id_idx on public.invoices (order_id);
create index if not exists invoices_issued_at_idx on public.invoices (issued_at desc);
