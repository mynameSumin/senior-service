# 케어가드

요양시설 리스크 투명성 서비스입니다. 기획 배경과 문제 정의는 `docs/`(또는 과제 제출 문서)를
참고해 주세요. 구현 중 겪은 이슈와 우회 방법은 [`docs/troubleshooting.md`](docs/troubleshooting.md)에
정리해 두었습니다.

## 목차

- [스택](#스택)
- [로컬 실행](#로컬-실행)
- [DB 스키마 적용](#db-스키마-적용)
- [크롤러 실행 순서](#크롤러-실행-순서)
- [크롤러 자동화 (GitHub Actions)](#크롤러-자동화-github-actions)
- [데이터 소스 요약](#데이터-소스-요약)

## 스택

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Postgres)
- 크롤러: `tsx` + axios/cheerio/csv-parse, Supabase service role key로 직접 적재

## 로컬 실행

```bash
npm install
cp .env.local.example .env.local   # Supabase URL/키를 채워주세요
npm run dev                         # http://localhost:3000
```

## DB 스키마 적용

`supabase/migrations/0001_init.sql`을 Supabase 대시보드의 SQL Editor에서 실행해 주세요.

> DB 비밀번호 없이 API 키만 있는 환경에서는 CLI로 직접 push할 수 없어, 수동 실행이 가장
> 빠른 방법입니다.

## 크롤러 실행 순서

아래 순서대로 실행하면 됩니다.

```bash
npm run crawl:silvercarekorea   # 1. 시설 기본정보 + 후기 (요양원/주야간보호/방문요양 표본)
npm run crawl:seedfacilities    # 2. data.go.kr 전국 전수(약 2.5만 곳)로 facilities 커버리지 확장
npm run crawl:caredoc           # 3. 케어닥에 같은 시설의 실제 페이지가 있으면 외부 링크 교체
npm run crawl:datagokr          # 4. 평가등급(A~E) 시계열 — facilities에 이름 매칭
npm run crawl:adminsym          # 5. 공식 기관코드(longTermAdminSym) 매칭 — 상세페이지 실시간 조회용
npm run crawl:hira              # 6. 요양병원 평가등급(심평원 "좋은병원찾기") — 요양병원만 신규 적재
npm run crawl:violations        # 7. 거짓청구 명단공표 (참고용, 매칭 0건일 수 있음)
npm run score:compute           # 8. 리스크 스코어 재계산 (1~7이 끝난 뒤 항상 마지막에 실행)
```

**왜 이 순서인가요?**

- `crawl:seedfacilities`는 실버케어코리아(민간 후기 사이트라 전수가 아님, 약 500여 곳)만으로는
  "전국"을 선택해도 지역별 커버리지가 매우 얇았던 문제를, data.go.kr의 전국 전수 파일로
  메우는 단계입니다. 이미 있는 시설과는 fuzzy 매칭으로 중복 생성하지 않고, 같은 이름+주소로
  기관코드가 여러 개 등록된 경우 인력현황이 더 채워진 코드를 대표로 골라
  `long_term_admin_sym`/`admin_pttn_cd`까지 함께 채웁니다(자세한 내용은
  `crawlers/data-go-kr/seed-facilities.ts` 상단 주석과 `docs/troubleshooting.md`를
  참고해 주세요).
- `crawl:caredoc`은 위 단계에서 일단 data.go.kr 데이터셋 페이지로만 채워둔 외부 링크를,
  실제로 케어닥에 그 시설의 상세페이지가 존재하는 경우 그쪽으로 교체합니다. 케어닥이 전국
  시설을 다 갖고 있지는 않아 시설마다 존재 여부를 확인해야 하는데, 한 번 링크가 교체된
  시설은 이후 실행에서 자동으로 제외되므로 두 번째 실행부터는 매우 빠르게 끝납니다.

각 크롤러는 `crawl_runs` 테이블에 실행 로그(성공/부분/실패, 건수, 에러)를 남깁니다.

## 크롤러 자동화 (GitHub Actions)

`.github/workflows/crawl.yml`이 매일 23:30(KST)에 위 순서대로 전부 실행합니다. 수동으로
실행하고 싶다면 Actions 탭 → 크롤러 자동 실행 → Run workflow를 눌러주세요.

> Vercel 서버리스 함수는 실행시간 제한이 짧아 이 크롤러들(대용량 파일 다운로드, 수만 행
> 매칭)에는 맞지 않습니다. 그래서 잡당 최대 6시간까지 돌 수 있는 GitHub Actions를 사용했습니다.

자동화가 동작하려면 리포지토리 Settings → Secrets and variables → Actions에 아래 3개를
등록해 주세요.

| 시크릿 이름 | 용도 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 크롤러가 DB에 직접 적재할 때 사용 |
| `DATA_GO_KR_SERVICE_KEY` | 공공데이터포털 Open API 호출용 |

시설 상세페이지(`/facility/[id]`)는 `long_term_admin_sym`이 매칭된 시설에 대해 **클릭
시점에 공공데이터포털 Open API를 실시간으로 호출**해 인력 구성·입소 현황·운영 프로그램을
보여줍니다(`lib/dataGoKrDetail.ts`). 요양병원은 같은 키로 별도 제공기관(B551182,
비급여진료비정보조회서비스)의 비급여 비용을 ykiho로 실시간 조회합니다(`lib/hiraNonPayment.ts`).

> data.go.kr Open API는 제공기관별로 따로 활용신청을 해야 합니다. 따라서
> `DATA_GO_KR_SERVICE_KEY` 하나로 두 기능을 모두 쓰려면, 두 제공기관 모두에 대한 승인을
> 받아야 합니다.

## 데이터 소스 요약

| 소스 | 무엇을 가져오나요 | 방식 |
| --- | --- | --- |
| 실버케어코리아 | 시설 기본정보, 이용자 후기 | axios + Referer 헤더, JSON-LD 파싱 |
| data.go.kr (시설별 현황) | 전국 시설 전수, 기관코드 | 공개 파일 다운로드 엔드포인트 |
| data.go.kr (평가 결과) | 장기요양기관 평가등급(2019~2024) | 공개 파일 다운로드 엔드포인트(서비스키 불필요) |
| 케어닥(caredoc.kr) | 시설별 실제 상세페이지 링크 | URL 패턴 구성 후 존재 여부 확인 |
| 보건복지부(mohw.go.kr) | 거짓청구 명단공표 | 정적 HTML 테이블 |
| hira.or.kr("좋은병원찾기") | 요양병원 평가등급(1~5등급) | 내부 AJAX 엔드포인트 직접 호출(서비스키 불필요) |
| 심평원 비급여진료비정보조회서비스 | 요양병원 비급여 비용(항목·가격) | Open API(별도 서비스키, ykiho로 실시간 조회) |
| longtermcare.or.kr | (스크래핑하지 않음) | robots.txt 전체 차단 → 외부 링크만 사용 |
| khqa.kr(심평원 통합 평가포털) | (스크래핑하지 않음) | robots.txt 전체 차단 → hira.or.kr로 대체 |

각 결정의 이유는 [`docs/troubleshooting.md`](docs/troubleshooting.md)에 자세히 기록해
두었습니다.
