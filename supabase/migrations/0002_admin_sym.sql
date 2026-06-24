-- 공공데이터포털 "장기요양기관 시설별 상세조회 서비스" 실시간 호출에 필요한 공식 기관코드
alter table facilities add column if not exists long_term_admin_sym text;
alter table facilities add column if not exists admin_pttn_cd text;

create index if not exists idx_facilities_admin_sym on facilities (long_term_admin_sym);
