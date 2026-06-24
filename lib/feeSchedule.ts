// 노인요양시설(요양원) 급여비용 — 보건복지부고시 제2025-247호(2025.11.04, 2026.1.1 시행) 기준.
// 본인부담금은 입소자의 장기요양등급(1~5등급)에 따라 전국 모든 요양원에서 동일하게 책정된다 —
// 시설별로 달라지는 비급여(식사재료비 등)와 달리 시설을 골라서 줄일 수 있는 비용이 아니다.
// 30일 기준, 일반(20%)/감경(12%, 8%) 본인부담률 적용. 식사재료비(간식비 포함)는 비급여 항목.
export const MEAL_COST_MONTHLY_2026 = 207_000;

export interface FeeTier {
  grade: string;
  totalMonthly: number;
  copay: { general: number; care12: number; care8: number };
  copayWithMeal: { general: number; care12: number; care8: number };
}

export const NURSING_HOME_FEE_2026: FeeTier[] = [
  {
    grade: "1등급",
    totalMonthly: 2_792_100,
    copay: { general: 558_420, care12: 335_052, care8: 223_368 },
    copayWithMeal: { general: 765_420, care12: 542_052, care8: 430_368 },
  },
  {
    grade: "2등급",
    totalMonthly: 2_590_200,
    copay: { general: 518_040, care12: 310_824, care8: 207_216 },
    copayWithMeal: { general: 725_040, care12: 517_824, care8: 414_216 },
  },
  {
    grade: "3·4·5등급",
    totalMonthly: 2_446_200,
    copay: { general: 489_240, care12: 293_544, care8: 195_696 },
    copayWithMeal: { general: 696_240, care12: 500_544, care8: 402_696 },
  },
];
