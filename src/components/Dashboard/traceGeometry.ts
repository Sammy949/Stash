import type { BalancePoint } from "@/lib/ledger";

/**
 * Trace geometry for the balance instrument.
 *
 * Kept separate from the component and pure, so the path can be asserted in a
 * probe rather than eyeballed in a browser. Everything here is plain maths on a
 * fixed viewBox; the component only decides colour and motion.
 */

/** viewBox the path is authored in. The SVG scales; the maths does not. */
export const VIEW_W = 600;
export const VIEW_H = 120;

/** Room for the stroke's round cap so it is never clipped by the viewBox edge. */
const PAD_Y = 6;

export interface TraceGeometry {
  /** `d` for the balance line. */
  line: string;
  /** `d` for the filled area beneath it, closed along the baseline. */
  area: string;
  /** Y of the zero line in viewBox units, or null when 0 is outside the range. */
  zeroY: number | null;
  /** Y of the FIRST point, for the "where it started" rule. */
  firstY: number;
  /** X/Y of the last point, where the live dot sits. */
  lastX: number;
  lastY: number;
  /** True when every value is identical (a flat trace, e.g. opening balance only). */
  flat: boolean;
  /** The value range actually plotted, for axis labelling. */
  min: number;
  max: number;
}

/**
 * Map a balance series to SVG path data.
 *
 * The vertical scale always includes zero when the balance goes negative, so an
 * overdrawn trace visibly crosses the baseline rather than being re-normalised
 * into looking healthy. A flat series is drawn on the centre line instead of
 * dividing by a zero range.
 */
export function traceGeometry(points: BalancePoint[]): TraceGeometry | null {
  if (points.length === 0) return null;

  const values = points.map((p) => p.balance);
  let min = Math.min(...values);
  let max = Math.max(...values);

  // Whether the account ACTUALLY went negative, captured before `min` is
  // clamped toward zero below. This is the only thing the zero line may be
  // decided on: reading it off the clamped `min` made every healthy, always
  // positive ledger draw a red dashed "zero crossing" along its floor, which
  // is both untrue and a use of the alarm colour on an account in good shape.
  const wentNegative = min < 0;

  // Flatness is decided on the RAW values, before zero is pulled into range.
  // Order matters: clamping first would turn a steady £500 into a 0–500 range,
  // which is not flat, and the line would draw jammed against the top edge as if
  // pinned at a maximum. A balance that never moved should read as steady.
  const flat = max - min < 1e-9;

  // An overdrawn balance must read as crossing zero, so zero stays in frame.
  // Only meaningful once there is a real range to place it in.
  if (!flat) {
    if (min > 0 && max > 0) min = Math.min(min, 0);
    if (min < 0 && max < 0) max = Math.max(max, 0);

    // Headroom above the peak, so the zero line is never mistaken for the
    // ceiling. Without it an overdrawn trace puts zero ~6% from the top edge,
    // which reads as "zero is the maximum" instead of "this crossed zero".
    if (min < 0) max += (max - min) * 0.12;
  }

  const range = flat ? 1 : max - min;

  const usableH = VIEW_H - PAD_Y * 2;
  const x = (i: number) =>
    points.length === 1 ? VIEW_W / 2 : (i / (points.length - 1)) * VIEW_W;
  const y = (v: number) =>
    flat ? VIEW_H / 2 : PAD_Y + (1 - (v - min) / range) * usableH;

  const coords = points.map((p, i) => [x(i), y(p.balance)] as const);

  const line = coords
    .map(([px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(2)} ${py.toFixed(2)}`)
    .join(" ");

  // Close down to the bottom edge, not to the zero line: the fill is there to
  // give the line weight, and a fill that flips sides at zero reads as a bug.
  const area = `${line} L${VIEW_W} ${VIEW_H} L0 ${VIEW_H} Z`;

  const zeroInRange = !flat && wentNegative && max >= 0;

  return {
    line,
    area,
    zeroY: zeroInRange ? y(0) : null,
    firstY: coords[0][1],
    lastX: coords[coords.length - 1][0],
    lastY: coords[coords.length - 1][1],
    flat,
    min,
    max,
  };
}
