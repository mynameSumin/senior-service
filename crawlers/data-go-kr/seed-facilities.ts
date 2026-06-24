/**
 * facilities 테이블을 실버케어코리아(517곳, 민간 후기 사이트라 전수가 아님)에서
 * data.go.kr "장기요양기관 시설별 현황" 전국 전수(일반현황 30,595행)로 넓힌다.
 *
 * 트러블슈팅: "전국"으로 검색해도 실제로는 실버케어코리아가 등록해둔 시설만 보여서,
 * 지역별 커버리지가 매우 얇았다(예: 세종 2곳, 울산 12곳). data.go.kr 파일에 이미
 * 전국 전수 + 기관코드(long_term_admin_sym)까지 있으므로 이걸로 빈틈을 채운다.
 *
 * - 같은 이름+주소로 기관코드가 여러 개 등록된 경우 인력현황이 더 채워진 코드를 대표로 선택
 *   (match-admin-sym.ts와 동일한 근거: 운영자 변경 등으로 재지정된 것으로 추정).
 * - 기존 facilities(주로 실버케어코리아 출처)와 fuzzy 매칭되면 중복 생성하지 않고 건너뛴다.
 * - 우리 서비스가 다루지 않는 유형(방문목욕/방문간호/단기보호/복지용구만 있는 기관)은 제외.
 */
import { db, startCrawlRun, finishCrawlRun, fetchAllRows } from "../shared/db";
import { bestFacilityMatch } from "../shared/fuzzy";
import {
  downloadFacilityStatusWorkbook,
  computeStaffRichnessByCode,
  resolveFacilityType,
  categorizeFacilityTypeName,
} from "./facilityStatusFile";
import XLSX from "xlsx";

const SOURCE = "datagokr:seed_facilities";
const INSERT_CHUNK_SIZE = 500;

interface GeneralRow {
  장기요양기관코드: string;
  장기요양기관이름: string;
  "시도 시군구 법정동명": string;
  "기관별 상세주소": string;
}

interface CapacityRow {
  장기요양기관코드: string;
  기관유형코드: string;
  기관유형명: string;
  정원: number | string;
}

interface Candidate {
  code: string;
  name: string;
  address: string;
  regionSido: string | null;
  type: string;
  adminPttnCd: string | null;
  capacityTotal: number | null;
  richness: number;
}

const normKey = (s: string) => s.replace(/[()\s]/g, "");

async function run() {
  const runId = await startCrawlRun(SOURCE);
  let inserted = 0;
  let skippedExisting = 0;
  let skippedType = 0;

  try {
    const wb = await downloadFacilityStatusWorkbook();

    const generalRows = XLSX.utils.sheet_to_json<GeneralRow>(wb.Sheets["일반현황"]);
    const capacityRows = XLSX.utils.sheet_to_json<CapacityRow>(wb.Sheets["입소인원"]);
    const staffRows = XLSX.utils.sheet_to_json<Record<string, string | number>>(
      wb.Sheets["인력현황"]
    );
    console.log(
      `[${SOURCE}] 일반현황 ${generalRows.length}행, 입소인원 ${capacityRows.length}행, 인력현황 ${staffRows.length}행`
    );

    const richnessByCode = computeStaffRichnessByCode(staffRows);

    const typeNamesByCode = new Map<string, Set<string>>();
    const capacityByCode = new Map<string, number>();
    // 우리가 고른 type(요양원/주야간보호/방문요양)에 맞는 기관유형코드(adminPttnCd)를
    // 같이 들고 있어야 상세조회 Open API(adminPttnCd 필수)를 호출할 수 있다.
    const pttnCdByCodeAndCategory = new Map<string, Map<string, string>>();
    for (const row of capacityRows) {
      const code = row.장기요양기관코드;
      if (!typeNamesByCode.has(code)) typeNamesByCode.set(code, new Set());
      typeNamesByCode.get(code)!.add(row.기관유형명);

      const cap = Number(row.정원);
      if (!isNaN(cap) && cap > 0 && /노인요양시설|노인전문요양시설|노인요양공동생활가정/.test(row.기관유형명)) {
        capacityByCode.set(code, cap);
      }

      const category = categorizeFacilityTypeName(row.기관유형명);
      if (category) {
        if (!pttnCdByCodeAndCategory.has(code)) pttnCdByCodeAndCategory.set(code, new Map());
        const byCategory = pttnCdByCodeAndCategory.get(code)!;
        if (!byCategory.has(category)) byCategory.set(category, row.기관유형코드);
      }
    }

    // 코드별 후보를 만들고, 같은 이름+주소(중복 등록)는 인력현황이 더 채워진 코드로 합친다.
    const bestByKey = new Map<string, Candidate>();
    for (const row of generalRows) {
      const code = row.장기요양기관코드;
      const name = row.장기요양기관이름?.trim();
      const address = (row["기관별 상세주소"] || row["시도 시군구 법정동명"])?.trim();
      if (!code || !name || !address) continue;

      const typeNames = typeNamesByCode.get(code);
      const type = typeNames ? resolveFacilityType(typeNames) : null;
      if (!type) {
        skippedType++;
        continue;
      }

      const candidate: Candidate = {
        code,
        name,
        address,
        regionSido: row["시도 시군구 법정동명"]?.split(" ")[0] ?? null,
        type,
        adminPttnCd: pttnCdByCodeAndCategory.get(code)?.get(type) ?? null,
        capacityTotal: capacityByCode.get(code) ?? null,
        richness: richnessByCode.get(code) ?? 0,
      };

      const key = `${normKey(name)}|${normKey(address)}`;
      const existing = bestByKey.get(key);
      if (!existing || candidate.richness > existing.richness) {
        bestByKey.set(key, candidate);
      }
    }

    console.log(`[${SOURCE}] 타겟 유형(요양원/주야간보호/방문요양) 중복제거 후 ${bestByKey.size}곳`);

    const existingPool = await fetchAllRows<{ id: string; name: string; address: string | null }>(
      (from, to) => db.from("facilities").select("id, name, address").range(from, to)
    );

    const toInsert: Record<string, unknown>[] = [];
    for (const candidate of bestByKey.values()) {
      const match = bestFacilityMatch(candidate.name, candidate.address, existingPool);
      if (match && match.confidence >= 0.6) {
        skippedExisting++;
        continue;
      }

      toInsert.push({
        name: candidate.name,
        type: candidate.type,
        address: candidate.address,
        region_sido: candidate.regionSido,
        capacity_total: candidate.capacityTotal,
        long_term_admin_sym: candidate.code,
        admin_pttn_cd: candidate.adminPttnCd,
        external_urls: {},
      });
    }

    console.log(
      `[${SOURCE}] 기존 시설과 중복(건너뜀): ${skippedExisting}곳, 타겟 외 유형(건너뜀): ${skippedType}건, 신규 삽입 대상: ${toInsert.length}곳`
    );

    for (let i = 0; i < toInsert.length; i += INSERT_CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + INSERT_CHUNK_SIZE);
      const { error } = await db.from("facilities").insert(chunk);
      if (error) throw error;
      inserted += chunk.length;
      console.log(`[${SOURCE}] ${inserted}/${toInsert.length}곳 삽입 완료`);
    }

    await finishCrawlRun(runId, "success", inserted);
  } catch (err) {
    console.error(`[${SOURCE}] 실패:`, err);
    await finishCrawlRun(runId, "failed", inserted, String(err));
    throw err;
  }
}

run();
