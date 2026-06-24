export default function Spinner({ size = 28 }: { size?: number }) {
  return (
    <svg
      className="animate-spin text-purple-600"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="로딩 중"
      role="status"
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
