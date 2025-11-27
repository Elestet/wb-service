# Product Context

Why:
- Streamline price/name retrieval for Wildberries goods and internal viewing of rich product data.

Problems Solved:
- Unreliable external resources (images/CDN) via layered fallbacks and a proxy.
- Sheets automation needing a stable, minimal CSV endpoint.
- Quick internal lookup of extended data behind simple auth.

How It Should Work:
- User logs in to view MAX UI and rich JSON endpoints; public CSV remains open.
- Sheets call `/wb-price-csv?nm=...` and parse two-line CSV: headers and a single data row.

UX Goals:
- Central, readable table with clear badges for warehouses and statuses.
- Photo with graceful degradation (webp→jpg→basket→wbstatic) or placeholder.
- Simple login page; minimal friction for public CSV use.
