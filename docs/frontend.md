# Dormside frontend

The storefront uses warm cream, tomato red, and olive accents. The customer flow is menu → bag → checkout → receipt. The compact mobile hero keeps the menu close; desktop adds a food feature and sticky order summary. On mobile and tablets, a persistent bag button opens a native dialog bottom sheet (a side drawer on desktop). Native dialog behavior supplies keyboard focus trapping, Escape dismissal, and background inertness.

Search and category filters work with the live menu. Existing item names, prices, APIs, pickup at Pearl Hall, and the $3 delivery fee remain in use. Cash and Stripe payments are supported. Saved bags and fulfillment/payment preferences synchronize between tabs and survive navigation. Storage failures fall back to memory. Menu/status failures pause ordering and show recovery information. Reduced-motion preferences disable animation and smooth scrolling. Geist and Geist Mono are bundled locally in `src/app/fonts` with their SIL Open Font License, removing Google Fonts network requests from production builds.

Checkout prepares payment only after an explicit action. It validates contact information, disables repeated submissions, shows the complete total, and keeps a prepared payment tied to its exact order details. Editing those details prepares a new payment session. The existing backend still owns order persistence and Stripe verification.

## Checks

- `npm run dev -- --hostname 127.0.0.1` starts the preview.
- `npm run build` compiles and type-checks production routes.
- `npm run lint` checks application code.
- `npm test` exercises saved-cart recovery, invalid stored values, photo fallbacks, categories, and currency calculations. Requires Node 22.6+ for TypeScript stripping.
- Manual browser checklist: 360/390px mobile and 1440px desktop; search/no results; each category; add/decrement/remove; refresh with a populated bag; keyboard dialog opening/Escape/focus return; pickup/delivery persistence; empty checkout; field validation; optional tip; closed/unavailable kitchen; Stripe test-mode success/failure; cash order and receipt with test endpoints.

No browser was connected during implementation. Compilation, static checks, unit checks, and local HTTP responses were checked; visual interaction and real payments were not exercised.

## Image provenance

All seven images were generated with the built-in imagegen tool and optimized to local WebP assets. These are illustrative images, not photographs of the kitchen's actual servings; the menu includes a short note. Admin-uploaded item photographs take priority, and unmapped new dishes get a neutral utensil placeholder.

- `public/images/sharing-spread.webp` — hero and original slider tray
- `public/images/wings.webp`
- `public/images/nachos.webp`
- `public/images/mac-cheese.webp`
- `public/images/salad.webp`
- `public/images/drinks.webp`
- `public/images/cookies.webp`

### Final hero prompt

Use case: ads-marketing. Asset type: food ordering website hero photograph, landscape 3:2. Create an exceptionally appetizing editorial food photograph of a casual college-night sharing spread: a small parchment-lined stainless steel tray with three miniature cheeseburger sliders (glossy golden brioche, beef, melted yellow cheese, lettuce, pickles) in the foreground, a white bowl of buffalo chicken wings behind at right, a few loaded nachos and a small ramekin of ranch at left. Off-white warm cream tabletop, soft warm directional studio light with natural shadows. Shoot close at a 40 degree angle. Tight, art-directed still-life composition, food fills frame, visible real textures, professional contemporary independent restaurant campaign. Background pale warm cream #f7f3e9. No people, no hands, no words, no lettering, no watermarks. All food containers sit on table, no floating food. Save the generated image for use in the local website project.

### Final menu prompt template

Use case: product-mockup. Asset type: square menu card food photograph for a warm minimalist food ordering website. Professional editorial food photography of [subject]. Entire container visible centered on a plain warm ivory tabletop, close slightly overhead 45 degree composition, appetizing real textures, soft natural directional light, gentle shadows, restrained warm cream and amber palette. Fills most of frame. No people, no text, no labels, no branding, no watermarks. A real food photograph, not an illustration.

Subjects used:

- Wings: a white ceramic plate of crispy buffalo chicken wings with ranch dip and celery
- Nachos: a sharing tray of tortilla nachos topped with melted cheese, diced tomatoes, jalapenos and sour cream
- Mac & cheese: a white ceramic rectangular baking dish of creamy golden macaroni and cheese
- Salad: a white ceramic bowl of Caesar salad with crisp romaine, parmesan shavings and croutons
- Drinks: three unbranded chilled soft drink cans in pale orange, pale green and cream with condensation, next to a clear glass of cola
- Cookies: a small parchment-lined kraft box of golden chocolate chip cookies
