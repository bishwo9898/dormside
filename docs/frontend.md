# Dormside frontend

A simple campus ordering flow: menu → bag → checkout → receipt.

The landing page opens directly to a single list of dishes with descriptions, prices, and Add buttons. There are no marketing sections, category chips, generated images, or placeholder artwork. Only photos explicitly supplied by the menu are displayed; missing or broken photos are omitted.

Desktop has a compact order summary beside the menu. Mobile has a persistent bag button and a native dialog bottom sheet. The dialog supports keyboard focus trapping, Escape dismissal, and background inertness. Controls have generous touch targets and respect reduced-motion preferences.

Checkout has pickup/delivery, contact details, payment choice, and a collapsed optional tip field. Existing item names, prices, APIs, free pickup at Pearl Hall, and $3 delivery are preserved. Cash and Stripe payments remain supported, with explicit payment preparation, validation, and duplicate-submit guards.

Bags and preferences persist across navigation and synchronize across tabs. Unavailable local storage falls back to memory. Menu or availability failures pause ordering. Geist fonts are bundled in `src/app/fonts` with their SIL Open Font License, so builds do not need Google Fonts.

## Run and check

- `npm run dev` — start the app manually.
- `npm run build` — production compilation and type checking.
- `npm run lint` — static checks.
- `npm test` — saved-cart recovery, malformed stored values, explicit-photo behavior, and currency calculations (Node 22.6+).

Browser checklist: 360px mobile and desktop; add/remove items; refresh a populated bag; keyboard bag opening and Escape; pickup/delivery persistence; empty checkout; contact and tip validation; kitchen closed/unavailable; test-mode payment and receipt.
