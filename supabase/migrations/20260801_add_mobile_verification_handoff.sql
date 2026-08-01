create table if not exists
  public.community_bull_verification_tokens (
    token_hash text primary key
      check (
        token_hash ~ '^[0-9a-f]{64}$'
      ),

    community_bull_id uuid not null
      references public.community_bulls(id)
      on delete cascade,

    created_at timestamptz not null
      default now(),

    expires_at timestamptz not null,

    used_at timestamptz,

    check (
      expires_at > created_at
    )
  );

create index if not exists
  community_bull_verification_tokens_bull_idx
on public.community_bull_verification_tokens (
  community_bull_id,
  created_at desc
);

create index if not exists
  community_bull_verification_tokens_expiry_idx
on public.community_bull_verification_tokens (
  expires_at
);

alter table
  public.community_bull_verification_tokens
enable row level security;

revoke all
on table public.community_bull_verification_tokens
from anon, authenticated;

grant select, insert, update, delete
on table public.community_bull_verification_tokens
to service_role;
