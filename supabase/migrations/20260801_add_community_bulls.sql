create extension if not exists pgcrypto;

create table if not exists public.community_bulls (
  id uuid primary key default gen_random_uuid(),
  country_code text not null
    check (country_code ~ '^[A-Z]{2}$'),
  browser_hash text not null,
  ip_day_hash text not null,
  status text not null default 'active'
    check (
      status in (
        'active',
        'pending',
        'verified',
        'removed'
      )
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz
);

create unique index if not exists
  community_bulls_one_per_browser
on public.community_bulls (browser_hash)
where status <> 'removed';

create index if not exists
  community_bulls_country_status_idx
on public.community_bulls (
  country_code,
  status
);

create index if not exists
  community_bulls_ip_day_idx
on public.community_bulls (
  ip_day_hash
);

create index if not exists
  community_bulls_created_at_idx
on public.community_bulls (
  created_at desc
);

alter table public.community_bulls
  enable row level security;

revoke all
on table public.community_bulls
from anon, authenticated;

grant select, insert, update, delete
on table public.community_bulls
to service_role;

create or replace view
  public.community_bull_counts
with (security_invoker = true)
as
select
  country_code,
  count(*)::bigint as community_bulls
from public.community_bulls
where status = 'active'
group by country_code;

revoke all
on table public.community_bull_counts
from anon, authenticated;

grant select
on table public.community_bull_counts
to service_role;

create or replace view
  public.map_country_counts
with (security_invoker = true)
as
with verified as (
  select
    country_code,
    claims::bigint as verified_bulls
  from public.country_claim_counts
),
community as (
  select
    country_code,
    community_bulls
  from public.community_bull_counts
)
select
  coalesce(
    verified.country_code,
    community.country_code
  ) as country_code,
  coalesce(
    community.community_bulls,
    0
  )::bigint as community_bulls,
  coalesce(
    verified.verified_bulls,
    0
  )::bigint as verified_bulls,
  (
    coalesce(
      community.community_bulls,
      0
    )
    +
    coalesce(
      verified.verified_bulls,
      0
    )
  )::bigint as total_bulls
from verified
full outer join community
  on community.country_code =
     verified.country_code;

revoke all
on table public.map_country_counts
from anon, authenticated;

grant select
on table public.map_country_counts
to service_role;
