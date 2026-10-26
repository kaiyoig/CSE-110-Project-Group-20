/** 3725000 ms -> "01:02:05" (spec: hour:minute:seconds). Negative/invalid -> "00:00:00". */
export function formatTime(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.ceil(ms / 1000) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** 1234.5 -> "$1,234.50"; invalid input -> "$0.00". */
export function formatMoney(amount: number): string {
  const safe = Number.isFinite(amount) && amount > 0 ? amount : 0;
  return "$" + safe.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
