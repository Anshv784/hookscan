/** Status codes used by the 3D field; colors follow the Meteora palette. */
export const STATUS_CODES = ["graduated", "open", "pad-only", "sell-blocked", "broken", "untested"] as const;
export const STATUS_COLORS = ["#8b6cff", "#34d399", "#f5bd00", "#ff6a2b", "#ff3b55", "#4b4b66"];
export const STATUS_LEGEND: [string, string][] = [
  ["#34d399", "open"],
  ["#f5bd00", "gated"],
  ["#ff6a2b", "sell-blocked"],
  ["#ff3b55", "frozen"],
  ["#8b6cff", "graduated"],
];

export interface FieldData {
  /** per coin: index of its hook cluster (clusters sorted by size, descending) */
  hook: number[];
  /** per coin: index into STATUS_CODES */
  status: number[];
  /** coins per cluster */
  sizes: number[];
}
