const CRITERIA = [
  {
    icon: "📉",
    title: "평가등급 추이",
    desc: "등급이 오르고 있는지, 떨어지고 있는지를 봅니다. 한 시점의 등급보다 추이가 더 정직한 신호입니다.",
  },
  {
    icon: "⚠️",
    title: "거짓청구·행정처분",
    desc: "지정취소·영업정지 같은 처분 이력이 있다면, 시설 소개 페이지에는 절대 나오지 않아도 여기서는 보여드립니다.",
  },
  {
    icon: "👥",
    title: "인력 현황",
    desc: "요양보호사·간호인력이 정원 대비 충분한지를 봅니다. 결국 돌봄의 질은 사람 손에서 결정됩니다.",
  },
  {
    icon: "💬",
    title: "이용자 후기",
    desc: "실제로 부모님을 모셔본 다른 가족들의 후기를 모아, 숫자로 안 보이는 부분까지 참고할 수 있게 합니다.",
  },
];

export default function WhyCareGuard() {
  return (
    <section className="mx-auto mt-20 w-full max-w-3xl text-left">
      <div className="text-center">
        <h2 className="text-xl font-bold text-zinc-900">
          가격이 아니라, 관리가 문제입니다
        </h2>
        <p className="mt-3 text-sm text-zinc-600">
          요양·돌봄 시설은 가격표만 봐서는 좋은 곳을 고를 수 없습니다. 실제로
          중요한 건 이 시설이 어떻게 운영되고 있는지, 어떤 평가를 받았는지,
          인력은 충분한지, 먼저 이용해본 가족들은 뭐라고 하는지입니다.
        </p>
        <p className="mt-3 text-sm text-zinc-600">
          우리 서비스는 이 네 가지를 모아 0~100점 위험도 점수로 정리해
          보여드립니다.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CRITERIA.map((c) => (
          <div
            key={c.title}
            className="rounded-xl border border-zinc-200 bg-white p-5"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-50 text-lg">
              {c.icon}
            </span>
            <p className="mt-3 font-semibold text-zinc-900">{c.title}</p>
            <p className="mt-1 text-sm text-zinc-500">{c.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
