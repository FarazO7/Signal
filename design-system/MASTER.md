# Signal — Design System (MASTER)

> Persisted so the look stays consistent across sessions. The **implementation**
> lives in [`src/app/globals.css`](../src/app/globals.css); this file explains
> the intent and the rules. If the two ever disagree, the CSS wins — update this.

**Aesthetic:** accessible **Neumorphism** ("skin, not skeleton"). Soft, tactile
surfaces that look extruded from / pressed into one low-saturation background.
Applied as a **premium accent** (cards, panels, toggles, secondary controls),
never as the whole interface. Data-dense areas use flat, high-contrast surfaces.

**Light theme is primary.** Dark mode is deferred until the light theme is solid
(neumorphism is hard to do well in dark mode).

---

## 1. The neumorphic recipe

Same-color background + two shadows, **top-left light source**:

```css
/* Raised (extruded) */
box-shadow: 8px 8px 18px var(--nm-dark), -8px -8px 18px var(--nm-light);
/* Pressed (inset) */
box-shadow: inset 5px 5px 11px var(--nm-dark), inset -5px -5px 11px var(--nm-light);
```

- Light shadow (`--nm-light`, near-white) sits **top-left**; dark shadow
  (`--nm-dark`) sits **bottom-right**. Keep this direction everywhere.
- The surface and the page background must be the **same color** (`--surface` ===
  `--bg`) — that's what makes it read as extruded rather than as a floating card.

Utility classes: `.nm-raised`, `.nm-raised-sm`, `.nm-inset`.

---

## 2. Color tokens

| Token | Value | Role |
|---|---|---|
| `--bg` / `--surface` | `#e7ebf2` | Neumorphic canvas (shared color) |
| `--surface-flat` | `#f7f9fc` | Flat surface for tables / dense text |
| `--line` | `#d3d9e4` | Hairline borders on flat surfaces |
| `--ink` | `#1e2530` | Primary text (~12:1 on canvas) |
| `--ink-muted` | `#4c5564` | Secondary text (~6:1) |
| `--ink-subtle` | `#5b6473` | Tertiary labels (~5:1, AA for text) |
| `--accent` | `#4f46e5` | Primary actions, links, focus ring |
| `--accent-hover` | `#4338ca` | Primary hover |
| `--accent-ink` | `#ffffff` | Text on accent (~6.3:1) |
| `--sev-4 … --sev-1` | `#b91c1c` / `#b23c0c` / `#854d0e` / `#475569` | Severity ramp (critical→low), all ≥4.5:1 |
| `--pos` / `--neu` / `--neg` | `#166534` / `#475569` / `#b91c1c` | Sentiment, all ≥4.5:1 |

**Severity and sentiment colors never carry meaning alone** — they always pair
with a text label or icon (see badges). They are deliberately darkened so the
small (12px) badge text meets WCAG AA on the canvas; the label, not the hue,
is the primary signal.

---

## 3. Typography

- **Sans:** Geist (`--font-sans`), via `next/font` — no layout-shift, self-hosted.
- **Mono:** Geist Mono (`--font-mono`) for IDs, scores, JSON traces.
- Scale (Tailwind): page title `text-3xl/4xl`, section `text-sm uppercase
  tracking-wide` eyebrows, body `text-base`/`text-sm`, meta `text-xs`.
- Weight: 600–700 for headings/controls, 400 for body. Tight tracking on headings.

---

## 4. Components

| Component | Class | Rule |
|---|---|---|
| Card / panel | `.nm-raised`, `.nm-raised-sm` | Chrome only, not data tables |
| Input well / selected | `.nm-inset` | Pressed look |
| **Primary button** | `.btn-primary` | **FLAT + filled accent.** Never neumorphic |
| Secondary / toggle | `.btn-soft` | Neumorphic; `:active`/`[data-pressed]` → inset **and** accent text |
| Badge | `.badge` + `text-sev-*`/`text-pos`/… | Border + tint from `currentColor`; always has a label |
| Data table | `.surface-flat` | Flat, high contrast, hairline rows |

Radii: `--r-sm 10px` (controls), `--r-md 16px` (panels), `--r-lg 22px` (hero cards).
Motion: `--t-fast 160ms`, `--t 220ms`, ease `cubic-bezier(.2,.8,.2,1)`.

---

## 5. Accessibility guardrails (non-negotiable)

These are what make the style read as senior, not dated. Baked into `globals.css`:

- [x] **Primary actions are flat + filled accent** — never a low-contrast neumorphic button.
- [x] **`:focus-visible`** outline (2px accent, 2px offset) on every interactive element.
- [x] **State never relies on shadow alone** — shadow shift is always paired with a color/icon change (e.g. `.btn-soft` pressed → accent text).
- [x] **Dense data uses flat surfaces** (`.surface-flat`), not neumorphic ones.
- [x] **WCAG contrast** — ≥ 4.5:1 text, ≥ 3:1 non-text UI. Ink + accent tokens chosen to pass.
- [x] **`prefers-reduced-motion`** honored; transitions kept 150–300ms otherwise.
- [x] **Light theme first**; dark mode only after light is solid.

### Pre-delivery checklist (run before calling the UI done — Phase 5)

- [ ] Contrast audit on every text/background pair (4.5:1) and UI component (3:1).
- [ ] Keyboard-only pass: every control reachable and visibly focused.
- [ ] Reduced-motion pass: no essential info conveyed only by motion.
- [ ] Responsive at 375 / 768 / 1024 / 1440 px.
- [ ] No state communicated by shadow (or color) alone.
- [ ] Tables/dense text remain flat and legible.
