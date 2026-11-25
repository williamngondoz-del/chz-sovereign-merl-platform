# Coalition Health Zambia (CHZ) — Sovereign MERL & Public Intelligence Platform

An international-grade, interactive web platform built for **Coalition Health Zambia (CHZ)** on behalf of **EMCA Consultancy** and **Digital Labs**.

All 7 screens share a single reactive **Zustand** store, enforcing a live end-to-end custody chain across all 6 EMCA Technical Proposal Workstreams — from Portfolio & Donor Governance to Field Intake, MERL period locks, Knowledge & Consent Management, **Zambia Data Protection Act No. 3 of 2021** privacy screening (`n >= 10`, automated Zambian PII detection), versioned public CMS publication (`coalitionhealth.org.zm`), and a FIPS 180-4 SHA-256 hash-chained CAT (`Africa/Lusaka`) session audit trail.

---

## Architecture & Key Capabilities

- **Bespoke CHZ Sovereign Public Health Design System**: Clinical Mist (`#F4F8F7`), Pure Clinical White (`#FFFFFF`), Midnight Zambezi Teal (`#072A2E`), Zambian Health Emerald (`#0B7A5C` / `#14B88A`), Clinical Cobalt & Aqua (`#0E6B8A` / `#38BDF8`), and Zambian Sunburst Amber (`#D97706` / `#F59E0B`) with **Instrument Serif**, **Plus Jakarta Sans**, and **JetBrains Mono**.
- **Digital Labs Ambient Motion & Interactive Craft**:
  - 4-layer ambient backdrop (drifting clinical particles, diagonal flash sweep, floating emerald/cobalt glows, and counter-rotating orbital rings with glowing satellite nodes).
  - Pointer-events-none **Canvas 2D twinkling emerald mint & aqua starlight sparkle overlay** in the Midnight Zambezi Teal command header.
  - **Cursor-tracking emerald specular highlights** on Executive KPI cards and `.flash-sheen-btn` hover light sweeps on primary actions.
  - Top-bar **Active Role Switcher** (6 CHZ least-privilege roles including `IT Admin` with keyboard-safe **MFA Step-Up**, 3-attempt lockout, and live session TTL countdown) and clean in-page toast notifications.
  - Low-bandwidth **2D Zambia Provincial Map** default with lazy-loaded **Three.js / React Three Fiber 3D Sovereign Health Globe**, mobile responsive down to **360px**.
- **7 State-Synced Screens (All 6 Technical Proposal Workstreams)**:
  1. **Executive Command & Footprint**: Live KPI strip, 2D Low-Bandwidth Zambia Map + lazy 3D Sovereign Health Globe across all **10 Zambian provinces**, province filter pills, live **Recharts** Target (`#D97706`) vs. Achieved (`#0B7A5C`) chart, and 4-format exports (CSV, Excel `.xlsx`, Printable PDF, Editable Word `.docx`).
  2. **Portfolio & Donors (WS1 & WS2)**: Institutional org/expert profiles, active partner & district registers, grant obligations, reporting calendar, and partner engagement history.
  3. **Field Intake (WS3 & WS5)**: Programme Officer submission form with live disaggregation sum guard, automated **Zambian PII scanner** (NRC, `+260` phones, patient IDs), beneficiary segregation, and real Web Crypto `SHA-256` file digest verification.
  4. **MERL Verification Gate (WS3)**: Reviewer queue with MFA-gated **Approve & Lock Period**, **Return for Revision**, **Log Traceable Revision** (before/after immutable diff), and combined numerator/denominator roll-up math.
  5. **Knowledge & Media Library (WS4)**: Searchable asset vault with automated consent-expiry blocking, attribution/versioning, and editable factsheet/brief template generation.
  6. **Controlled Public CMS Feed (WS6)**: Read-only synchronized publication store with automated DPA small-cell screening (`n >= 10`), side-by-side version diff inspector, and MFA-gated **Publish / Withdraw Instantly** toggle updating the live `coalitionhealth.org.zm` preview.
  7. **Audit Trail, RBAC, Migration & 8-Week Plan**: Live SHA-256 hash-chained CAT audit log with **Verify Audit Chain Integrity** check, 6-role RBAC matrix, Gate 3 Legacy Migration Profiler & SHA-256 Backup/Restore drills, and interactive `01–09` 8-Week Build + 12-Week Warranty timeline.

---

## Local Development

```bash
npm install
npm run dev
```

Build and verify production bundle locally:

```bash
npm run build
npm run preview
```

---

## GitHub Repository

- **Repository**: `https://github.com/williamngondoz-del/chz-sovereign-merl-platform`

```bash
git add .
git commit -m "feat: update CHZ Sovereign MERL platform"
git push -u origin main
```

---

## Zero-Config Vercel & Netlify Deployment

### Vercel (Primary Production Host)

This repository includes [`vercel.json`](./vercel.json) preconfigured for Vite (`framework: "vite"`, `buildCommand: "npm run build"`, `outputDirectory: "dist"`, Node `22.x`), SPA rewrites (`/* -> /index.html`), immutable 1-year Edge caching on `/assets/*`, strict VibeSec security headers (`CSP`, `HSTS`, `X-Frame-Options: DENY`), and zero eager Three.js preloading for fast mobile loading.

- Every push to `main` automatically rebuilds and updates the live Vercel deployment (`https://emca-chz-merl.vercel.app`).

### Netlify (Alternative Host)

This repository also includes [`netlify.toml`](./netlify.toml) preconfigured with `npm run build`, publish directory `dist`, Node 22, VibeSec security headers, and SPA fallback (`/* -> /index.html 200`).

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/williamngondoz-del/chz-sovereign-merl-platform)


