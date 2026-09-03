/** Port of src/xray/wireframe.py `render_html` (danielsivyer4567/xray-by-looplet). */

export type Elem = {
  type: string;
  colour: string;
  a: [number, number, number];
  b: [number, number, number];
};

function hex(h: string): [number, number, number] {
  return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
}

function mul(a: Float32Array, b: Float32Array) {
  const o = new Float32Array(16);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
      o[i * 4 + j] = s;
    }
  return o;
}

function persp(f: number, ar: number, n: number, fa: number) {
  const t = 1 / Math.tan(f / 2);
  return new Float32Array([t / ar, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, (2 * fa * n) / (n - fa), 0]);
}

function look(e: number[], c: number[], u: number[]) {
  let z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]];
  let l = Math.hypot(z[0], z[1], z[2]) || 1;
  z = z.map((v) => v / l);
  let x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]];
  l = Math.hypot(x[0], x[1], x[2]) || 1;
  x = x.map((v) => v / l);
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]),
    -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]),
    -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]),
    1,
  ]);
}

function sh(gl: WebGLRenderingContext, t: number, src: string) {
  const o = gl.createShader(t);
  if (!o) throw new Error("shader");
  gl.shaderSource(o, src);
  gl.compileShader(o);
  return o;
}

export function mountWireframe(
  cv: HTMLCanvasElement,
  opts: {
    getElements: () => Elem[];
    getCam: () => { az: number; el: number; dist: number };
    getClear: () => [number, number, number, number];
  },
) {
  const raw = cv.getContext("webgl", { antialias: true, alpha: false, preserveDrawingBuffer: true });
  const empty = { stop() {}, rebuild() {}, diag: 1 };
  if (!raw) return empty;
  const gl: WebGLRenderingContext = raw;

  const VS =
    "attribute vec3 aP;attribute vec3 aC;uniform mat4 uMVP;varying vec3 vC;void main(){gl_Position=uMVP*vec4(aP,1.0);vC=aC;}";
  const FS = "precision mediump float;varying vec3 vC;void main(){gl_FragColor=vec4(vC,0.9);}";
  const pr = gl.createProgram();
  if (!pr) return empty;
  gl.attachShader(pr, sh(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(pr, sh(gl, gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(pr);
  gl.useProgram(pr);
  const aP = gl.getAttribLocation(pr, "aP");
  const aC = gl.getAttribLocation(pr, "aC");
  const uMVP = gl.getUniformLocation(pr, "uMVP");
  const bP = gl.createBuffer();
  const bC = gl.createBuffer();

  let mesh = { V: new Float32Array(0), C: new Float32Array(0), n: 0 };
  let ctr = [0, 0, 0];
  let diag = 1;

  function rebuild() {
    const els = opts.getElements();
    const V: number[] = [];
    const C: number[] = [];
    const pts: number[][] = [];
    for (const e of els) {
      const c = hex(e.colour);
      V.push(e.a[0], e.a[1], e.a[2], e.b[0], e.b[1], e.b[2]);
      C.push(c[0], c[1], c[2], c[0], c[1], c[2]);
      pts.push(e.a, e.b);
    }
    mesh = { V: new Float32Array(V), C: new Float32Array(C), n: V.length / 3 };
    const flat = pts.length ? pts : [[0, 0, 0]];
    const mn = [0, 1, 2].map((i) => Math.min(...flat.map((p) => p[i])));
    const mx = [0, 1, 2].map((i) => Math.max(...flat.map((p) => p[i])));
    ctr = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
    diag = Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) || 1;
    gl.bindBuffer(gl.ARRAY_BUFFER, bP);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.V, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, bC);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.C, gl.STATIC_DRAW);
  }
  rebuild();

  let live = true;
  function frame() {
    if (!live) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    if (w < 2 || h < 2) {
      requestAnimationFrame(frame);
      return;
    }
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const clear = opts.getClear();
    gl.viewport(0, 0, cv.width, cv.height);
    gl.clearColor(clear[0], clear[1], clear[2], clear[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const cam = opts.getCam();
    const ce = Math.cos(cam.el);
    const se = Math.sin(cam.el);
    const dist = diag * 1.6 * cam.dist;
    const eye = [ctr[0] + dist * ce * Math.cos(cam.az), ctr[1] + dist * ce * Math.sin(cam.az), ctr[2] + dist * se];
    const mvp = mul(persp(0.7, w / h, diag * 0.02, diag * 12), look(eye, ctr, [0, 0, 1]));
    gl.uniformMatrix4fv(uMVP, false, mvp);
    gl.bindBuffer(gl.ARRAY_BUFFER, bP);
    gl.enableVertexAttribArray(aP);
    gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bC);
    gl.enableVertexAttribArray(aC);
    gl.vertexAttribPointer(aC, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.LINES, 0, mesh.n);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    rebuild,
    get diag() {
      return diag;
    },
    stop() {
      live = false;
    },
  };
}
