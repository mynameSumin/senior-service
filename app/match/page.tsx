"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const SIDO_LIST = [
  "서울특별시",
  "경기도",
  "인천광역시",
  "부산광역시",
  "대구광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
  "강원특별자치도",
  "충청북도",
  "충청남도",
  "전북특별자치도",
  "전라남도",
  "경상북도",
  "경상남도",
  "제주도",
];

const MOBILITY_OPTIONS = [
  { v: "independent", l: "혼자 이동 가능" },
  { v: "partial", l: "부분적인 도움 필요" },
  { v: "full", l: "거의 누워서 생활 (전적 도움)" },
];

const COGNITION_OPTIONS = [
  { v: "normal", l: "정상" },
  { v: "mild", l: "경증 치매/인지저하" },
  { v: "severe", l: "중증 치매/인지저하" },
];

const MEDICAL_OPTIONS = [
  { v: "low", l: "특별한 의료처치 없음" },
  { v: "medium", l: "정기적인 처치(욕창 관리 등)" },
  { v: "high", l: "산소치료·튜브영양 등 상시 의료처치" },
];

function OptionGroup({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: { v: string; l: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-zinc-800">{title}</legend>
      <div className="mt-3 flex flex-col gap-2">
        {options.map((opt) => {
          const selected = value === opt.v;
          return (
            <label
              key={opt.v}
              className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3.5 text-sm transition ${
                selected
                  ? "border-purple-500 bg-purple-50 font-medium text-purple-800"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-purple-200"
              }`}
            >
              <span>{opt.l}</span>
              <input
                type="radio"
                value={opt.v}
                checked={selected}
                onChange={() => onChange(opt.v)}
                className="accent-purple-600"
              />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function MatchPage() {
  const router = useRouter();
  const [mobility, setMobility] = useState("partial");
  const [cognition, setCognition] = useState("normal");
  const [medicalNeed, setMedicalNeed] = useState("low");
  const [region, setRegion] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ mobility, cognition, medicalNeed });
    if (region) params.set("region", region);
    router.push(`/results?${params.toString()}`);
  }

  return (
    <div className="min-h-full w-full bg-gradient-to-b from-purple-100 via-purple-50 to-zinc-50">
      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-16">
        <Link href="/" className="text-sm text-zinc-500 hover:text-purple-700 hover:underline">
          ← 처음으로
        </Link>

        <form
          id="match-form"
          onSubmit={handleSubmit}
          className="mt-4 rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm sm:p-8"
        >
          <h1 className="text-2xl font-bold leading-snug text-zinc-900">
            어르신 상태를 알려주세요
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            가격은 등급별로 이미 표준화돼 있어요. 비용보다 상태에 맞는 시설 유형을
            먼저 찾아드릴게요.
          </p>

          <div className="mt-8 flex flex-col gap-7">
            <OptionGroup
              title="거동 상태"
              options={MOBILITY_OPTIONS}
              value={mobility}
              onChange={setMobility}
            />
            <OptionGroup
              title="인지 상태(치매 등)"
              options={COGNITION_OPTIONS}
              value={cognition}
              onChange={setCognition}
            />
            <OptionGroup
              title="상시 의료처치 필요 여부"
              options={MEDICAL_OPTIONS}
              value={medicalNeed}
              onChange={setMedicalNeed}
            />

            <fieldset>
              <legend className="text-sm font-semibold text-zinc-800">
                희망 지역 <span className="text-zinc-400">(선택)</span>
              </legend>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3.5 text-sm text-zinc-700 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="">전국</option>
                {SIDO_LIST.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </fieldset>
          </div>
        </form>

        {/* 버튼 높이만큼 본문 아래 여백을 둬서 하단 고정 바에 안 가려지게 한다 */}
        <div className="h-24" />
      </main>

      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-zinc-50 via-zinc-50/95 to-transparent px-4 pb-6 pt-10 sm:px-6">
        <button
          type="submit"
          form="match-form"
          className="mx-auto block w-full max-w-xl rounded-2xl bg-purple-600 py-4 text-center font-bold text-white shadow-lg shadow-purple-600/20 transition hover:bg-purple-700"
        >
          맞는 시설 보기
        </button>
      </div>
    </div>
  );
}
