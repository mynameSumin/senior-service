/**
 * facilities에 공식 "장기요양기관기호"(longTermAdminSym)와 기관유형코드(adminPttnCd)를 매칭해 채운다.
 * 이 두 값이 있어야 시설 상세조회 Open API(getLtcInsttDetailInfoService02)를 호출할 수 있다.
 *
 * 소스: data.go.kr 공개 다운로드 파일 "국민건강보험공단_장기요양기관 시설별 현황"(publicDataPk=15124763)
 * - 일반현황 시트: 장기요양기관코드, 장기요양기관이름, 주소
 * - 입소인원 시트: 장기요양기관코드, 기관유형코드 (adminPttnCd), 정원
 * - 인력현황 시트: 장기요양기관코드, 직종별 인원수
 *
 * 트러블슈팅: 같은 이름+주소로 기관코드가 여러 개 등록된 경우가 있다(운영자 변경 등으로 재지정된 것으로 추정).
 * 이름+주소만으로는 어느 코드가 "현재 데이터가 채워진" 코드인지 구분이 안 되므로,
 * 인력현황 합계(직원 수 총합)가 더 큰 코드를 우선한다 — 데이터가 빈 코드보다 채워진 코드를 신뢰.
 */
import XLSX from "xlsx";
import { db, startCrawlRun, finishCrawlRun, fetchAllRows } from "../shared/db";
import { bestFacilityMatch } from "../shared/fuzzy";
import { downloadFacilityStatusWorkbook, computeStaffRichnessByCode } from "./facilityStatusFile";

const SOURCE = "datagokr:admin_sym_match";

interface Candidate {
  code: string;
  pttnCd: string | null;
  richness: number;
}

async function run() {
  const runId = await startCrawlRun(SOURCE);
  let matched = 0;
  let skipped = 0;

  try {
    const wb = await downloadFacilityStatusWorkbook();

    const generalRows = XLSX.utils.sheet_to_json<{
      장기요양기관코드: string;
      장기요양기관이름: string;
      "시도 시군구 법정동명": string;
      "기관별 상세주소": string;
    }>(wb.Sheets["일반현황"]);

    const capacityRows = XLSX.utils.sheet_to_json<{
      장기요양기관코드: string;
      기관유형코드: string;
    }>(wb.Sheets["입소인원"]);

    const staffRows = XLSX.utils.sheet_to_json<Record<string, string | number>>(
      wb.Sheets["인력현황"]
    );

    const pttnByCode = new Map<string, string>();
    for (const row of capacityRows) {
      if (!pttnByCode.has(row.장기요양기관코드)) {
        pttnByCode.set(row.장기요양기관코드, row.기관유형코드);
      }
    }

    // 데이터가 더 "차있는" 코드를 우선하기 위한 인력 총합(직종 무관, 숫자 컬럼 전부 합산)
    const richnessByCode = computeStaffRichnessByCode(staffRows);

    console.log(
      `[${SOURCE}] 일반현황 ${generalRows.length}행, 입소인원 ${capacityRows.length}행, 인력현황 ${staffRows.length}행`
    );

    // seed-facilities.ts가 이미 원본 데이터에서 직접 코드를 채운 시설은 다시 fuzzy
    // 매칭하지 않는다 — 후보 풀이 커질수록 동명 시설 간 오매칭 위험이 커지기 때문.
    const facilityPool = await fetchAllRows<{ id: string; name: string; address: string | null }>(
      (from, to) =>
        db
          .from("facilities")
          .select("id, name, address")
          .is("long_term_admin_sym", null)
          .order("id").range(from, to)
    );

    const bestForFacility = new Map<string, Candidate>();

    for (const row of generalRows) {
      const name = row.장기요양기관이름?.trim();
      if (!name) continue;
      const address = row["기관별 상세주소"] || row["시도 시군구 법정동명"];

      const match = bestFacilityMatch(name, address, facilityPool);
      if (!match || match.confidence < 0.6) {
        skipped++;
        continue;
      }

      const code = row.장기요양기관코드;
      const candidate: Candidate = {
        code,
        pttnCd: pttnByCode.get(code) ?? null,
        richness: richnessByCode.get(code) ?? 0,
      };

      const existing = bestForFacility.get(match.id);
      if (!existing || candidate.richness > existing.richness) {
        bestForFacility.set(match.id, candidate);
      }
    }

    for (const [facilityId, candidate] of bestForFacility) {
      const { error } = await db
        .from("facilities")
        .update({
          long_term_admin_sym: candidate.code,
          admin_pttn_cd: candidate.pttnCd,
        })
        .eq("id", facilityId);
      if (error) throw error;
      matched++;
    }

    console.log(`[${SOURCE}] 매칭: ${matched}건, 스킵: ${skipped}건`);
    await finishCrawlRun(runId, matched > 0 ? "success" : "partial", matched);
  } catch (err) {
    console.error(`[${SOURCE}] 실패:`, err);
    await finishCrawlRun(runId, "failed", matched, String(err));
    throw err;
  }
}

run();
