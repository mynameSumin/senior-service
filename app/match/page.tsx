"use client";

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
    <main className="mx-auto flex max-w-xl flex-1 flex-col px-6 py-16">
      <h1 className="text-2xl font-bold text-zinc-900">
        어르신 상태를 알려주세요
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        가격은 등급별로 이미 표준화돼 있어요. 비용보다 상태에 맞는 시설 유형을
        먼저 찾아드릴게요.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-7">
        <fieldset>
          <legend className="text-sm font-semibold text-zinc-800">
            거동 상태
          </legend>
          <div className="mt-2 flex flex-col gap-2">
            {[
              { v: "independent", l: "혼자 이동 가능" },
              { v: "partial", l: "부분적인 도움 필요" },
              { v: "full", l: "거의 누워서 생활 (전적 도움)" },
            ].map((opt) => (
              <label
                key={opt.v}
                className="flex items-center gap-2 text-sm text-zinc-700"
              >
                <input
                  type="radio"
                  name="mobility"
                  value={opt.v}
                  checked={mobility === opt.v}
                  onChange={() => setMobility(opt.v)}
                  className="accent-purple-600"
                />
                {opt.l}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-zinc-800">
            인지 상태(치매 등)
          </legend>
          <div className="mt-2 flex flex-col gap-2">
            {[
              { v: "normal", l: "정상" },
              { v: "mild", l: "경증 치매/인지저하" },
              { v: "severe", l: "중증 치매/인지저하" },
            ].map((opt) => (
              <label
                key={opt.v}
                className="flex items-center gap-2 text-sm text-zinc-700"
              >
                <input
                  type="radio"
                  name="cognition"
                  value={opt.v}
                  checked={cognition === opt.v}
                  onChange={() => setCognition(opt.v)}
                  className="accent-purple-600"
                />
                {opt.l}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-zinc-800">
            상시 의료처치 필요 여부
          </legend>
          <div className="mt-2 flex flex-col gap-2">
            {[
              { v: "low", l: "특별한 의료처치 없음" },
              { v: "medium", l: "정기적인 처치(욕창 관리 등)" },
              { v: "high", l: "산소치료·튜브영양 등 상시 의료처치" },
            ].map((opt) => (
              <label
                key={opt.v}
                className="flex items-center gap-2 text-sm text-zinc-700"
              >
                <input
                  type="radio"
                  name="medicalNeed"
                  value={opt.v}
                  checked={medicalNeed === opt.v}
                  onChange={() => setMedicalNeed(opt.v)}
                  className="accent-purple-600"
                />
                {opt.l}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-zinc-800">
            희망 지역 (선택)
          </legend>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          >
            <option value="">전국</option>
            {SIDO_LIST.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </fieldset>

        <button
          type="submit"
          className="mt-2 rounded-full bg-purple-600 px-6 py-3 font-bold text-white transition hover:bg-purple-700"
        >
          맞는 시설 보기
        </button>
      </form>
    </main>
  );
}
