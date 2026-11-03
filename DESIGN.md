---
name: reportAi
description: Document-AI workspace where every extracted value and every answer can be traced to its source.
colors:
  ground: "#f6f6f4"
  surface: "#ffffff"
  surface-sunken: "#f3f3f1"
  surface-pressed: "#ebebe8"
  hairline: "#e6e6e2"
  hairline-strong: "#d6d6d1"
  ink-text: "#17171a"
  text-secondary: "#4d4d55"
  text-tertiary: "#6c6c75"
  primary-ink: "#17171a"
  primary-ink-hover: "#2e2e33"
  citation-blue: "#2557d6"
  citation-blue-text: "#1d47b3"
  citation-blue-soft: "#e9effc"
  ok-green: "#0f7a4f"
  warn-amber: "#9a5b00"
  bad-red: "#c0262d"
  type-factura: "#2557d6"
  type-recibo: "#0f7a4f"
  type-contrato: "#9a5b00"
  type-otro: "#5b5b63"
  dark-ground: "#0c0c0e"
  dark-surface: "#131316"
  dark-text: "#ededf0"
  dark-citation-blue: "#7ea2ff"
typography:
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, Segoe UI, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.65
  ui:
    fontFamily: "Inter, ui-sans-serif, system-ui, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
  data:
    fontFamily: "JetBrains Mono, ui-monospace, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  pill: "9999px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary-ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.primary-ink-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-text}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "32px"
  button-ghost:
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "28px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  citation-chip:
    backgroundColor: "{colors.citation-blue-soft}"
    textColor: "{colors.citation-blue-text}"
    typography: "{typography.data}"
    rounded: "{rounded.xs}"
    height: "18px"
  type-badge:
    rounded: "{rounded.pill}"
    typography: "{typography.label}"
    height: "20px"
---

# Design System: reportAi

## Overview

**Creative North Star: "The Quiet Ledger"**

reportAi is a working ledger, not a showroom. The interface uses the category's familiar language: a sticky top bar, bordered panels on a warm-gray ground, tables, segmented tabs and an ink primary button. It executes that language at the craft level of Linear and Stripe Dashboard. The product's claim is that every number can be traced, so the design keeps provenance visible. Confidence, model id, `null` values, SQL, similarity scores and source citations are first-class content, never fine print.

The density is moderate and tool-like. Panels sit on one 12-column page up to 1200px wide and read top to bottom: review, then registro, then preguntar. Color is almost absent. The page runs on neutrals, one blue reserved for provenance, and four document-type hues. Light and dark themes follow the system.

**Key Characteristics:**
- Neutral warm-gray ground with white (near-black in dark) bordered panels
- Inter for everything human, JetBrains Mono only for data, ids, code and figures
- Ink-colored primary actions; blue appears only where something is traced or focused
- Honest emptiness: absent values render as a muted mono `null`
- Live process state (the four-step pipeline) instead of decorative hero content

## Colors

The palette is Restrained: neutrals carry the page, one provenance blue marks what can be traced, and semantic hues mark state and document type.

### Primary
- **Ledger Ink** (#17171a; inverted to #ededf0 in dark): primary buttons, the current step marker and body text. Actions read as ink, not as brand color.

### Secondary
- **Provenance Blue** (#2557d6 light / #7ea2ff dark), with its text tone (#1d47b3) and soft fill (#e9effc): citation chips `[n]`, the hovered source row, focus rings, text selection and the drop target while dragging. Nothing else uses it.

### Tertiary
- **Type hues**: factura blue (#2557d6), recibo green (#0f7a4f), contrato amber (#9a5b00), otro gray (#5b5b63). They appear only in type badges, as a dot plus a 12% color-mix fill.
- **State hues**: ok (#0f7a4f), warn (#9a5b00), bad (#c0262d). They are used for confidence readouts, completed or failed pipeline markers, and notices on their soft fills.

### Neutral
- **Warm Ground** (#f6f6f4 / dark #0c0c0e): page background.
- **Panel White** (#ffffff / dark #131316): panels, inputs, the top-bar pill.
- **Sunken Gray** (#f3f3f1) and **Pressed Gray** (#ebebe8): table heads, previews, footers, code blocks, selected filter tabs, user chat bubbles.
- **Hairline** (#e6e6e2) and **Strong Hairline** (#d6d6d1): all borders and dividers.
- **Secondary Text** (#4d4d55) and **Tertiary Text** (#6c6c75): supporting copy and labels. Tertiary still clears 4.5:1 on white.

### Named Rules
**The Provenance Blue Rule.** Blue means "this is traced or focused": citations, the source row they light, focus and selection. Never use it for decoration, wordmarks, headings or primary buttons.

**The Ink Action Rule.** The primary action is an ink button. There is one primary action per panel.

## Typography

**Body Font:** Inter (with ui-sans-serif, system-ui, Segoe UI fallbacks), loaded through next/font with stylistic sets cv11 and ss01.
**Data Font:** JetBrains Mono (with ui-monospace, Consolas fallbacks).

**Character:** One workhorse sans carries the whole interface. The mono is used only for data and code: document numbers, ids, amounts, JSON, SQL, model ids, similarity scores and `null`.

### Hierarchy
- **Headline** (600, 22px mobile / 24px desktop, 1.25, -0.02em): the single page heading.
- **Title** (600, 15px, -0.01em): panel titles such as Registro and Preguntar. The record header in the extraction view uses 16px.
- **Body** (400, 14px, 1.65): chat answers and the lead description, capped at about 68ch.
- **UI** (400–500, 13px): table cells, controls, field values, notices.
- **Label** (600, 12px): section labels inside panels. They are never uppercase and never tracked.
- **Data** (mono, 11–12px, tabular numerals): figures right-aligned in tables. Totals step up to 14px semibold, and to 20px in the record header.

### Named Rules
**The Mono Is Data Rule.** Monospace marks machine values. If text is meant for a human to read as prose, it is set in Inter.

## Layout

The page is a single column inside a 1200px container with a 16px side gutter (24px from sm up). Sections are separated by 48px. The sticky top bar is 56px tall and carries section anchors (hidden below sm) plus a live database health pill.

On lg screens the review workspace splits 5:7: a sticky preview on the left and the extraction panel on the right, which scrolls internally up to 64vh. Below lg the two stack.

The pipeline is a 4-column strip on lg and a 2×2 grid below it. Tables become stacked lists below their breakpoint: md for the registro, sm for line items and taxes. Inside a panel, padding is 16px (20px from sm up), groups sit 24px apart, and fields sit 10px apart.

## Elevation & Depth

The system is flat: depth comes from tonal layering (ground → panel → sunken) and 1px hairlines. Shadows are reserved for small raised elements that sit on a sunken surface: the selected segmented tab, the preview image, and the drop-replacement toast.

### Shadow Vocabulary
- **Raised chip** (`box-shadow: 0 1px 2px rgb(20 20 30 / 0.05)`): the selected segmented tab and the preview image.
- **Floating** (`box-shadow: 0 1px 2px rgb(20 20 30 / .04), 0 4px 16px -4px rgb(20 20 30 / .08)`): the toast shown while a file is dragged over a loaded document.

### Named Rules
**The Border-Or-Shadow Rule.** A panel declares its elevation once, with a hairline border. Panels never also carry a soft shadow.

## Shapes

Corners are gentle and consistent:
- Panels: 12px
- Inner groups, tables, notices and inputs: 8px
- Buttons: 6px
- Citation chips and skeleton bars: 4px
- Type badges and the health indicator: pills

The dropzone is the only dashed border. Lines are always 1px.

## Components

### Buttons
- **Shape:** 6px corners. Heights are 28px (sm), 32px (md) and 36px (lg). Lucide icons are 16px with a 6px gap.
- **Primary:** ink fill with inverted text, for one action per panel ("Confirmar y guardar", "Seleccionar archivo", send). It is full-width below sm in panel footers.
- **Secondary:** panel-white fill with a strong hairline; hover shifts it to sunken gray.
- **Ghost:** secondary text and no fill; hover adds a sunken fill and ink text. Used in panel-header tools (Cambiar, Copiar JSON, Nueva conversación).
- **States:** 150ms color transitions, disabled at 50% opacity, and a 2px blue focus outline offset by 2px.

### Panels
- White surface, 1px hairline, 12px radius, no shadow.
- The header row holds the title, a mono count, and tools on the right.
- The footer row sits on sunken gray and holds the status text with the primary action.

### Type Badge
- 20px pill: a 6px dot plus a label, tinted from its type hue at 12%.

### Pipeline (signature)
- Four steps: Subir, Extraer, Revisar y guardar, Preguntar.
- Each step has a 20px marker: a number when pending, ink when current, a spinner when busy, a green check when done, a red cross on error. A 2px bar under the active step shows ink, or red on error.
- The pipeline is driven by the real state of the document.

### Citations (signature)
- Each `[n]` in an answer is an 18px mono chip in provenance blue that links to the original file.
- Hovering or focusing a chip lights its row in the "Fuentes" list with a soft blue fill and inset ring.
- Every answer carries a method chip: "SQL · n filas", which opens the executed query, or "Búsqueda semántica", with similarity shown per source.

### Inputs
- The composer is a white field with a strong hairline and 8px radius; on focus the border turns blue.
- It grows with its content and has a 32px ink send button.

### Segmented tabs and filters
- Segmented tabs (Campos / JSON) are 24px tabs on a sunken track; the selected one is white with a raised-chip shadow.
- Registro filters are 28px ghost tabs with a mono count; the selected one has a pressed-gray fill.

## Do's and Don'ts

### Do:
- **Do** show what the model returned exactly, rendering absent values as a muted mono `null`.
- **Do** put machine values (ids, amounts, SQL, JSON, model ids, similarity) in JetBrains Mono with tabular numerals.
- **Do** keep provenance visible at first glance: confidence, method chip, executed SQL and cited sources.
- **Do** collapse tables into stacked label/value rows on narrow screens instead of horizontal scrolling.
- **Do** use skeleton bars for loading content, and a 14px spinner only beside a status line.

### Don't:
- **Don't** use provenance blue outside citations, focus, selection and the drop target.
- **Don't** add a shadow to a bordered panel, or nest filled tiles inside panels; use hairline dividers.
- **Don't** hide technique behind decoration: no collapsing confidence or similarity into icons.
- **Don't** add uppercase tracked labels or eyebrows above headings.
