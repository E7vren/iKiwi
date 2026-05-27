---
name: Organic Enterprise
colors:
  surface: '#f1fbff'
  surface-dim: '#d1dce0'
  surface-bright: '#f1fbff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eaf5fa'
  surface-container: '#e4f0f4'
  surface-container-high: '#dfeaef'
  surface-container-highest: '#d9e4e9'
  on-surface: '#131d21'
  on-surface-variant: '#424936'
  inverse-surface: '#283236'
  inverse-on-surface: '#e7f3f7'
  outline: '#737a64'
  outline-variant: '#c2cab0'
  surface-tint: '#456800'
  primary: '#456800'
  on-primary: '#ffffff'
  primary-container: '#98d62d'
  on-primary-container: '#3b5900'
  inverse-primary: '#9bd930'
  secondary: '#586062'
  on-secondary: '#ffffff'
  secondary-container: '#dae1e3'
  on-secondary-container: '#5d6466'
  tertiary: '#5c5f61'
  on-tertiary: '#ffffff'
  tertiary-container: '#c1c4c7'
  on-tertiary-container: '#4e5154'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b5f64c'
  primary-fixed-dim: '#9bd930'
  on-primary-fixed: '#121f00'
  on-primary-fixed-variant: '#334f00'
  secondary-fixed: '#dde4e6'
  secondary-fixed-dim: '#c1c8ca'
  on-secondary-fixed: '#161d1f'
  on-secondary-fixed-variant: '#41484a'
  tertiary-fixed: '#e0e3e6'
  tertiary-fixed-dim: '#c4c7ca'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#44474a'
  background: '#f1fbff'
  on-background: '#131d21'
  surface-variant: '#d9e4e9'
typography:
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  data-display:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-padding: 24px
  gutter: 20px
  component-gap: 16px
  stack-padding: 12px
  sidebar-width: 260px
---

## Brand & Style

This design system is built for a high-efficiency wholesale platform that bridges the gap between organic freshness and industrial-grade logistics. The brand personality is **Professional, Vital, and Systematic**. It targets operational managers and business owners who require immediate clarity in complex data environments.

The visual style is a hybrid of **Modern Corporate** and **Soft Minimalism**. It utilizes high-contrast action areas (lime green) against a sophisticated "off-white" and "charcoal" canvas. The goal is to evoke a sense of trust and efficiency through a clean, systematic UI that feels "fresh" without sacrificing the seriousness required for financial and inventory management.

## Colors

The palette is anchored by "Kiwi Lime," a vibrant green used strictly for primary calls to action, success states, and key data points. This is balanced by a deep charcoal for text and structural navigation, ensuring maximum legibility.

- **Primary (Lime):** Used for buttons, chart nodes, and active indicators. It symbolizes growth and freshness.
- **Secondary (Charcoal):** Used for headings and high-priority labels.
- **Surface Scale:** A range of cool greys (`#F8F9FA` to `#E9ECEF`) is used to define container depths and sidebar backgrounds.
- **Functional Colors:** Yellow is used sparingly for "pending" states or warnings, ensuring they stand out from the green/grey baseline.

## Typography

The typography system relies on **Hanken Grotesk**, chosen for its geometric precision and excellent legibility at small sizes—critical for data-heavy admin dashboards. 

- **Data-Display:** A specialized role for large numeric values (e.g., "0 UZS") to ensure metrics are the first thing a user sees.
- **Hierarchy:** Use weight over size to differentiate information. Labels for secondary data points should use `label-md` with slight letter spacing to maintain clarity.
- **Mobile Adjustments:** On mobile devices, `headline-lg` should scale down to 22px to prevent awkward text wrapping in metric cards.

## Layout & Spacing

The design system utilizes a **Fixed Grid** approach for the main content area to maintain a structured, professional feel.

- **Sidebar:** A fixed 260px left-hand navigation allows for consistent access to global tools.
- **Grid:** A 12-column layout on desktop with a 20px gutter. Metric cards typically span 3 columns, while complex charts span 6 or 12.
- **Rhythm:** An 8px base unit drives all spacing. For example, cards use 24px internal padding (`3x`) and 16px external gaps (`2x`).
- **Responsive Behavior:** On tablet, the sidebar collapses into an icon-only rail or a hamburger menu. On mobile, the grid collapses to a single column with 16px side margins.

## Elevation & Depth

Visual hierarchy is established through a combination of **Tonal Layers** and **Soft Ambient Shadows**.

- **Level 0 (Background):** The base layer uses a very light grey (`#F8F9FA`) or a subtle brand-tinted background image.
- **Level 1 (Cards/Containers):** Primary content containers are pure white with a very soft, multi-layered shadow (0px 4px 20px rgba(0,0,0,0.05)).
- **Level 2 (Active States/Modals):** Elements that require immediate focus utilize a slightly more aggressive shadow and a 1px border (`#E9ECEF`) to define boundaries against the white background.
- **Stacked Depth:** Metric cards feature a "stacked" visual effect (multiple borders/layers visible at the bottom) to indicate they contain grouped data or history.

## Shapes

The shape language is **Rounded**, reflecting the "organic" aspect of the fruit and vegetable industry while remaining structured.

- **Cards & Primary Sections:** Use a 16px (`1rem`) radius.
- **Buttons & Inputs:** Use a 8px (`0.5rem`) radius for a sturdy, professional feel.
- **Icons:** Enclosed within rounded-square backgrounds (12px radius) to create a "blocky" but soft visual anchor for data points.

## Components

### Buttons
- **Primary:** Solid Lime Green (`#98D62D`) with white text. High contrast, used for critical actions like "Set Prices."
- **Secondary:** Light grey background with Charcoal text. Used for navigation or less critical actions.

### Metric Cards
- White background, 16px corner radius.
- Features a prominent icon in a charcoal-tinted square on the left.
- Large data-display typography for the main value, with smaller "vs yesterday" comparison text below.

### Sidebar Navigation
- Subtle grey background.
- Active state uses a slightly darker grey fill and a small vertical accent bar or colored icon.
- Navigation items include a 24px icon and `body-md` text.

### Data Visualization
- **Line Charts:** Use Lime Green for the stroke with a soft green-to-transparent gradient fill underneath.
- **Nodes:** Large, circular markers on data points to emphasize the interactive nature of the data.

### Input Fields
- Understated styling: a light grey background with a 1px border. Focus state should use a Lime Green border and a soft outer glow.