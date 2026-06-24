import type { StaffStatus } from "@/lib/dataGoKrDetail";

type StaffKey = keyof StaffStatus;

const STAFF_GROUPS: { title: string; items: [StaffKey, string][] }[] = [
  {
    title: "경영·행정 인력",
    items: [
      ["equipLong", "시설장"],
      ["hdOfce", "사무국장"],
      ["ofceEmp", "사무원"],
      ["mgmtPrsn", "관리인"],
    ],
  },
  {
    title: "사회복지·재활 인력",
    items: [
      ["socWel", "사회복지사"],
      ["physicalMTret", "물리치료사"],
      ["wrkMTret", "작업치료사"],
    ],
  },
  {
    title: "의료 인력",
    items: [
      ["chrgDoc", "의사(전임)"],
      ["chargeDoc", "의사(촉탁)"],
      ["nur", "간호사"],
      ["nurArticle", "간호조무사"],
      ["dent", "치위생사"],
    ],
  },
  {
    title: "돌봄 인력",
    items: [
      ["recuProt_1", "요양보호사(1급)"],
      ["recuProt_2", "요양보호사(2급)"],
      ["recuProtDelay", "요양보호사(유예)"],
    ],
  },
  {
    title: "급식·위생 인력",
    items: [
      ["nut", "영양사"],
      ["cook", "조리원"],
      ["hygiPrsn", "위생원"],
    ],
  },
  {
    title: "기타",
    items: [
      ["suppPrsn", "보조원"],
      ["etcPer", "기타인원"],
    ],
  },
];

export default function StaffStatusGrid({ staff }: { staff: StaffStatus }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {STAFF_GROUPS.map((group) => (
        <div key={group.title} className="rounded-xl border border-zinc-200 bg-white p-5">
          <h3 className="font-semibold text-zinc-900">{group.title}</h3>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">
            {group.items.map(([key, label]) => {
              const value = Number(staff[key] ?? 0);
              return (
                <div key={key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-zinc-600">{label}</span>
                  <span className={value > 0 ? "font-semibold text-zinc-900" : "text-zinc-300"}>
                    {value}명
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
