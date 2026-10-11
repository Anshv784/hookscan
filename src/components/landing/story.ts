/** Shared between the hero (DOM) and the 3D field: scroll progress through the pinned hero, 0..1. */
export const heroProgress = { current: 0 };

export const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Status codes used by the field; colors match the app's verdict chips. */
export const STATUS_CODES = ["graduated", "open", "pad-only", "sell-blocked", "broken", "untested"] as const;
export const STATUS_COLORS = ["#7aa7ff", "#5fc48a", "#f2a93b", "#ef5b4c", "#7a2a22", "#5a554b"];

export interface FieldData {
  /** per coin: index of its hook cluster (clusters sorted by size, descending) */
  hook: number[];
  /** per coin: index into STATUS_CODES */
  status: number[];
  /** coins per cluster */
  sizes: number[];
}

/** The stages the hero scrolls through. */
export const STAGES = [0, 0.26, 0.55, 0.8] as const;
export const stageOf = (p: number) => (p < STAGES[1] ? 0 : p < STAGES[2] ? 1 : p < STAGES[3] ? 2 : 3);
