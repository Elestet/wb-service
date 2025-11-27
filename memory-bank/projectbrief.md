# Project Brief

Purpose: Build a small Node.js/Express service that fetches and exposes Wildberries product data with robust fallbacks, a protected MAX UI, and public CSV endpoints for Google Sheets automation.

Core Goals:
- Provide maximum product data: price, name, brand, seller info, rating, reviews, images, stocks, warehouses, dest, source, currency.
- Keep `/wb-price-csv` public and minimal: returns two columns `price,name` reliable for `IMPORTDATA`.
- Deliver a clean MAX UI (protected by login) with a wide table and image fallbacks.
- Ensure multi-layer data fallback: API v2 → v1 → basket CDN → HTML parsing.
- Integrate smoothly with Google Sheets via Apps Script.

Scope:
- One monolithic server file `index.js` managing routes and UI.
- Simple session-based auth for private endpoints.
- Public endpoints strictly limited to CSV/plain for Sheets.
