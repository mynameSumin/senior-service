"use client";

import { useEffect, useState } from "react";

const TIERS = [
  {
    range: "60점 이상",
    label: "위험",
    className: "bg-red-100 text-red-700 border-red-300",
  },
  {
    range: "30 ~ 59점",
    label: "주의",
    className: "bg-amber-100 text-amber-700 border-amber-300",
  },
  {
    range: "29점 이하",
    label: "안전",
    className: "bg-emerald-100 text-emerald-700 border-emerald-300",
  },
];

const COMPONENTS = [
  {
    title: "평가등급 하락 추이 (최대 40점)",
    desc: "최근 2개 평가연도 등급을 비교해, 등급이 떨어진 만큼(한 단계당 15점) 가산합니다.",
  },
  {
    title: "하위 등급 (D 15점 · E 25점)",
    desc: "가장 최근 평가등급이 D 또는 E이면 추가로 가산합니다.",
  },
  {
    title: "거짓청구 등 행정처분 (최대 50점)",
    desc: "매칭 신뢰도 60% 이상인 처분 건마다 심각도에 따라 20~50점을 더합니다 (지정취소·폐쇄·영업정지 50점, 과징금·업무정지 35점, 그 외 20점).",
  },
  {
    title: "인력 부족 (15점)",
    desc: "평가의 인력 및 시설 영역 점수가 60점 미만이면 가산합니다.",
  },
];

export default function RiskScoreInfo() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 hover:underline"
      >
        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-purple-400 text-[10px] leading-none">
          i
        </span>
        위험도 점수는 어떻게 계산되나요?
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-white p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-zinc-900">
                위험도 점수는 어떻게 계산되나요?
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="text-zinc-400 hover:text-zinc-700"
              >
                ✕
              </button>
            </div>

            <p className="mt-2 text-sm text-zinc-600">
              0~100점이며 높을수록 위험합니다. 단일 블랙박스 점수가 아니라, 아래
              4가지 항목의 합으로 계산하고 시설 상세페이지에 적용된 사유를 항상
              함께 보여드립니다.
            </p>

            <div className="mt-4 flex flex-col gap-3">
              {COMPONENTS.map((c) => (
                <div
                  key={c.title}
                  className="rounded-lg border border-zinc-200 p-3"
                >
                  <p className="text-sm font-semibold text-zinc-900">
                    {c.title}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">{c.desc}</p>
                </div>
              ))}
            </div>

            <h3 className="mt-5 text-sm font-semibold text-zinc-800">
              등급 구간
            </h3>
            <div className="mt-2 flex flex-col gap-2">
              {TIERS.map((t) => (
                <div
                  key={t.label}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="text-zinc-600">{t.range}</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${t.className}`}
                  >
                    {t.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
