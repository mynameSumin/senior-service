/**
 * data.go.kr 크롤러 — 장기요양기관 평가등급(A~E) 시계열
 *
 * 소스: 공공데이터포털 "국민건강보험공단_장기요양기관 평가 결과" (publicDataPk=15104801)
 * robots.txt: data.go.kr은 Googlebot 외 일반 크롤러에 거의 제한 없음 → 크롤링 허용.
 *
 * 트러블슈팅 기록: 당초 계획은 "Open API 활용신청 → 서비스키 발급"이었으나,
 * 실제로는 활용신청 없이도 공개 다운로드 엔드포인트
 *   GET /tcs/dss/selectFileDataDownload.do?publicDataPk={pk}  → { atchFileId, fileDetailSn }
 *   GET /cmm/cmm/fileDownload.do?atchFileId=...&fileDetailSn=...  → 실제 CSV/XLSX 바이너리
 * 로 파일을 받을 수 있었다. 프론트 JS(fn_fileDataDownload, ui.common.js)를 리버스엔지니어링해 찾음.
 * 파일은 CP949(EUC-KR) 인코딩 CSV이고, 일부 행은 따옴표로 감싼 필드 안에 쉼표를 포함하므로
 * 단순 split(",")이 아니라 csv-parse로 파싱해야 한다.
 *
 * 평가데이터에는 "인력" 단독 영역 점수가 없어(기관운영/환경및안전/수급자권리보장/급여제공과정/급여제공결과)
 * lib/scoring.ts의 인력 가산점은 이 데이터만으로는 항상 0으로 계산된다 — 데이터의 한계이며 버그가 아니다.
 */
import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";
import { fetchJson } from "../shared/http";
import { db, startCrawlRun, finishCrawlRun } from "../shared/db";
import { bestFacilityMatch } from "../shared/fuzzy";

const SOURCE = "datagokr:ltc_eval";
const EVAL_PUBLIC_DATA_PK = "15104801"; // 장기요양기관 평가 결과

const SERVICE_TYPE_TO_FACILITY_TYPE: Record<string, string> = {
  "01.입소시설30인이상": "요양원",
  "02.입소시설10이상30인미만": "요양원",
  "03.입소시설10인미만": "요양원",
  "04.방문요양": "방문요양",
  "07.주야간보호": "주야간보호",
};

interface DownloadInfo {
  atchFileId: string;
  fileDetailSn: string;
}

async function resolveDownload(publicDataPk: string): Promise<DownloadInfo> {
  const json = await fetchJson<{ atchFileId: string; fileDetailSn: string; status: boolean }>(
    "https://www.data.go.kr/tcs/dss/selectFileDataDownload.do",
    { publicDataPk }
  );
  if (!json.status) throw new Error(`다운로드 정보 조회 실패: publicDataPk=${publicDataPk}`);
  return json;
}

async function downloadCsvRows(info: DownloadInfo): Promise<string[][]> {
  const res = await fetch(
    `https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=${info.atchFileId}&fileDetailSn=${info.fileDetailSn}&dataNm=data`,
    { headers: { "User-Agent": "Mozilla/5.0" } }
  );
  const buf = Buffer.from(await res.arrayBuffer());
  const utf8 = iconv.decode(buf, "cp949");
  return parse(utf8, { skip_empty_lines: true }) as string[][];
}

function parseEvalYear(evalGubun: string): number | null {
  const m = evalGubun.match(/(\d{4})년/);
  return m ? parseInt(m[1], 10) : null;
}

async function run() {
  const runId = await startCrawlRun(SOURCE);
  let inserted = 0;
  let skippedNoMatch = 0;

  try {
    const info = await resolveDownload(EVAL_PUBLIC_DATA_PK);
    const rows = await downloadCsvRows(info);
    const header = rows[0];
    const idx = (col: string) => header.indexOf(col);

    const iGubun = idx("평가구분");
    const iName = idx("장기요양기관명");
    const iServiceType = idx("급여종류");
    const iSido = idx("관할시도명");
    const iGrade = idx("평가등급");
    const iOrg = idx("기관운영");
    const iEnv = idx("환경및안전");
    const iRight = idx("수급자권리보장");
    const iProcess = idx("급여제공과정");
    const iResult = idx("급여제공결과");

    console.log(`[${SOURCE}] CSV 파싱 완료: ${rows.length - 1}행`);

    const { data: facilities } = await db.from("facilities").select("id, name, address");
    const facilityPool = facilities ?? [];

    for (const row of rows.slice(1)) {
      const serviceType = row[iServiceType]?.trim();
      const facilityType = SERVICE_TYPE_TO_FACILITY_TYPE[serviceType];
      if (!facilityType) continue; // 우리 서비스 타겟 유형 외(방문목욕/방문간호/단기보호/복지용구 등)

      const evalYear = parseEvalYear(row[iGubun] ?? "");
      const grade = row[iGrade]?.trim();
      if (!evalYear || !grade) continue;

      const name = row[iName]?.trim();
      const match = bestFacilityMatch(name, row[iSido], facilityPool);
      if (!match || match.confidence < 0.6) {
        skippedNoMatch++;
        continue;
      }

      const domain_scores: Record<string, number> = {};
      for (const [key, i] of [
        ["기관운영", iOrg],
        ["환경및안전", iEnv],
        ["수급자권리보장", iRight],
        ["급여제공과정", iProcess],
        ["급여제공결과", iResult],
      ] as [string, number][]) {
        const v = parseFloat(row[i]);
        if (!isNaN(v)) domain_scores[key] = v;
      }

      const { error } = await db.from("evaluations").upsert(
        {
          facility_id: match.id,
          source: "건보공단",
          eval_year: evalYear,
          grade,
          domain_scores,
          raw: { row_service_type: serviceType, row_name: name },
        },
        { onConflict: "facility_id,source,eval_year" }
      );
      if (error) throw error;
      inserted++;
    }

    console.log(`[${SOURCE}] evaluations 적재: ${inserted}건, 매칭 실패(스킵): ${skippedNoMatch}건`);
    await finishCrawlRun(runId, inserted > 0 ? "success" : "partial", inserted);
  } catch (err) {
    console.error(`[${SOURCE}] 실패:`, err);
    await finishCrawlRun(runId, "failed", inserted, String(err));
    throw err;
  }
}

run();
