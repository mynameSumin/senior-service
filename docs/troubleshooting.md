# 트러블슈팅 기록

## 1. longtermcare.or.kr — robots.txt 전체 차단

기획 당시 평가등급의 1차 소스로 가정했던 `longtermcare.or.kr`(노인장기요양보험)은
robots.txt가 모든 User-agent에 대해 `Disallow: /`로 설정되어 있다.

```
User-agent:*
Disallow:/
```

정부 사이트의 명시적 차단이라 우회하지 않고 존중했다. 대신:

- 같은 평가등급 데이터를 **공공데이터포털(data.go.kr)의 공식 재공개 채널**로 받았다 (아래 4번 참조).
- `longtermcare.or.kr` 시설 상세페이지는 자동 수집 없이 **외부 링크로만** 연결해
  과제의 "외부 링크 동작" 요건을 우회 없이 충족했다.

## 2. 심평원 요양병원 적정성평가(HIRA/khqa.kr) — robots.txt 차단으로 스킵

요양병원 적정성평가의 실제 게시 위치는 `hira.or.kr`이 아니라 `khqa.kr`(병원평가통합포털)이었다.
이 포털의 robots.txt 역시 `Disallow: /`(루트 페이지만 허용)로 차단되어 있어 스크래핑하지 않았다.

이로 인해 **요양병원의 평가등급 데이터는 이번 범위에서 제공하지 못한다.** UI에서는 요양병원 카드에
등급 대신 "등급 정보 추후 추가" 배지를 노출해 데이터 부재를 숨기지 않고 투명하게 표시했다.

## 3. 실버케어코리아(silvercarekorea.com) — "JS 렌더링" 추정이 틀렸다

기획서에는 "정적 fetch 시 본문 미추출 → JS 렌더링 추정 → Playwright 필요"로 적었으나,
실제로 막힌 원인은 JS 렌더링이 아니라 **`detail.php`/`list.php`가 Referer 헤더 부재 시
빈 페이지("No scrap")만 반환하는 단순 체크**였다.

Playwright로 렌더링을 시도해도 동일하게 빈 페이지가 나와 처음엔 "여전히 막혔다"고 오판했다.
실제로는 curl에 `Referer: https://www.silvercarekorea.com/silver/list.php?gubun=A` 헤더 하나만
추가하면 완전한 서버사이드 정적 HTML이 그대로 내려온다. 결과적으로 Playwright/Chromium 없이
axios + Referer 헤더만으로 충분했고, 크롤링 속도와 안정성 모두 더 좋아졌다.

또한 시설 상세페이지의 `schema.org LocalBusiness` JSON-LD에 후기 본문이 raw 줄바꿈 문자를
포함한 채 들어있어 `JSON.parse`가 그대로는 실패했다(`Bad control character in string literal`).
문자열 리터럴 내부의 줄바꿈만 골라 `\n`으로 이스케이프하는 소규모 sanitizer
(`crawlers/silvercarekorea/run.ts`의 `sanitizeJsonLd`)를 작성해 해결했다.

결과: 요양원/주야간보호/방문요양 3개 유형 × 15페이지(유형별 약 150건) = **450건 처리, 366개 고유 시설 적재**
(사이트의 "오늘의 추천" 등 동적 추천 박스가 페이지 경계에서 겹쳐 일부 uid가 중복 처리됨 — upsert 키가
`external_urls.silvercarekorea` URL이라 자동으로 dedup됨).

## 4. data.go.kr — "Open API 활용신청" 없이도 원본 파일을 받을 수 있었다

기획 당시엔 "공식 Open API 서비스키 활용신청 → 발급 대기"가 필요하다고 가정했다.
실제로 데이터셋 상세 페이지(`/data/{pk}/fileData.do`)의 다운로드 버튼은 활용신청과 무관하게
누구나 호출 가능한 2단계 공개 엔드포인트로 동작했다:

```
GET /tcs/dss/selectFileDataDownload.do?publicDataPk={pk}
  → { atchFileId, fileDetailSn, status: true } JSON

GET /cmm/cmm/fileDownload.do?atchFileId={id}&fileDetailSn={sn}&dataNm={name}
  → 실제 CSV/XLSX 바이너리
```

이 두 엔드포인트는 `fn_fileDataDownload` 함수(공공데이터포털 공통 JS `script_cmmFunction.js`)를
프론트엔드 네트워크 흐름 추적으로 역추적해 찾았다. 서비스키 발급 대기 없이 즉시 다음 두 데이터셋을
원본째로 받았다:

- `국민건강보험공단_장기요양기관 평가 결과` (publicDataPk=15104801) — \*\*2019~2024년 다년치 A~E 등급
  - 5개 영역별 점수\*\*가 그대로 들어있어, 등급 하락 추이 계산에 그대로 사용했다.
- `국민건강보험공단_장기요양기관 시설별 현황` (publicDataPk=15124763) — 시설 일반/입소/인력 현황.

파일은 CP949(EUC-KR) 인코딩 CSV이고, 시설명에 쉼표가 포함된 행이 있어 단순 `split(",")`이 아니라
`csv-parse`로 제대로 파싱해야 했다(`iconv-lite`로 cp949 → utf-8 디코딩 후 파싱).

평가 데이터에는 "인력" 단독 영역 점수가 없다(기관운영/환경및안전/수급자권리보장/급여제공과정/급여제공결과
5개 영역뿐). `lib/scoring.ts`의 인력 가산점 로직은 이 데이터만으로는 항상 0으로 계산된다 —
데이터의 한계이며 버그가 아니다.

facilities 테이블과의 매칭은 거짓청구 명단공표와 동일한 `bestFacilityMatch`(이름 70% + 주소 30% 가중
유사도) 함수를 재사용해 confidence ≥ 0.6인 행만 evaluations에 적재했다.

## 5. 거짓청구 명단공표(보건복지부) — 매칭 0건은 데이터의 한계

`mohw.go.kr/claimList.es?mid=a10507010200`(건강보험 거짓청구 요양기관 명단공표)는 정적 HTML 테이블로
실제 크롤링이 가능했고 44건이 정상 파싱됐다. 그러나 이 명단은 "건강보험" 거짓청구 기관
(의원/한의원/한방병원/약국 등) 명단이며, 표본 시점 데이터에는 우리 타겟인 요양원/요양병원이
한 건도 포함되지 않아 facilities와의 fuzzy 매칭이 0/44건으로 나왔다.

장기요양기관 전용 행정처분 명단은 별도 채널(`longtermcare.or.kr`)에 있을 가능성이 높지만 해당
사이트는 1번 사유로 robots.txt에 의해 접근하지 않았다. 매칭 0건은 크롤러 버그가 아니라
"요양원 전용 행정처분 공개 채널이 일반에 막혀 있다"는 시장 정보 비대칭 그 자체를 보여주는
결과로, 오히려 기획서 1.3절의 가설(부정 정보는 구조적으로 숨겨져 있다)을 뒷받침한다.

## 6. Next.js Turbopack — 한글 경로에서 패닉

로컬 개발 디렉터리 경로(`/Users/.../모두닥/senior-service`)에 한글이 포함되어 있는데,
Next.js 16의 기본 dev/build 엔진인 Turbopack이 `/results` 페이지(서버 컴포넌트 + RSC 액션 청크)를
빌드할 때 내부 식별자 문자열을 고정 바이트 오프셋(21바이트)에서 자르다가 멀티바이트 UTF-8 문자
(`ㅜ`)의 중간을 잘라 panic을 일으켰다:

```
panicked at turbopack-core/src/ident.rs:354:34:
start byte index 21 is not a char boundary; it is inside 'ᅮ' (bytes 19..22) of
`Documents_모두닥_senior-service__next-internal_server_app_results_page_actions_...`
```

`/`, `/match`처럼 라우트 경로 문자열이 짧은 페이지는 21바이트 경계를 넘지 않아 우연히 패닉을
피했고, 더 긴 식별자가 생성되는 `/results`에서만 재현됐다. 디렉터리명을 바꾸는 대신
`next dev --webpack` / `next build --webpack`으로 빌드 엔진을 webpack으로 전환해 회피했다
(`package.json`의 `dev`/`build` 스크립트에 반영).

## 요약: 계획 대비 실제 달라진 점

| 항목                 | 계획                        | 실제                                                                      |
| -------------------- | --------------------------- | ------------------------------------------------------------------------- |
| longtermcare.or.kr   | POST 폼 크롤링              | robots 차단 → 외부 링크만, 등급은 data.go.kr로 대체                       |
| 심평원/HIRA 요양병원 | fuzzy 매칭 크롤링           | robots 차단(khqa.kr) → 스킵, UI에 결측 표시                               |
| 실버케어코리아       | Playwright 필요 추정        | axios + Referer 헤더로 충분, JSON-LD sanitizer 필요                       |
| data.go.kr           | Open API 서비스키 신청 필요 | 신청 없이 공개 다운로드 엔드포인트로 즉시 확보                            |
| 거짓청구 명단공표    | 요양원 매칭 다수 기대       | 크롤링 성공, 매칭 0건(데이터 자체의 구조적 한계)                          |
| 개발 환경            | —                           | Turbopack이 한글 경로에서 panic → webpack으로 전환                        |
| 시설 상세정보        | Open API 활용신청 승인 대기 | 승인 즉시 키 발급(자동승인), 9개 오퍼레이션 전부 활용가이드 docx에서 확인 |

## 7. 시설별 상세조회 Open API — 클릭 시 실시간 호출

`/data/15058856/openapi.do`("국민건강보험공단*장기요양기관 시설별 상세조회 서비스")는 웹 UI의 스웨거 뷰어가
일부 오퍼레이션만 인라인으로 노출하고 나머지는 세션 종속 AJAX(`/tcs/dss/selectApiDetailFunction.do`)로
가려져 있어 막혔다. 페이지에 걸린 **공식 활용가이드 docx**(`(활용가이드)장기요양기관 시설정보*수정.docx`,
같은 `/cmm/cmm/fileDownload.do` 패턴으로 다운로드 가능)를 열어 9개 오퍼레이션의 정확한 엔드포인트·요청
파라미터·응답 필드를 전부 확인했다:

- `getGeneralSttusDetailInfoItem02` 일반현황, `getStaffSttusDetailInfoItem02` 인력현황,
  `getInsttSttusDetailInfoItem02` 시설현황, `getAceptncNmprDetailInfoItem02` 입소인원,
  `getProgramSttusDetailInfoList02` 프로그램현황, `getNonBenefitSttusDetailInfoList02` 비급여현황,
  `getConvInsttDetailInfoList02` 협약기관, `getWlfareToolDetailInfoList02` 복지용구,
  `getInsttEtcDetailInfoItem02` 기관기타 — 전부 `http://apis.data.go.kr/B550928/getLtcInsttDetailInfoService02/{operation}`

대부분 `longTermAdminSym`(장기요양기관기호) + `adminPttnCd`(기관유형코드)를 요구하는데, 우리 시설은
실버케어코리아발이라 이 공식 코드가 없다. "장기요양기관 시설별 현황" 파일(15124763)의 일반현황·입소인원
시트를 받아 이름+주소 fuzzy 매칭으로 366개 중 363개(99%)에 코드를 채웠다(`crawlers/data-go-kr/match-admin-sym.ts`).

이후 `/facility/[id]` 서버 컴포넌트가 매칭된 시설에 대해 인력현황·입소인원·프로그램현황 API를
**요청마다 실시간으로 호출**한다(`lib/dataGoKrDetail.ts`, `DATA_GO_KR_SERVICE_KEY`는 서버 전용 env로
클라이언트에 노출되지 않음). 첫 구현에서는 API 응답 객체를 통째로 순회해 인력 카드를 그렸다가
`longTermAdminSym` 같은 비-인력 필드까지 "14136000904명"으로 잘못 표시되는 버그가 났다 —
화이트리스트(`STAFF_LABELS`) 키만 순회하도록 고쳤다.

## 8. 같은 이름+주소로 기관코드가 여러 개 — 운영자 변경으로 추정, "더 채워진" 코드를 신뢰

실제 시설(엔젤실버요양원)을 클릭해 인력현황을 비교해보니 실버케어코리아/케어닥에 나오는 값과
우리 서비스 값이 달랐다. 원인은 같은 이름+주소로 `장기요양기관코드`가 두 개(14313000353,
14313000382) 등록돼 있었던 것 — 후기에 "대표가 변경되었다"는 언급이 있어, 운영자 변경으로 코드가
재발급된 것으로 추정된다. 새 코드는 아직 현황 신고가 안 됐는지 데이터가 거의 비어 있었고(직접
API로 호출해 공단 쪽 응답 자체가 비어있음을 확인 — 클라이언트 버그가 아니었음), 매칭 로직이
이름+주소만 보고 마지막에 본 코드로 덮어쓰면서 빈 코드가 선택돼 있었다.

이름+주소만으로는 어느 코드가 "현재 운영 중인" 코드인지 데이터만으로 100% 단정할 수 없어, 데이터가
더 채워진 코드를 우선하는 정책으로 정했다(인력현황 숫자 컬럼 총합 = "richness", 더 큰 쪽을 대표로
선택). `crawlers/data-go-kr/match-admin-sym.ts`에 적용했고, 이후 전국 시드(9번 항목)에도 동일하게
적용했다.

## 9. 전국 시드(517 → 25,262곳)에서 드러난 스케일 문제들

"전국"을 선택해도 실제로는 실버케어코리아가 등록해둔 500여 곳만 보이고 지역별 커버리지가 매우
얇았다(세종 2곳, 울산 12곳 등). data.go.kr "시설별 현황" 파일은 일반현황 시트에 전국 30,595행
전수와 기관코드가 이미 들어있어서(`crawlers/data-go-kr/seed-facilities.ts`), 기존 시설과
fuzzy 매칭되지 않는 나머지를 그대로 채워 25,262곳으로 늘렸다. 이 과정에서 실버케어코리아 데이터에는
없던 문제들이 한꺼번에 드러났다:

- **PostgREST 기본 1000행 컷**: `.range()` 없이 `select()`하면 1000행에서 조용히 잘린다.
  517곳일 땐 드러나지 않았던 버그라, 시드 이후 평가등급 매칭 풀과 `compute-risk-scores.ts`의
  대상 시설 목록이 전부 1000개로 잘려 있었다. `crawlers/shared/db.ts`에 `fetchAllRows()`
  페이지네이션 헬퍼를 추가해 모든 전체 조회 지점에 적용했다.
- **O(n×m) fuzzy 매칭 폭발**: 평가등급 CSV(약 8천 매칭 대상 행)를 25,250개 후보 전체와 매번
  전체 비교하면 약 2억 회 문자열 비교가 발생해 10분 넘게 멈춘 것처럼 보였다(`ps`로 CPU 사용률을
  보고 죽은 게 아니라 느린 것임을 확인). 이름을 정규화해 정확히 일치하는 후보만 먼저 추리는
  인덱스(`buildNameIndex`/`matchWithIndex`, `crawlers/shared/fuzzy.ts`)를 추가해 8.8초로 줄였다 —
  단, 철자가 살짝 다른 경우는 못 잡는 트레이드오프가 있다. 두 데이터 모두 같은 공단 등록정보
  기반이라 정확히 일치하는 경우가 대부분이고, 안전하게 건너뛰는 쪽(과매칭보다 미매칭)이 데이터
  정합성 면에서 낫다고 판단했다.
- **행 단위 순차 upsert**: `for` 루프 안에서 매 행마다 `await db.upsert(...)`를 부르면 네트워크
  왕복이 수천 번 쌓인다(평가등급 크롤러, 점수 재계산 스크립트). 배열에 모아서 500건씩 배치
  upsert하도록 바꿨다 — 점수 재계산도 N+1 쿼리(시설마다 evaluations/violations 따로 조회)를
  한 번에 전체 조회 후 메모리에서 그룹핑하는 방식으로 바꿨다.
- **이미 코드가 있는 시설을 재매칭해서 덮어쓸 뻔함**: `match-admin-sym.ts`가 풀 크기와 무관하게
  "facilities 전체"를 대상으로 fuzzy 매칭을 돌리고 있었는데, 풀이 25,250개로 커지자 동명 시설
  오매칭 위험이 커졌다 — 시드 단계에서 이미 원본 데이터로 직접 채운 코드를 다시 fuzzy 매칭으로
  덮어쓸 뻔했다. `.is("long_term_admin_sym", null)` 가드를 추가해 코드가 없는 시설만 대상으로
  하도록 고치고, 의심되는 시점까지의 시드 데이터를 전부 지우고(evaluations는 cascade로 같이
  삭제) 처음부터 다시 정확하게 채웠다.
