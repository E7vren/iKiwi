import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export function Logo({ size = 40, className, showText = true }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <KiwiIcon size={size} />
      {showText && (
        <span className="text-lg font-extrabold tracking-tight text-gray-900">
          i<span className="text-[#2e7d32]">K</span>i<span className="text-[#2e7d32]">W</span>i
        </span>
      )}
    </div>
  );
}

function KiwiIcon({ size }: { size: number }) {
  const cx = 50,
    cy = 58;
  const seeds = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180;
    return {
      x1: cx + 10 * Math.cos(a),
      y1: cy + 10 * Math.sin(a),
      x2: cx + 23 * Math.cos(a),
      y2: cy + 23 * Math.sin(a),
    };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <title>iKiwi</title>
      {/* Stem */}
      <line x1="50" y1="5" x2="50" y2="22" stroke="#1a3a0d" strokeWidth="5" strokeLinecap="round" />
      {/* Leaves */}
      <path d="M50,22 C46,13 28,8 24,15 C28,22 42,27 50,22Z" fill="#2e7d32" />
      <path d="M50,22 C54,13 72,8 76,15 C72,22 58,27 50,22Z" fill="#4caf50" />
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r="32" fill="#1a3a0d" />
      {/* Flesh */}
      <circle cx={cx} cy={cy} r="26" fill="#4caf50" />
      {/* Inner flesh */}
      <circle cx={cx} cy={cy} r="20" fill="#8bc34a" />
      {/* Seeds */}
      {seeds.map((s, i) => {
        const angle = i * 30;
        return (
          <line
            key={angle}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke="#1a3a0d"
            strokeWidth="2"
            strokeLinecap="round"
          />
        );
      })}
      {/* Center */}
      <circle cx={cx} cy={cy} r="7" fill="white" />
    </svg>
  );
}
