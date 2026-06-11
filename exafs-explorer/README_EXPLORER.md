# EXAFS Explorer — a drop-in interactive page for the Dr. XAS website

A zero-install, fully client-side EXAFS reduction and visualization page built in the
Dr. XAS design language (per `DESIGN.md`). It turns the static `EXAFS_plotting`
notebook into a live, interactive web tool, and adds an "agent view" that shows how
each pipeline stage becomes a structured tool call for the Dr. XAS agentic platform.

## What it does

1. **Full in-browser EXAFS pipeline (pure JavaScript, no server, no Python):**
   raw μ(E) → E₀ (max derivative) → pre-edge linear / post-edge quadratic
   normalization → AUTOBK-style least-squares cubic-spline background (Rbkg knot
   spacing π/2Rbkg) → Hanning-window FT to R-space → Cauchy wavelet |W(k,R)|.

2. **Cross-validated against Larch** using the reference outputs already in this
   repo (`EXAFS_plot_data_txt/`), with the same parameters as the notebook
   (autobk rbkg=1.0 kweight=2; xftf kmin=2, kmax=13, dk=1, kweight=2):
   - R-space first-shell peak: **2.239 Å (in-browser) vs 2.240 Å (Larch)**
   - k²χ(k) NRMSE over k = 3–12 Å⁻¹: **5.1%** (window-function differences)
   - A "Larch reference" overlay toggle shows the comparison live on the plots.

3. **Interactive controls:** k-weight (k¹/k²/k³), FT window range, Rbkg, 2D/3D
   Cauchy wavelet (magma colormap, matching the brand), all recomputed live
   (~0.6 s for the full pipeline including the wavelet).

4. **Bring your own data:** drag-and-drop any XDI / two-column / i0-itrans scan;
   the parser auto-detects the format and runs the same pipeline.

5. **Agent view:** every stage is logged as a tool call (`find_e0`, `autobk_spline`,
   `xftf`, `cauchy_wavelet`, ...) with parameters and timing, and a
   `spectrum_digest.json` (schema `drxas.spectrum_digest/0.1`) is generated with
   E₀, edge assignment, uncorrected R-space peaks, wavelet maximum, quality
   metrics, and natural-language hints. This is the deterministic feature-extraction
   layer an LLM agent would consume instead of raw arrays or pixels.

## Files

- `explorer.html` — the page (links back to `index.html`)
- `explorer.css` — styling per `DESIGN.md` tokens (magma gradient, pills, soft shadows)
- `explorer.js` — pipeline, plots (Plotly via CDN), agent trace and digest
- `explorer_data.js` — embedded Cu foil raw scan + Larch reference outputs
  (generated from files already in this repo; 0.22 MB)

## Run it

Drop the four files into the repo root (next to `index.html`) and:

```bash
python3 -m http.server 8080
# open http://localhost:8080/explorer.html
```

Works as-is on GitHub Pages. To link it from the landing page, add one entry to the
"Dr. XAS Suite" mega-menu in `index.html`:

```html
<a href="explorer.html" class="mega-link mega-compact">
  <div class="mega-content-row">
    <span class="mega-title magma-color-2">EXAFS Explorer</span>
    <span class="mega-desc">Interactive in-browser EXAFS reduction and wavelet analysis.</span>
  </div>
</a>
```

## Why this design

The reduction math is deliberately deterministic and lives client-side; the LLM never
touches numerics. The agent's role is to call these tools and reason over the digest,
which is the architecture that scales to the beamline: the same tool-call contract
demonstrated here in the browser maps one-to-one onto MCP/agent-framework tools on
the analysis cluster, with the digest schema as the interface between physics code
and language models.

— Ishraque Zaman Borshon
