import { useEffect, useState } from "react";
import { timeRemaining } from "../../lib/format";

export function AuctionCountdown({ endAt, className }: { endAt: string; className?: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const { text, expired, urgent } = timeRemaining(endAt);
  return (
    <span className={`font-mono font-bold ${expired ? "text-slate-400" : urgent ? "text-red-500" : ""} ${className ?? ""}`}>
      {text}
    </span>
  );
}
