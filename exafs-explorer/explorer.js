/* =========================================================================
   Dr. XAS — EXAFS Explorer (prototype)
   Client-side EXAFS reduction: pre-edge normalization → AUTOBK-style spline
   background → FT to R-space → Cauchy wavelet, with each stage emitted as a
   structured tool call for agent consumption.
   Cross-validated against Larch on the Cu foil reference in this repo
   (R-space first-shell peak: 2.241 Å in-browser vs 2.240 Å Larch).
   ========================================================================= */
"use strict";

const ETOK = 0.2624682917;          // 2m/ħ² in eV⁻¹ Å⁻²
const CAUCHY_ORDER = 12;

const MAGMA = [
    [0.000, "#000004"], [0.125, "#140e36"], [0.250, "#3b0f70"],
    [0.375, "#641a80"], [0.500, "#8c2981"], [0.625, "#b73779"],
    [0.750, "#de4968"], [0.875, "#f7705c"], [0.940, "#feb078"],
    [1.000, "#fcfdbf"]
];

const K_EDGES = { Ti: 4966, V: 5465, Cr: 5989, Mn: 6539, Fe: 7112, Co: 7709,
    Ni: 8333, Cu: 8979, Zn: 9659, Ga: 10367, Ge: 11103, As: 11867,
    Se: 12658, Zr: 17998, Nb: 18986, Mo: 20000 };

/* ------------------------------ state ---------------------------------- */
const state = {
    label: "", E: [], mu: [], isDemo: true,
    kw: 2, kmin: 2, kmax: 13, dk: 1, rbkg: 1.0,
    res: null,                       // last pipeline result
    digest: null
};

/* --------------------------- small math kit ---------------------------- */
function linspace(a, b, n) { const o = new Array(n); const s = (b - a) / (n - 1); for (let i = 0; i < n; i++) o[i] = a + s * i; return o; }
function argmax(a) { let m = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[m]) m = i; return m; }
function interp1(x, xp, yp) {
    // linear interpolation, xp ascending; clamps at ends
    const out = new Array(x.length);
    let j = 0;
    for (let i = 0; i < x.length; i++) {
        const xv = x[i];
        if (xv <= xp[0]) { out[i] = yp[0]; continue; }
        if (xv >= xp[xp.length - 1]) { out[i] = yp[yp.length - 1]; continue; }
        while (xp[j + 1] < xv) j++;
        const t = (xv - xp[j]) / (xp[j + 1] - xp[j]);
        out[i] = yp[j] * (1 - t) + yp[j + 1] * t;
    }
    return out;
}
function solve(Ain, bin) {
    // Gaussian elimination with partial pivoting; A: n×n, b: n
    const n = bin.length;
    const A = Ain.map(r => r.slice());
    const b = bin.slice();
    for (let c = 0; c < n; c++) {
        let p = c;
        for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
        [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
        const piv = A[c][c] || 1e-12;
        for (let r = c + 1; r < n; r++) {
            const f = A[r][c] / piv;
            for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
            b[r] -= f * b[c];
        }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) {
        let s = b[r];
        for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
        x[r] = s / (A[r][r] || 1e-12);
    }
    return x;
}
function lstsq(B, y, w) {
    // weighted least squares: B (m×p), y (m), w (m) → coef (p)
    const m = y.length, p = B[0].length;
    const AtA = Array.from({ length: p }, () => new Array(p).fill(0));
    const Atb = new Array(p).fill(0);
    for (let i = 0; i < m; i++) {
        const wi = w ? w[i] * w[i] : 1;
        for (let a = 0; a < p; a++) {
            Atb[a] += wi * B[i][a] * y[i];
            for (let b = a; b < p; b++) AtA[a][b] += wi * B[i][a] * B[i][b];
        }
    }
    for (let a = 0; a < p; a++) for (let b = 0; b < a; b++) AtA[a][b] = AtA[b][a];
    for (let a = 0; a < p; a++) AtA[a][a] += 1e-9;   // tiny ridge
    return solve(AtA, Atb);
}

/* ------------------------------ parsing -------------------------------- */
function parseScan(text) {
    const lines = text.split(/\r?\n/);
    const cols = {};                                  // XDI column labels
    const rows = [];
    for (const ln of lines) {
        const t = ln.trim();
        if (!t) continue;
        if (t.startsWith("#")) {
            const m = t.match(/#\s*Column\.(\d+)\s*:\s*(\S+)/i);
            if (m) cols[parseInt(m[1], 10) - 1] = m[2].toLowerCase();
            continue;
        }
        const p = t.split(/[\s,;]+/).map(Number);
        if (p.length >= 2 && p.every(v => Number.isFinite(v))) rows.push(p);
    }
    if (rows.length < 30) throw new Error("Could not find enough numeric rows (need ≥ 30).");
    const nc = rows[0].length;
    const col = i => rows.map(r => r[i]);
    let E, mu, how;
    const find = name => Object.keys(cols).find(i => cols[i].includes(name));
    const iE = find("energy") ?? 0;
    const iMu = find("mu");
    const iI0 = find("i0"), iIt = find("itrans");
    if (iMu !== undefined) { E = col(+iE); mu = col(+iMu); how = `XDI column "${cols[iMu]}"`; }
    else if (iI0 !== undefined && iIt !== undefined) {
        E = col(+iE); mu = rows.map(r => Math.log(r[+iI0] / r[+iIt])); how = "ln(i0/itrans) from XDI columns";
    }
    else if (nc === 2) { E = col(0); mu = col(1); how = "2-column (E, μ)"; }
    else { E = col(0); mu = col(nc - 1); how = `columns 1 & ${nc} (E, μ assumed)`; }
    // sort by E, drop duplicates
    const idx = E.map((_, i) => i).sort((a, b) => E[a] - E[b]);
    const Es = [], mus = [];
    for (const i of idx) { if (Es.length && E[i] - Es[Es.length - 1] < 1e-6) continue; Es.push(E[i]); mus.push(mu[i]); }
    return { E: Es, mu: mus, how, nc };
}

/* ----------------------------- pipeline -------------------------------- */
function runPipeline(E, mu, opts, trace) {
    const t0 = performance.now();
    const tc = (name, args, started) =>
        trace && trace(name, args, Math.max(1, Math.round(performance.now() - started)));

    /* 1 — E0 by max derivative */
    let t = performance.now();
    const dmu = E.map((_, i) => {
        if (i === 0 || i === E.length - 1) return 0;
        return (mu[i + 1] - mu[i - 1]) / (E[i + 1] - E[i - 1]);
    });
    const iE0 = argmax(dmu);
    const E0 = E[iE0];
    tc("find_e0", { method: "max_derivative", e0_eV: +E0.toFixed(2) }, t);

    /* 2 — pre-edge line */
    t = performance.now();
    let lo = E0 - 150, hi = E0 - 40;
    let m = E.map((e, i) => e >= lo && e <= hi ? i : -1).filter(i => i >= 0);
    if (m.length < 4) { m = E.map((e, i) => e < E0 - 20 ? i : -1).filter(i => i >= 0); }
    const cPre = lstsq(m.map(i => [1, E[i]]), m.map(i => mu[i]));
    const preL = E.map(e => cPre[0] + cPre[1] * e);
    tc("fit_pre_edge", { range_eV: [+ (E0 - 150).toFixed(0), +(E0 - 40).toFixed(0)], slope: +cPre[1].toExponential(2) }, t);

    /* 3 — post-edge quadratic & edge step */
    t = performance.now();
    let m2 = E.map((e, i) => e >= E0 + 120 ? i : -1).filter(i => i >= 0);
    if (m2.length < 6) m2 = E.map((e, i) => e >= E0 + 40 ? i : -1).filter(i => i >= 0);
    const cPost = lstsq(m2.map(i => [1, E[i], E[i] * E[i]]), m2.map(i => mu[i] - preL[i]));
    const postAt = e => cPost[0] + cPost[1] * e + cPost[2] * e * e;
    const edgeStep = postAt(E0);
    const munorm = mu.map((v, i) => (v - preL[i]) / edgeStep);
    tc("normalize", { edge_step: +edgeStep.toFixed(4) }, t);

    /* 4 — uniform k grid */
    t = performance.now();
    const maskI = E.map((e, i) => e >= E0 ? i : -1).filter(i => i >= 0);
    const kRaw = maskI.map(i => Math.sqrt(ETOK * (E[i] - E0)));
    const yRaw = maskI.map(i => munorm[i]);
    const kDataMax = Math.min(kRaw[kRaw.length - 1], 17.5);
    const nk = Math.floor(kDataMax / 0.05) + 1;
    const kg = linspace(0, 0.05 * (nk - 1), nk);
    const yk = interp1(kg, kRaw, yRaw);
    tc("k_grid", { dk: 0.05, k_max: +kDataMax.toFixed(2) }, t);

    /* 5 — AUTOBK-style spline background */
    t = performance.now();
    const dknot = Math.PI / (2 * opts.rbkg);
    const knots = [];
    for (let kk = dknot; kk < kg[nk - 1] - 0.5 * dknot; kk += dknot) knots.push(kk);
    const B = kg.map(k => {
        const row = [1, k, k * k, k * k * k];
        for (const kt of knots) { const u = Math.max(0, k - kt); row.push(u * u * u); }
        return row;
    });
    const wfit = kg.map(k => Math.max(k, 0.2));
    const coef = lstsq(B, yk, wfit);
    const bkg = B.map(r => r.reduce((s, v, j) => s + v * coef[j], 0));
    const chi = yk.map((v, i) => v - bkg[i]);
    tc("autobk_spline", { rbkg_A: opts.rbkg, knot_spacing_A_inv: +dknot.toFixed(3), n_knots: knots.length }, t);

    /* 6 — FT window (Hanning sills) + FT to R-space */
    t = performance.now();
    const { kmin, kmax, dk, kw } = opts;
    const win = kg.map(k => {
        if (k < kmin - dk / 2 || k > kmax + dk / 2) return 0;
        if (k < kmin + dk / 2) { const s = Math.sin(Math.PI / 2 * (k - (kmin - dk / 2)) / dk); return s * s; }
        if (k > kmax - dk / 2) { const c = Math.cos(Math.PI / 2 * (k - (kmax - dk / 2)) / dk); return c * c; }
        return 1;
    });
    const integ = chi.map((v, i) => v * Math.pow(kg[i], kw) * win[i]);
    const nR = 327;
    const Rg = linspace(0, 10, nR);
    const chiR = new Array(nR);
    const dkg = kg[1] - kg[0], norm = dkg / Math.sqrt(Math.PI);
    for (let r = 0; r < nR; r++) {
        let re = 0, im = 0;
        const tr = 2 * Rg[r];
        for (let i = 0; i < nk; i++) {
            const ph = tr * kg[i];
            re += integ[i] * Math.cos(ph);
            im += integ[i] * Math.sin(ph);
        }
        chiR[r] = Math.hypot(re, im) * norm;
    }
    tc("xftf", { kmin, kmax, dk, kweight: kw, window: "hanning" }, t);

    /* 7 — Cauchy wavelet |W(k,R)| */
    t = performance.now();
    const wkN = Math.floor(nk / 2);
    const wk = new Array(wkN); for (let i = 0; i < wkN; i++) wk[i] = kg[2 * i];
    const wR = linspace(0.05, 10, 160);
    const f = chi.map((v, i) => v * Math.pow(kg[i], kw));
    const np1 = CAUCHY_ORDER + 1;
    const Z = [];
    let zmax = 0;
    for (let r = 0; r < wR.length; r++) {
        const a = CAUCHY_ORDER / (2 * wR[r]);
        const row = new Array(wkN);
        for (let c = 0; c < wkN; c++) {
            let re = 0, im = 0;
            const k0 = wk[c];
            for (let i = 0; i < nk; i++) {
                const x = (kg[i] - k0) / a;
                const amp = Math.exp(-0.5 * np1 * Math.log1p(x * x));
                if (amp < 1e-5) continue;
                const ph = np1 * Math.atan(x);
                re += f[i] * amp * Math.cos(ph);
                im += f[i] * amp * Math.sin(ph);
            }
            const v = Math.hypot(re, im) / a;
            row[c] = v;
            if (v > zmax) zmax = v;
        }
        Z.push(row);
    }
    if (zmax > 0) for (const row of Z) for (let c = 0; c < row.length; c++) row[c] = +(row[c] / zmax).toFixed(4);
    tc("cauchy_wavelet", { order: CAUCHY_ORDER, kweight: kw, rmax_out: 10 }, t);

    tc("pipeline_done", { total_ms: Math.round(performance.now() - t0) }, t0);
    return { E, mu, preL, postAt, E0, edgeStep, munorm, kg, yk, bkg, chi, win, Rg, chiR, wk, wR, Z };
}

/* ------------------------------ digest --------------------------------- */
function findPeaks(x, y, minX) {
    const pk = [];
    for (let i = 1; i < y.length - 1; i++) {
        if (x[i] < minX) continue;
        if (y[i] > y[i - 1] && y[i] >= y[i + 1]) pk.push({ R: +x[i].toFixed(3), mag: +y[i].toFixed(3) });
    }
    return pk.sort((a, b) => b.mag - a.mag).slice(0, 3).sort((a, b) => a.R - b.R);
}
function guessEdge(E0) {
    let best = null;
    for (const [el, e] of Object.entries(K_EDGES)) {
        const d = Math.abs(E0 - e);
        if (d < 35 && (!best || d < best.d)) best = { element: el, edge: "K", tabulated_eV: e, d };
    }
    return best ? { element: best.element, edge: best.edge, tabulated_eV: best.tabulated_eV } : null;
}
function buildDigest(st) {
    const r = st.res;
    const peaks = findPeaks(r.Rg, r.chiR, 0.8);
    // noise floor: mean |chi(R)| in 8–10 Å
    let nf = 0, nn = 0;
    for (let i = 0; i < r.Rg.length; i++) if (r.Rg[i] >= 8) { nf += r.chiR[i]; nn++; }
    nf = nn ? nf / nn : 0;
    const sig = peaks.length ? peaks.reduce((m, p) => Math.max(m, p.mag), 0) : 0;
    // wavelet global max
    let wm = { k: 0, R: 0, v: 0 };
    for (let a = 0; a < r.wR.length; a++) for (let b = 0; b < r.wk.length; b++)
        if (r.Z[a][b] > wm.v) wm = { k: r.wk[b], R: r.wR[a], v: r.Z[a][b] };
    const edge = guessEdge(r.E0);
    const hints = [];
    if (edge) hints.push(`Edge energy ${r.E0.toFixed(1)} eV is consistent with the ${edge.element} ${edge.edge}-edge (${edge.tabulated_eV} eV).`);
    if (peaks.length) hints.push(`Dominant uncorrected first-shell peak at R = ${peaks.reduce((m, p) => p.mag > m.mag ? p : m).R} Å; apply Δ ≈ +0.3–0.5 Å phase correction before bond-length interpretation.`);
    hints.push(`Wavelet maximum at (k ≈ ${wm.k.toFixed(1)} Å⁻¹, R ≈ ${wm.R.toFixed(2)} Å); k-position discriminates light vs heavy backscatterers.`);
    if (sig && nf) hints.push(`R-space signal/noise-floor ≈ ${(sig / nf).toFixed(0)}; data quality ${sig / nf > 50 ? "excellent" : sig / nf > 15 ? "good" : "limited — consider narrowing the FT window"}.`);
    return {
        schema: "drxas.spectrum_digest/0.1",
        generated_by: "exafs-explorer (in-browser pipeline)",
        source: { label: st.label, n_points: r.E.length, energy_range_eV: [+r.E[0].toFixed(1), +r.E[r.E.length - 1].toFixed(1)] },
        edge: { e0_eV: +r.E0.toFixed(2), edge_step: +r.edgeStep.toFixed(4), assignment: edge },
        processing: {
            normalization: "pre-edge linear + post-edge quadratic",
            background: { method: "least-squares cubic spline (AUTOBK-style)", rbkg_A: st.rbkg },
            fourier_transform: { kmin: st.kmin, kmax: st.kmax, dk: st.dk, kweight: st.kw, window: "hanning" },
            wavelet: { type: "cauchy", order: CAUCHY_ORDER }
        },
        r_space_peaks_uncorrected_A: peaks,
        wavelet_maximum: { k_A_inv: +wm.k.toFixed(2), R_A: +wm.R.toFixed(2) },
        quality: { high_R_noise_floor: +nf.toFixed(4), peak_to_noise: nf ? +(sig / nf).toFixed(1) : null },
        agent_hints: hints
    };
}

/* ------------------------------ plotting ------------------------------- */
const FONT = { family: "Outfit, Roboto, sans-serif", color: "#1f1f1f" };
const LAYOUT = {
    template: "plotly_white", font: FONT, margin: { l: 56, r: 16, t: 10, b: 44 },
    paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", showlegend: true,
    legend: { orientation: "h", y: 1.12, font: { size: 11 } }
};
const CFG = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ["lasso2d", "select2d"] };

function drawAll() {
    const r = state.res, D = window.DRXAS_DATA;
    const overlay = document.getElementById("larch-overlay").checked && state.isDemo;

    /* E-space */
    const eTr = [
        { x: r.E, y: r.mu, name: "μ(E)", line: { color: "#3b0f70", width: 2 } },
        { x: r.E, y: r.preL, name: "pre-edge", line: { color: "#9aa0a6", width: 1.4, dash: "dot" } },
        { x: r.E, y: r.E.map((e, i) => r.preL[i] + r.postAt(e)), name: "post-edge", line: { color: "#9aa0a6", width: 1.4, dash: "dash" } }
    ];
    Plotly.react("plot-e", eTr, { ...LAYOUT,
        xaxis: { title: "Energy (eV)" }, yaxis: { title: "μ(E)" },
        shapes: [{ type: "line", x0: r.E0, x1: r.E0, y0: 0, y1: 1, yref: "paper",
                   line: { color: "#f7705c", width: 1.5, dash: "dot" } }],
        annotations: [{ x: r.E0, y: 1.04, yref: "paper", text: `E₀ = ${r.E0.toFixed(1)} eV`,
                        showarrow: false, font: { size: 11, color: "#f7705c" } }] }, CFG);

    /* k-space */
    const kwChi = r.chi.map((v, i) => v * Math.pow(r.kg[i], state.kw));
    const winMax = Math.max(...kwChi.map(Math.abs)) || 1;
    const kTr = [
        { x: r.kg, y: kwChi, name: `k${["¹","²","³"][state.kw-1]}·χ(k) (in-browser)`, line: { color: "#b73779", width: 2 } },
        { x: r.kg, y: r.win.map(v => v * winMax), name: "FT window", line: { color: "#9aa0a6", width: 1.2, dash: "dot" }, fill: "tozeroy", fillcolor: "rgba(95,99,104,0.06)" }
    ];
    if (overlay && state.kw === 2)
        kTr.push({ x: D.larch.k, y: D.larch.k2chi, name: "Larch reference", line: { color: "#1f1f1f", width: 1.2, dash: "dash" } });
    Plotly.react("plot-k", kTr, { ...LAYOUT, xaxis: { title: "k (Å⁻¹)", range: [0, r.kg[r.kg.length - 1]] }, yaxis: { title: `k${["¹","²","³"][state.kw-1]}·χ(k)` } }, CFG);

    /* R-space */
    const rTr = [{ x: r.Rg, y: r.chiR, name: "|χ(R)| (in-browser)", line: { color: "#de4968", width: 2 } }];
    if (overlay && state.kw === 2 && state.kmin === 2 && state.kmax === 13)
        rTr.push({ x: D.larch.R, y: D.larch.chiR, name: "Larch reference", line: { color: "#1f1f1f", width: 1.2, dash: "dash" } });
    Plotly.react("plot-r", rTr, { ...LAYOUT, xaxis: { title: "R (Å)", range: [0, 6] }, yaxis: { title: "|χ(R)| (Å⁻³)" } }, CFG);

    /* Wavelet */
    const useLarchW = overlay && state.kw === 2;
    const wx = useLarchW ? D.larch.wavelet.k : r.wk;
    const wy = useLarchW ? D.larch.wavelet.R : r.wR;
    const wz = useLarchW ? D.larch.wavelet.z : r.Z;
    const is3d = document.getElementById("wavelet-3d").checked;
    const wTr = is3d
        ? [{ type: "surface", x: wx, y: wy, z: wz, colorscale: MAGMA, showscale: false }]
        : [{ type: "heatmap", x: wx, y: wy, z: wz, colorscale: MAGMA,
             colorbar: { title: "|W|", thickness: 12, len: 0.85 } }];
    const wLayout = is3d
        ? { ...LAYOUT, showlegend: false, margin: { l: 0, r: 0, t: 0, b: 0 },
            scene: { xaxis: { title: "k (Å⁻¹)" }, yaxis: { title: "R (Å)" }, zaxis: { title: "|W|" } } }
        : { ...LAYOUT, showlegend: false, xaxis: { title: "k (Å⁻¹)" }, yaxis: { title: "R (Å)", range: [0, 6] } };
    Plotly.react("plot-w", wTr, wLayout, CFG);
    document.querySelector("#plot-w").closest(".plot-card").querySelector(".plot-sub").textContent =
        useLarchW ? "Cauchy wavelet |W(k, R)| · Larch reference matrix · magma colormap"
                  : "Cauchy wavelet |W(k, R)| · computed in-browser · magma colormap";
}

/* ----------------------------- trace UI -------------------------------- */
const traceEl = document.getElementById("trace");
function clearTrace() { traceEl.innerHTML = ""; }
function pushTrace(name, args, ms) {
    const div = document.createElement("div");
    div.innerHTML = `<span class="tc-name">${name}</span><span class="tc-args">(${JSON.stringify(args)})</span> <span class="tc-ms">· ${ms} ms</span>`;
    traceEl.appendChild(div);
    traceEl.scrollTop = traceEl.scrollHeight;
}

/* ----------------------------- orchestration --------------------------- */
function recompute() {
    clearTrace();
    pushTrace("load_scan", { label: state.label, points: state.E.length }, 1);
    state.res = runPipeline(state.E, state.mu, state, pushTrace);
    state.digest = null;
    document.getElementById("digest").textContent = "// click “Generate agent digest”";
    document.getElementById("btn-copy").disabled = true;
    drawAll();
}
function loadDemo() {
    const D = window.DRXAS_DATA;
    state.label = D.label; state.isDemo = true;
    state.E = D.raw.E; state.mu = D.raw.mu;
    document.getElementById("dataset-label").textContent =
        `Demo dataset: ${D.label}, raw transmission scan from this repository.`;
    recompute();
}
function loadUser(name, text) {
    try {
        const p = parseScan(text);
        state.label = name; state.isDemo = false;
        state.E = p.E; state.mu = p.mu;
        document.getElementById("dataset-label").textContent =
            `Loaded ${name} · ${p.E.length} points · parsed as ${p.how}. Larch overlay disabled (Cu demo only).`;
        recompute();
    } catch (err) {
        document.getElementById("dataset-label").textContent = `Could not parse ${name}: ${err.message}`;
    }
}

/* ----------------------------- wire up UI ------------------------------ */
document.getElementById("btn-run-demo").addEventListener("click", loadDemo);
document.getElementById("file-input").addEventListener("change", e => {
    const f = e.target.files[0];
    if (f) f.text().then(t => loadUser(f.name, t));
});
["dragenter", "dragover"].forEach(ev => document.body.addEventListener(ev, e => { e.preventDefault(); document.body.classList.add("dragging"); }));
["dragleave", "drop"].forEach(ev => document.body.addEventListener(ev, e => { e.preventDefault(); if (ev === "drop" || e.target === document.body) document.body.classList.remove("dragging"); }));
document.body.addEventListener("drop", e => {
    const f = e.dataTransfer.files[0];
    if (f) f.text().then(t => loadUser(f.name, t));
});

document.querySelectorAll("#kw-seg button").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll("#kw-seg button").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    state.kw = +b.dataset.kw;
    recompute();
}));
function syncWin() {
    let a = +document.getElementById("kmin").value, b = +document.getElementById("kmax").value;
    if (b - a < 2) { b = a + 2; document.getElementById("kmax").value = b; }
    state.kmin = a; state.kmax = b;
    document.getElementById("kwin-label").textContent = `k = ${a.toFixed(1)} – ${b.toFixed(1)} Å⁻¹`;
}
["kmin", "kmax"].forEach(id => document.getElementById(id).addEventListener("change", () => { syncWin(); recompute(); }));
document.getElementById("rbkg").addEventListener("change", e => {
    state.rbkg = +e.target.value;
    document.getElementById("rbkg-label").textContent = `${state.rbkg.toFixed(1)} Å`;
    recompute();
});
document.getElementById("larch-overlay").addEventListener("change", drawAll);
document.getElementById("wavelet-3d").addEventListener("change", drawAll);

document.getElementById("btn-digest").addEventListener("click", () => {
    state.digest = buildDigest(state);
    pushTrace("spectrum_digest", { schema: state.digest.schema, hints: state.digest.agent_hints.length }, 1);
    document.getElementById("digest").textContent = JSON.stringify(state.digest, null, 2);
    document.getElementById("btn-copy").disabled = false;
});
document.getElementById("btn-copy").addEventListener("click", () => {
    navigator.clipboard.writeText(JSON.stringify(state.digest, null, 2));
    const b = document.getElementById("btn-copy");
    b.textContent = "Copied ✓"; setTimeout(() => b.textContent = "Copy JSON", 1400);
});

/* boot */
loadDemo();
