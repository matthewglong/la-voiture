// Formatting shared by the garage and the HUD.

/** A race time: 42.31s, or 2:07.3 past a minute. */
export function fmtTime(t: number): string {
  if (t < 60) return `${t.toFixed(2)}s`;
  const m = Math.floor(t / 60);
  const sec = t - m * 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(1)}`;
}
