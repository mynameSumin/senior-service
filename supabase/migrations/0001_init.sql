-- 케어가드 초기 스키마

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

create table if not exists facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('요양원', '요양병원', '주야간보호', '방문요양')),
  address text,
  region_sido text,
  region_sigungu text,
  lat double precision,
  lng double precision,
  phone text,
  capacity_total int,
  capacity_current int,
  external_urls jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_facilities_region on facilities (region_sido, region_sigungu);
create index if not exists idx_facilities_type on facilities (type);
create index if not exists idx_facilities_name on facilities using gin (name gin_trgm_ops);

create table if not exists evaluations (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references facilities(id) on delete cascade,
  source text not null check (source in ('건보공단', '심평원')),
  eval_year int not null,
  grade text not null,
  domain_scores jsonb not null default '{}',
  raw jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (facility_id, source, eval_year)
);

create table if not exists violations (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references facilities(id) on delete set null,
  org_name_raw text not null,
  address_raw text,
  violation_type text,
  violation_date date,
  penalty text,
  source_url text,
  match_confidence numeric,
  created_at timestamptz not null default now()
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references facilities(id) on delete cascade,
  source text not null,
  author_label text,
  rating numeric,
  content text,
  review_date date,
  source_url text,
  created_at timestamptz not null default now()
);

create table if not exists risk_scores (
  facility_id uuid primary key references facilities(id) on delete cascade,
  score numeric not null check (score >= 0 and score <= 100),
  components jsonb not null default '{}',
  explanation text[] not null default '{}',
  computed_at timestamptz not null default now()
);

create table if not exists crawl_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'success', 'partial', 'failed')),
  records_count int default 0,
  error_log text
);

-- 읽기는 공개, 쓰기는 service_role만 (크롤러는 service_role key 사용)
alter table facilities enable row level security;
alter table evaluations enable row level security;
alter table violations enable row level security;
alter table reviews enable row level security;
alter table risk_scores enable row level security;
alter table crawl_runs enable row level security;

create policy "public read facilities" on facilities for select using (true);
create policy "public read evaluations" on evaluations for select using (true);
create policy "public read violations" on violations for select using (true);
create policy "public read reviews" on reviews for select using (true);
create policy "public read risk_scores" on risk_scores for select using (true);
