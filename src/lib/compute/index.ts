export * from "./fx";
export * from "./valuations";
export * from "./positions";
export * from "./portfolio";
export * from "./fees";
export * from "./obligations";
export * from "./distributions";
export * from "./statement";
export * from "./profile";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}
