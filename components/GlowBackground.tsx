interface Blob {
  className: string;
  style: React.CSSProperties;
}

const BLOBS: Blob[] = [
  {
    className: "left-[8%] top-[-10%] h-96 w-96 bg-purple-400/40 animate-glow-drift-a",
    style: { animationDuration: "20s" },
  },
  {
    className: "right-[5%] top-[5%] h-[28rem] w-[28rem] bg-violet-500/30 animate-glow-drift-b",
    style: { animationDuration: "26s", animationDelay: "-6s" },
  },
  {
    className: "left-[20%] bottom-[-15%] h-[26rem] w-[26rem] bg-purple-300/40 animate-glow-drift-a",
    style: { animationDuration: "23s", animationDelay: "-12s" },
  },
  {
    className: "right-[15%] bottom-[-10%] h-80 w-80 bg-fuchsia-400/20 animate-glow-drift-b",
    style: { animationDuration: "18s", animationDelay: "-3s" },
  },
];

export default function GlowBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-gradient-to-b from-purple-50 via-white to-white">
      {BLOBS.map((blob, i) => (
        <div
          key={i}
          className={`absolute rounded-full blur-3xl ${blob.className}`}
          style={blob.style}
        />
      ))}
    </div>
  );
}
