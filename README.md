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
npm run crawl:seedfacilities    # 2. data.go.kr 전국 전수(약 2.5만곳)로 facilities 커버리지 확장
npm run crawl:datagokr          # 3. 평가등급(A~E) 시계열 — facilities에 이름 매칭
npm run crawl:adminsym          # 4. 공식 기관코드(longTermAdminSym) 매칭 — 상세페이지 실시간 조회용
npm run crawl:violations        # 5. 거짓청구 명단공표 (참고용, 매칭 0건일 수 있음)
npm run score:compute           # 6. 리스크 스코어 재계산 (1~5 끝난 뒤 항상 마지막에)
```

`crawl:seedfacilities`는 실버케어코리아(민간 후기 사이트라 전수가 아님, 약 500여곳)만으로는
"전국"을 선택해도 지역별 커버리지가 매우 얇았던 문제를 data.go.kr의 전국 전수 파일로 메운다.
이미 있는 시설과는 fuzzy 매칭으로 중복 생성하지 않고, 같은 이름+주소로 기관코드가 여러 개
등록된 경우 인력현황이 더 채워진 코드를 대표로 골라 `long_term_admin_sym`/`admin_pttn_cd`까지
바로 채운다(자세한 내용은 `crawlers/data-go-kr/seed-facilities.ts` 상단 주석과
`docs/troubleshooting.md` 참고).

각 크롤러는 `crawl_runs` 테이블에 실행 로그(성공/부분/실패, 건수, 에러)를 남긴다.

## 크롤러 자동화 (GitHub Actions)

`.github/workflows/crawl.yml`이 매일 23:30(KST)에 위 순서대로 전부 실행한다(수동 실행은
Actions 탭 → 크롤러 자동 실행 → Run workflow). Vercel 서버리스 함수는 실행시간 제한이
짧아 이 크롤러들(대용량 파일 다운로드, 수만 행 매칭)에 맞지 않아 GitHub Actions를 썼다.

리포지토리 Settings → Secrets and variables → Actions에 아래 3개를 등록해야 동작한다:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATA_GO_KR_SERVICE_KEY`

시설 상세페이지(`/facility/[id]`)는 `long_term_admin_sym`이 매칭된 시설에 대해
**클릭 시점에 공공데이터포털 Open API를 실시간으로 호출**해 인력 구성·입소 현황·운영 프로그램을 보여준다
(`lib/dataGoKrDetail.ts`). `.env.local`의 `DATA_GO_KR_SERVICE_KEY`가 필요하다.

## 데이터 소스 요약

| 소스                          | 무엇을 가져오나                  | 방식                                            |
| ----------------------------- | -------------------------------- | ----------------------------------------------- |
| 실버케어코리아                | 시설 기본정보, 이용자 후기       | axios + Referer 헤더, JSON-LD 파싱              |
| data.go.kr (시설별 현황)      | 전국 시설 전수, 기관코드, 비급여비용 | 공개 파일 다운로드 엔드포인트 + 상세조회 Open API |
| data.go.kr (평가 결과)        | 장기요양기관 평가등급(2019~2024) | 공개 파일 다운로드 엔드포인트 (서비스키 불필요) |
| 보건복지부(mohw.go.kr)        | 거짓청구 명단공표                | 정적 HTML 테이블                                |
| longtermcare.or.kr            | (스크래핑 안 함)                 | robots.txt 전체 차단 → 외부 링크만              |
| khqa.kr(심평원 요양병원 평가) | (스크래핑 안 함)                 | robots.txt 전체 차단 → 스킵                     |

각 결정의 이유는 `docs/troubleshooting.md`에 기록.
