// 적합도 매칭: ML이 아니라 거동/인지/의료필요 상태 → 시설 유형 룰 테이블.
// 장기요양 수가는 등급별로 전국 표준화돼 있어 "예산으로 시설을 거르는" 접근은 의미가 없다(가격은 이미 투명한 축).
// 예산은 본인부담금 추정 표시에만 쓰고, 유형 추천에는 쓰지 않는다.

export type Mobility = "independent" | "partial" | "full";
export type Cognition = "normal" | "mild" | "severe";
export type MedicalNeed = "low" | "medium" | "high";

export interface MatchInput {
  mobility: Mobility;
  cognition: Cognition;
  medicalNeed: MedicalNeed;
  region?: string;
}

export interface MatchResult {
  recommendedTypes: string[];
  reason: string;
}

export function matchFacilityType(input: MatchInput): MatchResult {
  const { mobility, cognition, medicalNeed } = input;

  if (medicalNeed === "high") {
    return {
      recommendedTypes: ["요양병원"],
      reason:
        "산소치료·튜브영양 등 상시 의료처치가 필요한 상태로 보입니다. 의료진이 상주하는 요양병원이 우선 적합합니다.",
    };
  }

  if (mobility === "full" || cognition === "severe") {
    return {
      recommendedTypes: ["요양원"],
      reason:
        "거동이나 인지 기능 저하로 24시간 돌봄이 필요한 상태로 보입니다. 입소형 요양원이 우선 적합합니다.",
    };
  }

  if (cognition === "mild" || mobility === "partial") {
    return {
      recommendedTypes: ["주야간보호", "요양원"],
      reason:
        "낮 시간 돌봄이 필요하지만 자택 생활을 유지할 수 있는 상태로 보입니다. 주야간보호센터를 우선 추천하며, 입소를 원하시면 요양원도 함께 비교해보세요.",
    };
  }

  return {
    recommendedTypes: ["방문요양", "주야간보호"],
    reason:
      "비교적 독립적인 생활이 가능한 상태로 보입니다. 자택에서 부분적인 도움을 받는 방문요양을 우선 추천합니다.",
  };
}
