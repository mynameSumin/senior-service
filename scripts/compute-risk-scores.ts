/**
 * 전체 facilities에 대해 리스크 스코어를 재계산해 risk_scores 테이블에 upsert.
 * 크롤러가 evaluations/violations를 갱신한 뒤 마지막에 실행한다.
 */
import { db } from "../crawlers/shared/db";
import { computeRiskScore } from "../lib/scoring";

async function run() {
  const { data: facilities, error } = await db.from("facilities").select("id");
  if (error) throw error;

  let updated = 0;
  for (const facility of facilities ?? []) {
    const [{ data: evaluations }, { data: violations }] = await Promise.all([
      db
        .from("evaluations")
        .select("eval_year, grade, domain_scores")
        .eq("facility_id", facility.id),
      db
        .from("violations")
        .select("violation_type, penalty, match_confidence")
        .eq("facility_id", facility.id),
    ]);

    const result = computeRiskScore(evaluations ?? [], violations ?? []);

    await db.from("risk_scores").upsert({
      facility_id: facility.id,
      score: result.score,
      components: result.components,
      explanation: result.explanation,
      computed_at: new Date().toISOString(),
    });
    updated++;
  }

  console.log(`risk_scores 갱신: ${updated}건`);
}

run();
