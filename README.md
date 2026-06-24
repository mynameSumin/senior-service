# 케어가드

요양시설 리스크 투명성 서비스. 기획 배경과 문제 정의는 `docs/`(또는 과제 제출 문서)를 참고.
구현 중 겪은 이슈와 우회 방법은 [`docs/troubleshooting.md`](docs/troubleshooting.md)에 정리했다.

## 스택

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Postgres)
- 크롤러: `tsx` + axios/cheerio/csv-parse, Supabase service role key로 직접 적재

## 로컬 실행

```bash
npm install
cp .env.local.example .env.local   # Supabase URL/키 채우기
npm run dev                         # http://localhost:3000
```

## DB 스키마 적용

`supabase/migrations/0001_init.sql`을 Supabase 대시보드 SQL Editor에서 실행한다.
(DB 비밀번호 없이 API 키만 있는 환경에서는 CLI로 직접 push할 수 없어 수동 실행이 가장 빠르다.)

## 크롤러 실행 순서

```bash
npm run crawl:silvercarekorea   # 1. 시설 기본정보 + 후기 (요양원/주야간보호/방문요양 표본)
npm run crawl:datagokr          # 2. 평가등급(A~E) 시계열 — facilities에 fuzzy 매칭
npm run crawl:adminsym          # 3. 공식 기관코드(longTermAdminSym) 매칭 — 상세페이지 실시간 조회용
npm run crawl:violations        # 4. 거짓청구 명단공표 (참고용, 매칭 0건일 수 있음)
npm run score:compute           # 5. 리스크 스코어 재계산 (1~4 끝난 뒤 항상 마지막에)
```

각 크롤러는 `crawl_runs` 테이블에 실행 로그(성공/부분/실패, 건수, 에러)를 남긴다.

시설 상세페이지(`/facility/[id]`)는 `long_term_admin_sym`이 매칭된 시설에 대해
**클릭 시점에 공공데이터포털 Open API를 실시간으로 호출**해 인력 구성·입소 현황·운영 프로그램을 보여준다
(`lib/dataGoKrDetail.ts`). `.env.local`의 `DATA_GO_KR_SERVICE_KEY`가 필요하다.

## 데이터 소스 요약

| 소스                          | 무엇을 가져오나                  | 방식                                            |
| ----------------------------- | -------------------------------- | ----------------------------------------------- |
| 실버케어코리아                | 시설 기본정보, 이용자 후기       | axios + Referer 헤더, JSON-LD 파싱              |
| data.go.kr                    | 장기요양기관 평가등급(2019~2024) | 공개 파일 다운로드 엔드포인트 (서비스키 불필요) |
| 보건복지부(mohw.go.kr)        | 거짓청구 명단공표                | 정적 HTML 테이블                                |
| longtermcare.or.kr            | (스크래핑 안 함)                 | robots.txt 전체 차단 → 외부 링크만              |
| khqa.kr(심평원 요양병원 평가) | (스크래핑 안 함)                 | robots.txt 전체 차단 → 스킵                     |

각 결정의 이유는 `docs/troubleshooting.md`에 기록.
