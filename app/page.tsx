import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="mb-3 text-sm font-medium text-purple-700">케어가드 (가칭)</p>
      <h1 className="max-w-2xl text-3xl font-bold leading-tight text-zinc-900 sm:text-4xl">
        가격은 이미 투명합니다.
        <br />
        진짜 안 보이던 건 <span className="text-red-600">리스크</span>였습니다.
      </h1>
      <p className="mt-5 max-w-xl text-zinc-600">
        등급 하락, 거짓청구 행정처분, 인력 부족 — 가족이 꼭 알아야 하지만 흩어져 있던 정보를
        모아, 부모님께 맞는 요양시설을 안전하게 비교하세요.
      </p>
      <Link
        href="/match"
        className="mt-8 rounded-full bg-purple-600 px-8 py-3 font-medium text-white transition hover:bg-purple-700"
      >
        우리 가족에게 맞는 시설 찾기
      </Link>
      <p className="mt-4 text-xs text-zinc-400">
        평가등급·행정처분 등은 공공데이터, 후기는 민간 플랫폼을 집계해 보여드립니다.
      </p>
    </main>
  );
}
