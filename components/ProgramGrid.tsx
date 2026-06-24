import type { ProgramItem } from "@/lib/dataGoKrDetail";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-zinc-600">{label}</span>
      <span className={value ? "font-semibold text-zinc-900" : "text-zinc-300"}>
        {value ?? "-"}
      </span>
    </div>
  );
}

export default function ProgramGrid({ programs }: { programs: ProgramItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {programs.map((p, i) => (
        <div key={i} className="rounded-xl border border-zinc-200 bg-white p-5">
          <h3 className="font-semibold text-zinc-900">{p.pgmNm || "프로그램"}</h3>
          <div className="mt-3 flex flex-col gap-2">
            <Field label="장소" value={p.runPlc || null} />
            <Field label="회당 시간" value={p.cyclTm ? `${p.cyclTm}시간` : null} />
            <Field label="대상 인원" value={p.tgtNop ? `${p.tgtNop}명` : null} />
          </div>
        </div>
      ))}
    </div>
  );
}
