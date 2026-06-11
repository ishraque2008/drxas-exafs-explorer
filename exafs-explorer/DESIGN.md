# Dr. XAS Design System Guidelines

This document serves as the central design system and styling guide for the Dr. XAS project. It codifies the visual language established in the `magma-particles-demo` page so that future subpages, products, and applications maintain a consistent, modern, and aligned aesthetic.

## 1. Core Principles

The Dr. XAS design language is built around three core concepts:

- **Scientific but Accessible:** Utilizing dark themes for data/video juxtaposition, balanced with clean, white spaces for readability.
- **Dynamic & Alive:** Employing micro-interactions, custom cursor animations, glassmorphism (frosted glass), and particle backgrounds.
- **"Google-esque" Modernity:** Emphasizing readable typography, rounded corners (pills/cards), generous padding, and subtle drop shadows over harsh borders.

---

## 2. Typography

The project relies on a highly readable, modern sans-serif font stack.

- **Primary Font:** `Google Sans` (and `Google Sans Text`). Used for main headings, navigation links, and primary brand elements.
- **Secondary/Fallback Fonts:** `Outfit`, followed by `Roboto`, `Arial`, and `sans-serif`.

### Hierarchy & Weights

* **H1 (Hero Text):** 3.5rem, `font-weight: 500`. Tight letter-spacing (`-0.015em`).
- **H2 / Section Titles:** 2rem - 2.5rem, `font-weight: 600`.
- **Navigation & Buttons:** 1rem - 1.15rem, `font-weight: 400` or `500`.
- **Body Copy:** 0.95rem - 1rem, `font-weight: 400`, line-height `1.5`.

---

## 3. Color Palette

The color system is defined by a clean, neutral base contrasted heavily against the vibrant, scientific **Magma Colormap**.

### Base Neutrals

* **Primary Background (Light):** `#ffffff` (Pure White) - Used for the main body and footer.
- **Primary Background (Dark/Video):** `#000000` (Pure Black) - Used for media-heavy sections (e.g., the demo video section) to make content pop.
- **Primary Text:** `#1f1f1f` - Almost black, used for maximum readability on white backgrounds.
- **Secondary Text (Subtitles/Links):** `#5f6368` (Google Grey) - Used for footer links, descriptions, and less prominent text.
- **Dividers / Subtle Borders:** `rgba(0, 0, 0, 0.05)` or `#e0e0e0`.

### The Magma Brand Gradient

The signature Dr. XAS brand element is a sweeping gradient inspired by the 'Magma' colormap. It is used for primary text highlights, primary action buttons, and active state indicators to add energetic, scientific flair.

- **Gradient Definition:**
    `linear-gradient(135deg, rgba(31, 0, 92, 0.85) 0%, rgba(183, 55, 121, 0.85) 100%)`
    *(Transitions from deep purple -> magenta -> pink -> vibrant orange)*

- **Specific Magma Solid Colors:**
  - **Deep Purple:** `#3b0f70` *(Used for GitHub Icon / Group 3 Indicators)*
  - **Magenta:** `#8c2981` *(Used for Twitter Icon)*
  - **Bright Pink/Red:** `#b73779` *(Used for Form Focus States / Group 2 Indicators)*
  - **Vibrant Coral/Orange:** `#f7705c` *(Used for Group 1 Indicators)*

---

## 4. Components

### A. Navigation (Navbar)

* **Style:** Clean, transparent background, sticky or absolute at the top (`height: 64px`).
- **Links:** `#444746`, `font-size: 1rem`, fading to `#1f1f1f` on hover.
- **Dropdowns:** Hidden by default. On hover, they slide down gracefully (`transform: translateY(0)` from `-10px`) revealing a white card with a subtle drop shadow (`box-shadow: 0px 12px 32px rgba(0, 0, 0, 0.08)`).

### B. Buttons

Buttons utilize a fully rounded "pill" shape (`border-radius: 40px`).

- **Primary Button:**
  - **Background:** Dark Magma Gradient (`#1f005c` to `#b73779` approx).
  - **Text:** `#ffffff`.
  - **Effect:** Subtle drop shadow (`0 4px 14px rgba(0,0,0,0.1)`); scales down slightly on click (`transform: scale(0.97)`).
- **Secondary Button:**
  - **Background:** Frosted glass effect (`background-color: rgba(245, 245, 247, 0.7)` with `backdrop-filter: blur(8px)`).
  - **Text:** `#111111`.
  - **Hover:** Returns to a solid light grey (`#ebebed`).

### C. The "Magma Text" Effect

For the typing hero section, the text itself holds the gradient.
- **CSS Rule:**

    ```css
    background: linear-gradient(110deg, #1f1f1f 0%, #1f1f1f 65%, #3b0f70 80%, #b73779 92%, #f7705c 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    ```

### D. Footer

* **Background:** Solid White (`#ffffff`).
- **Layout:** Flexbox container, max-width `1200px`. Spaced out nicely with the LDRD support text and contact links on the left, and a self-contained chatbox on the right.
- **Chatbox:** White card (`background-color: #ffffff`, `border-radius: 12px`) with a soft shadow (`0 10px 30px rgba(0, 0, 0, 0.2)`).
- **Chatbox Inputs:** Light grey backgrounds (`#f9f9f9`) that turn white on focus, with the border color changing to Magma Pink (`#b73779`).

### E. Data Visualization & Particles

* **Canvas Particles:** Positioned `fixed` behind the main content (`z-index: 1`) to provide subtle, continuous kinetic motion. The particles should utilize the same Magma colormap values.
- **Video Sections:** Constrained in a `100vh` container with a stark black background to make scientific media highly visible and striking.

---

## 5. Spacing and Geometry

* **Corners:** Most functional UI elements (cards, dropdowns, chatboxes) use `border-radius: 12px` for a friendly, modern feel. Buttons use `40px` (pill).
- **Shadows:** Rely on soft, dispersed shadows (e.g., `0px 12px 32px rgba(0, 0, 0, 0.08)`) rather than hard borders to define elevation and depth.
- **Transitions:** Standardize on `0.2s` or `0.3s ease` (or `cubic-bezier(0.16, 1, 0.3, 1)` for complex spring-like motions) for all hover effects, color changes, and opacity shifts to ensure the UI feels responsive.
