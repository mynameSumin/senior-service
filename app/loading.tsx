import Spinner from "@/components/Spinner";

export default function Loading() {
  return (
    <main className="flex flex-1 items-center justify-center py-24">
      <Spinner size={32} />
    </main>
  );
}
