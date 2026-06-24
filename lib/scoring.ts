// 리스크 스코어: 0~100, 높을수록 위험. 블랙박스 금지 — 항상 explanation을 같이 반환한다.

export interface EvaluationInput {
  eval_year: number;
  grade: string; // A~E (건보공단)
  domain_scores: Record<string, number> | null;
}

export interface ViolationInput {
  violation_type: string | null;
  penalty: string | null;
  match_confidence: number | null;
}

export interface RiskScoreResult {
  score: number;
  components: {
    gradeTrend: number;
    lowGrade: number;
    violation: number;
    staffing: number;
  };
  explanation: string[];
}

const GRADE_RANK: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 };

function severityFromPenalty(penalty: string | null): number {
  if (!penalty) return 20;
  if (/지정취소|폐쇄|영업정지/.test(penalty)) return 50;
  if (/과징금|업무정지/.test(penalty)) return 35;
  return 20;
}

export function computeRiskScore(
  evaluations: EvaluationInput[],
  violations: ViolationInput[]
): RiskScoreResult {
  const explanation: string[] = [];
  const sorted = [...evaluations]
    .filter((e) => GRADE_RANK[e.grade] != null)
    .sort((a, b) => a.eval_year - b.eval_year);

  let gradeTrend = 0;
  let lowGrade = 0;
  let staffing = 0;

  const latest = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];

  if (latest && prev) {
    const drop = GRADE_RANK[prev.grade] - GRADE_RANK[latest.grade];
    if (drop > 0) {
      gradeTrend = Math.min(40, drop * 15);
      explanation.push(
        `최근 평가등급이 ${prev.eval_year}년 ${prev.grade}등급에서 ${latest.eval_year}년 ${latest.grade}등급으로 하락했습니다.`
      );
    }
  }

  if (latest) {
    if (latest.grade === "E") {
      lowGrade = 25;
      explanation.push(`${latest.eval_year}년 평가에서 최하위 등급(E)을 받았습니다.`);
    } else if (latest.grade === "D") {
      lowGrade = 15;
      explanation.push(`${latest.eval_year}년 평가에서 하위 등급(D)을 받았습니다.`);
    }

    const staffScore = latest.domain_scores?.["인력및시설"] ?? latest.domain_scores?.["인력"];
    if (typeof staffScore === "number" && staffScore < 60) {
      staffing = 15;
      explanation.push("인력 운영 영역 평가 점수가 낮습니다.");
    }
  }

  const confidentViolations = violations.filter((v) => (v.match_confidence ?? 0) >= 0.6);
  let violation = 0;
  for (const v of confidentViolations) {
    violation += severityFromPenalty(v.penalty);
  }
  violation = Math.min(50, violation);
  if (confidentViolations.length > 0) {
    explanation.push(
      `거짓청구 등 행정처분 이력이 ${confidentViolations.length}건 확인되었습니다.`
    );
  }

  if (explanation.length === 0) {
    explanation.push("현재 확인된 위험 신호가 없습니다.");
  }

  const score = Math.max(0, Math.min(100, gradeTrend + lowGrade + violation + staffing));

  return {
    score,
    components: { gradeTrend, lowGrade, violation, staffing },
    explanation,
  };
}
