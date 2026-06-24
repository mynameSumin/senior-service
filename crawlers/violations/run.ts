/**
 * 거짓청구 명단공표 크롤러 (보건복지부)
 *
 * 소스: https://www.mohw.go.kr/menu.es?mid=a10507010200 ("건강보험 거짓청구 요양기관 명단공표")
 * robots.txt: mid=a10507010200 / claimList.es 경로는 Disallow 대상이 아님 (board.es 와 다른 경로) → 크롤링 허용으로 판단.
 *
 * 주의(트러블슈팅 기록 대상): 이 명단은 "건강보험" 거짓청구 요양기관(병원/의원/한의원/약국 등) 명단이며,
 * 우리 서비스의 타겟인 "장기요양기관"(요양원/요양병원) 전용 행정처분 명단은 별도로 존재하지 않거나
 * 비공개 채널(longtermcare.or.kr, robots 전체 차단)에 있는 것으로 추정됨.
 * 따라서 이 크롤러는 실제로 동작하지만, facilities(요양원/요양병원)와의 fuzzy 매칭 결과가
 * 0건이거나 매우 적게 나올 수 있음 — 이는 데이터의 한계이며 버그가 아님.
 */
import * as cheerio from "cheerio";
import { fetchText } from "../shared/http";
import { db, startCrawlRun, finishCrawlRun } from "../shared/db";
import { bestFacilityMatch } from "../shared/fuzzy";

const LIST_URL = "https://www.mohw.go.kr/claimList.es";
const SOURCE = "violations:mohw_claimlist";

interface ViolationRow {
  org_name_raw: string;
  address_raw: string;
  org_type: string;
  violation_type: string;
  penalty: string;
  violation_date: string | null;
  source_url: string;
}

function parseRows(html: string): ViolationRow[] {
  const $ = cheerio.load(html);
  const rows: ViolationRow[] = [];

  $("table.tstyle_list tbody tr").each((_, el) => {
    const $row = $(el);
    const name = $row.find("td.txt_title").first().text().trim();
    if (!name) return;

    const address = $row.find('td[data-label="주소"]').first().text().trim();
    const orgType = $row.find('td[data-label="요양기관종류"]').first().text().trim();
    const violationType = $row
      .find('td[data-label="위반내용"]')
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();
    const penalty = $row.find('td[data-label="처분내용"]').first().text().trim();
    const dateText = $row.find('td[data-label="공표일"]').first().text().trim();

    rows.push({
      org_name_raw: name,
      address_raw: address,
      org_type: orgType,
      violation_type: violationType,
      penalty,
      violation_date: /^\d{4}-\d{2}-\d{2}$/.test(dateText) ? dateText : null,
      source_url: "https://www.mohw.go.kr/menu.es?mid=a10507010200",
    });
  });

  return rows;
}

async function run() {
  const runId = await startCrawlRun(SOURCE);
  try {
    const html = await fetchText(LIST_URL, {
      params: { mid: "a10507010200", nPage: "1", b_list: "500", act: "list" },
    });
    const rows = parseRows(html);
    console.log(`[${SOURCE}] 파싱된 행: ${rows.length}건`);

    const { data: facilities, error: facErr } = await db
      .from("facilities")
      .select("id, name, address");
    if (facErr) throw facErr;

    // 게시판은 매번 같은 공고를 다시 보여주므로, 매일 자동 실행 시 중복 적재를
    // 막기 위해 (기관명+처분일+처분유형)이 이미 있는 행은 건너뛴다.
    const { data: existingRows, error: existErr } = await db
      .from("violations")
      .select("org_name_raw, violation_date, violation_type");
    if (existErr) throw existErr;
    const existingKeys = new Set(
      (existingRows ?? []).map((r) => `${r.org_name_raw}|${r.violation_date}|${r.violation_type}`)
    );

    let matched = 0;
    let inserted = 0;
    for (const row of rows) {
      const violationType = `[${row.org_type}] ${row.violation_type}`;
      const key = `${row.org_name_raw}|${row.violation_date}|${violationType}`;
      if (existingKeys.has(key)) continue;

      const match = bestFacilityMatch(row.org_name_raw, row.address_raw, facilities ?? []);
      const confident = match && match.confidence >= 0.6;
      if (confident) matched++;

      const { error } = await db.from("violations").insert({
        facility_id: confident ? match!.id : null,
        org_name_raw: row.org_name_raw,
        address_raw: row.address_raw,
        violation_type: violationType,
        violation_date: row.violation_date,
        penalty: row.penalty,
        source_url: row.source_url,
        match_confidence: match?.confidence ?? null,
      });
      if (error) throw error;
      existingKeys.add(key);
      inserted++;
    }

    console.log(`[${SOURCE}] 신규 적재: ${inserted}/${rows.length}건, facilities 매칭: ${matched}건 (confidence>=0.6)`);
    await finishCrawlRun(runId, rows.length > 0 ? "success" : "partial", inserted);
  } catch (err) {
    console.error(`[${SOURCE}] 실패:`, err);
    await finishCrawlRun(runId, "failed", 0, String(err));
    throw err;
  }
}

run();
