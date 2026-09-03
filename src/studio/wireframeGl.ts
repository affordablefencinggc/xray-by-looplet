/** Port of src/xray/wireframe.py `render_html` (danielsivyer4567/xray-by-looplet). */

export type Elem = {
  type: string;
  colour: string;
  a: [number, number, number];
  b: [number, number, number];
};

export type Face = {
  colour: string;
  alpha?: number;
  triangles: [number, number, number][];
};

function hex(h: string): [number, number, number] {
  return [
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255,
  ];
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
  return new Float32Array([
    t / ar,
    0,
    0,
    0,
    0,
    t,
    0,
    0,
    0,
    0,
    (fa + n) / (n - fa),
    -1,
    0,
    0,
    (2 * fa * n) / (n - fa),
    0,
  ]);
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
    x[0],
    y[0],
    z[0],
    0,
    x[1],
    y[1],
    z[1],
    0,
    x[2],
    y[2],
    z[2],
    0,
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
  if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(o);
    gl.deleteShader(o);
    throw new Error("shader compilation failed: " + log);
  }
  return o;
}

export function mountWireframe(
  cv: HTMLCanvasElement,
  opts: {
    getElements: () => Elem[];
    getFaces?: () => Face[];
    getCam: () => { az: number; el: number; dist: number };
    getClear: () => [number, number, number, number];
  },
) {
  const raw = cv.getContext("webgl", {
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  const empty = { stop() {}, rebuild() {}, diag: 1 };
  if (!raw) return empty;
  const gl: WebGLRenderingContext = raw;

  // 1. Shaded solid face program
  const VS_face =
    "attribute vec3 aP;attribute vec4 aC;uniform mat4 uMVP;uniform vec2 uOffset;varying vec4 vC;void main(){vec4 p=uMVP*vec4(aP,1.0);p.xy+=uOffset*p.w;gl_Position=p;vC=aC;}";
  const FS_face = "precision mediump float;varying vec4 vC;void main(){gl_FragColor=vC;}";

  const prFace = gl.createProgram();
  if (!prFace) return empty;
  gl.attachShader(prFace, sh(gl, gl.VERTEX_SHADER, VS_face));
  gl.attachShader(prFace, sh(gl, gl.FRAGMENT_SHADER, FS_face));
  gl.linkProgram(prFace);
  if (!gl.getProgramParameter(prFace, gl.LINK_STATUS)) {
    throw new Error("Face program linking failed: " + gl.getProgramInfoLog(prFace));
  }

  const aP_face = gl.getAttribLocation(prFace, "aP");
  const aC_face = gl.getAttribLocation(prFace, "aC");
  const uMVP_face = gl.getUniformLocation(prFace, "uMVP");
  const uOffset_face = gl.getUniformLocation(prFace, "uOffset");

  // 2. Thickened antialiased line program
  const VS_line = `
    precision mediump float;

    attribute vec3 aP_start;
    attribute vec3 aP_end;
    attribute vec2 aDir;
    attribute vec4 aC;

    uniform mat4 uMVP;
    uniform vec2 uViewportSize;
    uniform float uLineWidth;
    uniform float uFeather;

    varying vec4 vC;
    varying vec2 vLineCoords;
    varying float vSegmentLength;

    void main() {
        vec4 pStart = uMVP * vec4(aP_start, 1.0);
        vec4 pEnd = uMVP * vec4(aP_end, 1.0);

        float nearPlane = 0.01;
        if (pStart.w < nearPlane && pEnd.w < nearPlane) {
            gl_Position = vec4(0.0);
            return;
        }
        if (pStart.w < nearPlane) {
            float t = (nearPlane - pStart.w) / (pEnd.w - pStart.w);
            pStart = mix(pStart, pEnd, t);
        } else if (pEnd.w < nearPlane) {
            float t = (nearPlane - pEnd.w) / (pStart.w - pEnd.w);
            pEnd = mix(pEnd, pStart, t);
        }

        vec2 ndcStart = pStart.xy / pStart.w;
        vec2 ndcEnd = pEnd.xy / pEnd.w;

        vec2 screenStart = (ndcStart + 1.0) * 0.5 * uViewportSize;
        vec2 screenEnd = (ndcEnd + 1.0) * 0.5 * uViewportSize;

        vec2 dir = screenEnd - screenStart;
        float len = length(dir);

        vec2 uDir = vec2(0.0);
        if (len > 0.01) {
            uDir = dir / len;
        } else {
            uDir = vec2(1.0, 0.0);
        }
        vec2 uNormal = vec2(-uDir.y, uDir.x);

        float sideDir = aDir.x;
        float sideNormal = aDir.y;

        float halfWidth = uLineWidth * 0.5 + uFeather;
        vec2 offset = uNormal * (sideNormal * halfWidth) + uDir * (sideDir * uFeather);

        vec4 p = (sideDir < 0.0) ? pStart : pEnd;

        vec2 ndcOffset = (offset / uViewportSize) * 2.0;
        p.xy += ndcOffset * p.w;

        gl_Position = p;
        vC = aC;
        vSegmentLength = len;

        vLineCoords.x = (sideDir < 0.0) ? -uFeather : (len + uFeather);
        vLineCoords.y = sideNormal * halfWidth;
    }
  `;

  const FS_line = `
    precision mediump float;

    varying vec4 vC;
    varying vec2 vLineCoords;
    varying float vSegmentLength;

    uniform float uLineWidth;
    uniform float uFeather;

    void main() {
        float distAcross = abs(vLineCoords.y);
        float alphaAcross = 1.0 - smoothstep(uLineWidth * 0.5, uLineWidth * 0.5 + uFeather, distAcross);

        float distAlong = vLineCoords.x;
        float alphaAlong = 1.0;
        if (distAlong < 0.0) {
            alphaAlong = smoothstep(-uFeather, 0.0, distAlong);
        } else if (distAlong > vSegmentLength) {
            alphaAlong = 1.0 - smoothstep(vSegmentLength, vSegmentLength + uFeather, distAlong);
        }

        gl_FragColor = vec4(vC.rgb, vC.a * alphaAcross * alphaAlong);
    }
  `;

  const prLine = gl.createProgram();
  if (!prLine) return empty;
  gl.attachShader(prLine, sh(gl, gl.VERTEX_SHADER, VS_line));
  gl.attachShader(prLine, sh(gl, gl.FRAGMENT_SHADER, FS_line));
  gl.linkProgram(prLine);
  if (!gl.getProgramParameter(prLine, gl.LINK_STATUS)) {
    throw new Error("Line program linking failed: " + gl.getProgramInfoLog(prLine));
  }

  const aP_start = gl.getAttribLocation(prLine, "aP_start");
  const aP_end = gl.getAttribLocation(prLine, "aP_end");
  const aDir = gl.getAttribLocation(prLine, "aDir");
  const aC_line = gl.getAttribLocation(prLine, "aC");

  const uMVP_line = gl.getUniformLocation(prLine, "uMVP");
  const uViewportSize = gl.getUniformLocation(prLine, "uViewportSize");
  const uLineWidth = gl.getUniformLocation(prLine, "uLineWidth");
  const uFeather = gl.getUniformLocation(prLine, "uFeather");

  // Buffers
  const bP_start = gl.createBuffer();
  const bP_end = gl.createBuffer();
  const bDir = gl.createBuffer();
  const bC = gl.createBuffer();
  const bFP = gl.createBuffer();
  const bFC = gl.createBuffer();

  let mesh = {
    start: new Float32Array(0),
    end: new Float32Array(0),
    dir: new Float32Array(0),
    color: new Float32Array(0),
    n: 0,
  };
  let faceMesh = { V: new Float32Array(0), C: new Float32Array(0), n: 0 };
  let ctr = [0, 0, 0];
  let diag = 1;

  function rebuild() {
    const els = opts.getElements();
    const startArr: number[] = [];
    const endArr: number[] = [];
    const dirArr: number[] = [];
    const colArr: number[] = [];
    const pts: number[][] = [];

    const dirs = [
      [-1.0, -1.0],
      [-1.0, 1.0],
      [1.0, -1.0],
      [1.0, -1.0],
      [-1.0, 1.0],
      [1.0, 1.0],
    ];

    for (const e of els) {
      const c = hex(e.colour);
      const color = [c[0], c[1], c[2], 0.95];

      for (let i = 0; i < 6; i++) {
        startArr.push(e.a[0], e.a[1], e.a[2]);
        endArr.push(e.b[0], e.b[1], e.b[2]);
        dirArr.push(dirs[i][0], dirs[i][1]);
        colArr.push(color[0], color[1], color[2], color[3]);
      }

      pts.push(e.a, e.b);
    }

    mesh = {
      start: new Float32Array(startArr),
      end: new Float32Array(endArr),
      dir: new Float32Array(dirArr),
      color: new Float32Array(colArr),
      n: startArr.length / 3,
    };

    const faces = opts.getFaces ? opts.getFaces() : [];
    const FV: number[] = [];
    const FC: number[] = [];
    for (const f of faces) {
      const c = hex(f.colour);
      const alpha = f.alpha ?? 0.22;
      for (const pt of f.triangles) {
        FV.push(pt[0], pt[1], pt[2]);
        FC.push(c[0], c[1], c[2], alpha);
        pts.push(pt);
      }
    }
    faceMesh = { V: new Float32Array(FV), C: new Float32Array(FC), n: FV.length / 3 };

    const flat = pts.length ? pts : [[0, 0, 0]];
    const mn = [0, 1, 2].map((i) => Math.min(...flat.map((p) => p[i])));
    const mx = [0, 1, 2].map((i) => Math.max(...flat.map((p) => p[i])));
    ctr = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
    diag = Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) || 1;

    gl.bindBuffer(gl.ARRAY_BUFFER, bP_start);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.start, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, bP_end);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.end, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, bDir);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.dir, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, bC);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.color, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, bFP);
    gl.bufferData(gl.ARRAY_BUFFER, faceMesh.V, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, bFC);
    gl.bufferData(gl.ARRAY_BUFFER, faceMesh.C, gl.STATIC_DRAW);
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
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    const cam = opts.getCam();
    const ce = Math.cos(cam.el);
    const se = Math.sin(cam.el);
    const dist = diag * 1.6 * cam.dist;
    const eye = [
      ctr[0] + dist * ce * Math.cos(cam.az),
      ctr[1] + dist * ce * Math.sin(cam.az),
      ctr[2] + dist * se,
    ];
    const mvp = mul(persp(0.7, w / h, diag * 0.02, diag * 12), look(eye, ctr, [0, 0, 1]));

    // 1. Draw shaded solid surfaces
    if (faceMesh.n > 0) {
      gl.useProgram(prFace);
      gl.uniformMatrix4fv(uMVP_face, false, mvp);
      gl.uniform2f(uOffset_face, 0, 0);
      gl.depthMask(false);

      gl.bindBuffer(gl.ARRAY_BUFFER, bFP);
      gl.enableVertexAttribArray(aP_face);
      gl.vertexAttribPointer(aP_face, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, bFC);
      gl.enableVertexAttribArray(aC_face);
      gl.vertexAttribPointer(aC_face, 4, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.TRIANGLES, 0, faceMesh.n);
      gl.depthMask(true);
    }

    // 2. Draw wireframe linework over surfaces with GPU polyline thickening
    if (mesh.n > 0) {
      gl.useProgram(prLine);
      gl.uniformMatrix4fv(uMVP_line, false, mvp);
      gl.uniform2f(uViewportSize, cv.width, cv.height);
      gl.uniform1f(uLineWidth, 2.0); // Crisp 2px line width
      gl.uniform1f(uFeather, 1.0); // 1px antialiasing feather

      gl.bindBuffer(gl.ARRAY_BUFFER, bP_start);
      gl.enableVertexAttribArray(aP_start);
      gl.vertexAttribPointer(aP_start, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, bP_end);
      gl.enableVertexAttribArray(aP_end);
      gl.vertexAttribPointer(aP_end, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, bDir);
      gl.enableVertexAttribArray(aDir);
      gl.vertexAttribPointer(aDir, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, bC);
      gl.enableVertexAttribArray(aC_line);
      gl.vertexAttribPointer(aC_line, 4, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
    }

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
