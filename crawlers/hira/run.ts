/**
 * 요양병원 평가등급 크롤러 (건강보험심사평가원)
 *
 * 소스: hira.or.kr "병원·약국찾기 > 우리지역 좋은병원 찾기" 페이지가 쓰는 내부 AJAX
 *   POST https://www.hira.or.kr/ra/hosp/selectHospSrchPlcHospListAjax.do
 *   (evlCd=14, goodshwSbjtCd=요양병원, pageIndex, pageUnit — 서버가 페이지당 20건으로 고정)
 *
 * robots.txt: hira.or.kr은 /co/ 경로만 Disallow, /ra/hosp/* 는 차단 대상이 아니다 → 크롤링 허용.
 * (별도 사이트인 khqa.kr "병원평가통합포털"은 robots.txt가 거의 전체 차단이라 이번에도 안 씀.)
 *
 * 트러블슈팅: 처음엔 khqa.kr이 막혀서 요양병원 데이터를 통째로 포기했었다. 그런데
 * hira.or.kr 메인 사이트 자체의 "좋은병원 찾기" 기능이 같은 평가 데이터를 보여주고
 * 있었고, 이건 robots.txt에 안 걸린다 — JS 파일(HospitalMap.js)에서 AJAX 엔드포인트와
 * 코드 체계(평가항목 코드조회 selectYadmSrchCodeListAjax.do → hiSno=4001에서
 * "요양병원"의 commCd="E5"/sno=4500, 그 세부항목에서 evlCd="14" 확인)를 역공학해서 찾았다.
 * API 키도 필요 없다. 단, 응답에 평가연도가 없어(최신 등급만 제공) eval_year은
 * 크롤링 시점의 연도로 기록한다 — 등급 하락 추이 컴포넌트는 이 소스만으로는 계산되지 않는다.
 */
import axios from "axios";
import { UA, rateLimited } from "../shared/http";
import { db, startCrawlRun, finishCrawlRun, fetchAllRows } from "../shared/db";
import { bestFacilityMatch } from "../shared/fuzzy";

const SOURCE = "hira:good_hospital_nursing";
const SEARCH_URL = "https://www.hira.or.kr/ra/hosp/selectHospSrchPlcHospListAjax.do";
const PAGE_SIZE = 20;

const SIDO_SHORT_TO_FULL: Record<string, string> = {
  서울: "서울특별시",
  부산: "부산광역시",
  대구: "대구광역시",
  인천: "인천광역시",
  광주: "광주광역시",
  대전: "대전광역시",
  울산: "울산광역시",
  세종: "세종특별자치시",
  경기: "경기도",
  강원: "강원특별자치도",
  충북: "충청북도",
  충남: "충청남도",
  전북: "전북특별자치도",
  전남: "전라남도",
  경북: "경상북도",
  경남: "경상남도",
  제주: "제주특별자치도",
};

// HIRA 1~5등급(1이 최우수) → 우리 서비스의 A~E 스케일(A가 최우수)
const GRADE_1_5_TO_AE: Record<string, string> = { "1": "A", "2": "B", "3": "C", "4": "D", "5": "E" };

interface HospRow {
  ykiho: string;
  yadmNm: string;
  addr: string;
  sidoCdNm: string;
  yadmGdTelnoTxt: string | null;
  asmGrd1: string;
  asmGrd2: string;
  cntnExctYrCnt: number;
}

async function fetchPage(pageIndex: number): Promise<{ rows: HospRow[]; totalPageCount: number }> {
  const res = await axios.post(
    SEARCH_URL,
    new URLSearchParams({ evlCd: "14", goodshwSbjtCd: "요양병원", pageIndex: String(pageIndex) }),
    {
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
      },
      timeout: 15000,
    }
  );
  const data = res.data?.data;
  return {
    rows: data?.hospList ?? [],
    totalPageCount: data?.paginationInfo?.totalPageCount ?? 1,
  };
}

async function run() {
  const runId = await startCrawlRun(SOURCE);
  let insertedFacilities = 0;
  let upsertedEvaluations = 0;

  try {
    const wait = rateLimited(400);
    const allRows: HospRow[] = [];

    await wait();
    const first = await fetchPage(1);
    allRows.push(...first.rows);
    console.log(`[${SOURCE}] 총 ${first.totalPageCount}페이지 (페이지당 ${PAGE_SIZE}건)`);

    for (let p = 2; p <= first.totalPageCount; p++) {
      await wait();
      const { rows } = await fetchPage(p);
      allRows.push(...rows);
    }
    console.log(`[${SOURCE}] 요양병원 ${allRows.length}건 수집`);

    // 요양병원은 요양원/주야간보호/방문요양과 다른 기관 종류라 같은 시설일 수 없다.
    // 재실행 시 중복 생성만 막기 위해, 매칭 대상 풀을 기존 type="요양병원" 시설로만 제한한다.
    const existingPool = await fetchAllRows<{ id: string; name: string; address: string | null }>(
      (from, to) =>
        db.from("facilities").select("id, name, address").eq("type", "요양병원").order("id").range(from, to)
    );

    const evalYear = new Date().getFullYear();
    const evaluationsByKey = new Map<string, Record<string, unknown>>();

    for (const row of allRows) {
      const name = row.yadmNm?.trim();
      const address = row.addr?.trim();
      if (!name || !address) continue;

      let facilityId: string;
      const match = bestFacilityMatch(name, address, existingPool);
      if (match && match.confidence >= 0.6) {
        facilityId = match.id;
      } else {
        const { data: inserted, error } = await db
          .from("facilities")
          .insert({
            name,
            type: "요양병원",
            address,
            region_sido: SIDO_SHORT_TO_FULL[row.sidoCdNm] ?? row.sidoCdNm ?? null,
            phone: row.yadmGdTelnoTxt || null,
            external_urls: { hira: `https://www.hira.or.kr/ra/hosp/hospInfoAjax.do?ykiho=${row.ykiho}` },
          })
          .select("id")
          .single();
        if (error) throw error;
        facilityId = inserted.id as string;
        existingPool.push({ id: facilityId, name, address });
        insertedFacilities++;
      }

      const grade = GRADE_1_5_TO_AE[row.asmGrd1];
      if (!grade) continue; // 평가 미실시(등급 없음)는 건너뜀

      evaluationsByKey.set(`${facilityId}|심평원|${evalYear}`, {
        facility_id: facilityId,
        source: "심평원",
        eval_year: evalYear,
        grade,
        domain_scores: {},
        raw: { asmGrd1: row.asmGrd1, asmGrd2: row.asmGrd2, cntnExctYrCnt: row.cntnExctYrCnt, ykiho: row.ykiho },
      });
    }

    const evalRows = [...evaluationsByKey.values()];
    const CHUNK = 500;
    for (let i = 0; i < evalRows.length; i += CHUNK) {
      const chunk = evalRows.slice(i, i + CHUNK);
      const { error } = await db
        .from("evaluations")
        .upsert(chunk, { onConflict: "facility_id,source,eval_year" });
      if (error) throw error;
      upsertedEvaluations += chunk.length;
    }

    console.log(
      `[${SOURCE}] 신규 시설: ${insertedFacilities}곳, 평가등급 적재: ${upsertedEvaluations}건`
    );
    await finishCrawlRun(runId, "success", insertedFacilities + upsertedEvaluations);
  } catch (err) {
    console.error(`[${SOURCE}] 실패:`, err);
    await finishCrawlRun(runId, "failed", insertedFacilities, String(err));
    throw err;
  }
}

run();
