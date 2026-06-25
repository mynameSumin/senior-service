/**
 * 전체 facilities에 대해 리스크 스코어를 재계산해 risk_scores 테이블에 upsert.
 * 크롤러가 evaluations/violations를 갱신한 뒤 마지막에 실행한다.
 */
import { db, fetchAllRows } from "../crawlers/shared/db";
import { computeRiskScore } from "../lib/scoring";

const UPSERT_CHUNK_SIZE = 500;

async function run() {
  // 시설마다 매번 evaluations/violations를 조회하면(N+1) 수만 건 규모에서 너무 느려진다 —
  // 전체를 한 번씩만 가져와 facility_id로 그룹핑한다.
  const facilities = await fetchAllRows<{ id: string }>((from, to) =>
    db.from("facilities").select("id").order("id").range(from, to)
  );
  const evaluations = await fetchAllRows<{
    facility_id: string;
    eval_year: number;
    grade: string;
    domain_scores: Record<string, number> | null;
  }>((from, to) =>
    db.from("evaluations").select("facility_id, eval_year, grade, domain_scores").order("id").range(from, to)
  );
  const violations = await fetchAllRows<{
    facility_id: string | null;
    violation_type: string | null;
    penalty: string | null;
    match_confidence: number | null;
  }>((from, to) =>
    db
      .from("violations")
      .select("facility_id, violation_type, penalty, match_confidence")
      .order("id").range(from, to)
  );

  const evaluationsByFacility = new Map<string, typeof evaluations>();
  for (const e of evaluations) {
    const list = evaluationsByFacility.get(e.facility_id);
    if (list) list.push(e);
    else evaluationsByFacility.set(e.facility_id, [e]);
  }
  const violationsByFacility = new Map<string, typeof violations>();
  for (const v of violations) {
    if (!v.facility_id) continue;
    const list = violationsByFacility.get(v.facility_id);
    if (list) list.push(v);
    else violationsByFacility.set(v.facility_id, [v]);
  }

  const rows = facilities.map((facility) => {
    const result = computeRiskScore(
      evaluationsByFacility.get(facility.id) ?? [],
      violationsByFacility.get(facility.id) ?? []
    );
    return {
      facility_id: facility.id,
      score: result.score,
      components: result.components,
      explanation: result.explanation,
      computed_at: new Date().toISOString(),
    };
  });

  let updated = 0;
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE);
    const { error } = await db.from("risk_scores").upsert(chunk, { onConflict: "facility_id" });
    if (error) throw error;
    updated += chunk.length;
  }

  console.log(`risk_scores 갱신: ${updated}건`);
}

run();
