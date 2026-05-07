# Grapefruit — UI Style Guide

A living reference for the game's visual language.  
**Design philosophy**: tactile, material, content-first — never decorative.

Inspired by:
- Mozilla Foundation "Post-Naive Internet" principles (meaningful > ornamental, human-centered)
- Pastel ceramic tiles, matte surfaces, visible grout lines as structural accents
- Warm off-white surfaces with deliberate, restrained colour

---

## Colour Tokens

All colours are defined as CSS custom properties on `:root` in `style.css`.

| Token                | Hex       | Purpose                                 |
|----------------------|-----------|-----------------------------------------|
| `--bg`               | `#F5F0EB` | Page / canvas background (off-white)    |
| `--surface`          | `#FFFFFF` | Panels, cards, dialogue boxes           |
| `--border`           | `#D4CFC8` | Panel borders, dividers (warm grey)     |
| `--text`             | `#2A2420` | Primary text (warm near-black)          |
| `--text-muted`       | `#8A8078` | Secondary / help text                   |
| `--accent`           | `#C2534C` | Primary accent — tile-grout red         |
| `--accent-hover`     | `#A8423C` | Accent darkened for hover states        |
| `--accent-soft`      | `#E8D5C4` | Warm tint for badges, tags, highlights  |
| `--sage`             | `#A8B8A0` | Secondary accent — sage green           |
| `--sage-hover`       | `#8FA387` | Sage darkened for hover                 |
| `--peach`            | `#E8B89D` | Tertiary accent — soft peach            |

---

## Typography

Use the system font stack. Never import web fonts.

```css
font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
```

| Element           | Size     | Weight |
|-------------------|----------|--------|
| Body text         | `1rem`   | 400    |
| Panel headings    | `1.1rem` | 600    |
| HUD               | `1rem`   | 600    |
| Timer display     | `2.5rem` | 700    |
| Dialogue text     | `1.05rem`| 400    |
| Dialogue speaker  | `0.85rem`| 700    |
| Buttons           | `0.9rem` | 600    |

---

## Spacing & Radius

| Token        | Value  | Usage                         |
|--------------|--------|-------------------------------|
| `--radius`   | `4px`  | Panels, buttons, inputs       |
| `--space-xs` | `4px`  | Tight inner gaps              |
| `--space-sm` | `8px`  | Button padding, list gaps     |
| `--space-md` | `16px` | Panel padding, section gaps   |
| `--space-lg` | `24px` | Modal padding                 |

---

## Component Patterns

### Buttons
- **Background**: `var(--accent)` (solid, flat)
- **Text**: `#FFFFFF`
- **Border**: none
- **Radius**: `var(--radius)` (4px)
- **Hover**: `background: var(--accent-hover)` — colour shift only, no transform
- **Active**: slight `opacity: 0.9`
- Secondary buttons (e.g. Cancel): `background: var(--border); color: var(--text)`

### Panels
- **Background**: `var(--surface)` (solid white)
- **Border**: `1px solid var(--border)`
- **Radius**: `var(--radius)`
- **Shadow**: none (or extremely subtle `0 1px 3px rgba(0,0,0,0.06)`)
- **No** `backdrop-filter`, no blur, no glassmorphism

### HUD
- Same panel treatment: solid white, thin border
- Compact padding (`8px 16px`)
- Points value: `font-weight: 700`

### Dialogue Box
- Solid white background
- `1px solid var(--border)`
- Speaker name: `color: var(--accent)`, `font-weight: 700`, `font-size: 0.85rem`, `text-transform: uppercase`, `letter-spacing: 0.5px`
- Option buttons: `border: 1px solid var(--accent)`, white bg, hover fills with accent

### Modals (dynamically created)
- Overlay: `rgba(0, 0, 0, 0.6)`
- Content: same panel treatment
- Always use the token colours, not arbitrary hex values

---

## Room Canvas

- **Canvas fill**: `var(--bg)` / `#F5F0EB` every frame before rendering
- **Room outline**: solid white `#FFFFFF` stroke, `lineWidth: 2`, tracing the isometric perimeter of the base floor
- **Hover highlight**: `rgba(100, 100, 100, 0.25)` — subtle, not attention-grabbing

---

## Anti-Patterns — DO NOT USE

| ❌ Never                                     | ✅ Instead                            |
|----------------------------------------------|---------------------------------------|
| `linear-gradient()` on buttons or cards      | Flat solid `background-color`         |
| `backdrop-filter: blur()`                    | Solid `background` colour             |
| `text-shadow` on UI text                     | Clean text, no effects                |
| `box-shadow` with large spread/blur          | `1px solid var(--border)` or nothing  |
| `translateY(-Npx)` hover float               | Colour-shift hover only               |
| `border-radius: 12px+`                       | `4px` maximum                         |
| Arbitrary colour hex outside the token set   | Use a `var(--token)` custom property  |
| Multiple gradient backgrounds on one element | One flat colour per element           |
