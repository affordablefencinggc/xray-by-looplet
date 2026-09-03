export type Seg = [number, number, number, number, number, number];
export type SheetKind = "cover" | "plan" | "elev" | "detail";

export const PAL = {
  navy: "#050b14",
  paper: "#f2ede3",
  charcoal: "#1e1e1e",
  cyan: "#7fdbff",
  roof: "#e8b339",
  manual: "#c9a227",
  extrude: "#c07a5b",
  gridNavy: "#17324d",
  gridPaper: "rgba(28, 110, 164, 0.16)",
  planInk: "#1c6ea4",
  glow: "rgba(127, 219, 255, 0.55)",
  mist: "#8fb3cc",
};

export const SHEETS = Array.from({ length: 24 }, (_, i) => {
  const n = i + 1;
  let kind: SheetKind = "plan";
  let title = `Sheet ${n}`;
  if (n <= 2) kind = "cover";
  if (n === 3) kind = "plan";
  if (n >= 17 && n <= 20) kind = "elev";
  if (n === 23) kind = "detail";
  if (n === 24) kind = "detail";
  return { index: i, n, title, kind };
});

function line(arr: Seg[], a: number[], b: number[]) {
  arr.push([a[0], a[1], a[2], b[0], b[1], b[2]]);
}

function box(arr: Seg[], x0: number, z0: number, x1: number, z1: number, y0: number, y1: number) {
  const p = [
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y0, z1],
    [x0, y0, z1],
    [x0, y1, z0],
    [x1, y1, z0],
    [x1, y1, z1],
    [x0, y1, z1],
  ];
  line(arr, p[0], p[1]);
  line(arr, p[1], p[2]);
  line(arr, p[2], p[3]);
  line(arr, p[3], p[0]);
  line(arr, p[4], p[5]);
  line(arr, p[5], p[6]);
  line(arr, p[6], p[7]);
  line(arr, p[7], p[4]);
  line(arr, p[0], p[4]);
  line(arr, p[1], p[5]);
  line(arr, p[2], p[6]);
  line(arr, p[3], p[7]);
}

function face(arr: Seg[], x: number, y: number, w: number, h: number, z = 0, mullion = true) {
  line(arr, [x, y, z], [x + w, y, z]);
  line(arr, [x + w, y, z], [x + w, y + h, z]);
  line(arr, [x + w, y + h, z], [x, y + h, z]);
  line(arr, [x, y + h, z], [x, y, z]);
  if (mullion) line(arr, [x + w / 2, y, z], [x + w / 2, y + h, z]);
}

export function houseGeom() {
  const B: Seg[] = [];
  const R: Seg[] = [];
  const W = 18;
  const D = 7.2;
  const H = 2.8;
  box(B, 0, 0, W, D, 0, H);
  line(B, [6.1, 0, 0], [6.1, H, 0]);
  line(B, [12.2, 0, 0], [12.2, H, 0]);
  face(B, 0.6, 0.85, 1.5, 1.35);
  face(B, 2.4, 0.85, 1.5, 1.35);
  face(B, 4.2, 0.85, 1.5, 1.35);
  face(B, 6.6, 0.8, 1.7, 1.45);
  face(B, 8.6, 0.8, 1.7, 1.45);
  face(B, 10.6, 0.8, 1.4, 1.45, 0, false);
  line(B, [10.6, 0, 0], [10.6, 2.25, 0]);
  line(B, [12.0, 0, 0], [12.0, 2.25, 0]);
  line(B, [10.6, 2.25, 0], [12.0, 2.25, 0]);
  face(B, 12.8, 0.85, 1.5, 1.35);
  face(B, 14.6, 0.85, 1.5, 1.35);
  face(B, 16.4, 0.85, 1.2, 1.35);
  const midZ = D / 2;
  const ridgeY = 4.15;
  line(R, [0, H, 0], [W, H, 0]);
  line(R, [W, H, 0], [W, H, D]);
  line(R, [W, H, D], [0, H, D]);
  line(R, [0, H, D], [0, H, 0]);
  line(R, [0, ridgeY, midZ], [W, ridgeY, midZ]);
  line(R, [0, H, 0], [0, ridgeY, midZ]);
  line(R, [0, H, D], [0, ridgeY, midZ]);
  line(R, [W, H, 0], [W, ridgeY, midZ]);
  line(R, [W, H, D], [W, ridgeY, midZ]);
  for (let i = 1; i < 6; i++) {
    const x = (W / 6) * i;
    line(R, [x, H, 0], [x, ridgeY, midZ]);
    line(R, [x, H, D], [x, ridgeY, midZ]);
  }
  return { B, R };
}

export function planGeom() {
  const B: Seg[] = [];
  const R: Seg[] = [];
  const W = 18;
  const D = 7.2;
  const H = 2.8;
  box(B, 0, 0, W, D, 0, H);
  line(B, [6.1, 0, 0], [6.1, 0, D]);
  line(B, [6.1, H, 0], [6.1, H, D]);
  line(B, [6.1, 0, 0], [6.1, H, 0]);
  line(B, [6.1, 0, D], [6.1, H, D]);
  line(B, [12.2, 0, 0], [12.2, 0, D]);
  line(B, [12.2, H, 0], [12.2, H, D]);
  line(B, [12.2, 0, 0], [12.2, H, 0]);
  line(B, [12.2, 0, D], [12.2, H, D]);
  line(B, [0, 0, 3.4], [6.1, 0, 3.4]);
  line(B, [12.2, 0, 3.6], [W, 0, 3.6]);
  const midZ = D / 2;
  const ridgeY = 4.15;
  line(R, [0, H, 0], [W, H, 0]);
  line(R, [W, H, 0], [W, H, D]);
  line(R, [W, H, D], [0, H, D]);
  line(R, [0, H, D], [0, H, 0]);
  line(R, [0, ridgeY, midZ], [W, ridgeY, midZ]);
  line(R, [0, H, 0], [0, ridgeY, midZ]);
  line(R, [0, H, D], [0, ridgeY, midZ]);
  line(R, [W, H, 0], [W, ridgeY, midZ]);
  line(R, [W, H, D], [W, ridgeY, midZ]);
  return { B, R };
}

export function geomForKind(kind: SheetKind) {
  return kind === "plan" || kind === "cover" ? planGeom() : houseGeom();
}

export const HOUSE = houseGeom();
export const PLAN = planGeom();
