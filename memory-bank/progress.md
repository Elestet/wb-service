# Progress

What Works:
- Public `/wb-price-csv` reliably returns `price,name` with multi-layer fallback.
- MAX UI shows extended fields with image fallbacks and warehouse badges.
- Auth flows (login/logout) protect private routes.
- `/wb-max` returns `sellerName` and `sellerCombined`.
- `/wb-max-csv` includes `sellerName` column.
 - UI обновлено: две отдельные колонки `ID продавца` и `Продавец (ФИО)` вместо комбинированной.

What's Next:
- Optional: batch CSV endpoint.
- Optional: server-side caching/rate limiting.
- Optional: add `sellerCombined` to CSV.
 - Оценить необходимость добавления обеих колонок продавца в дополнительные форматы экспорта (уже реализовано в max CSV).

Known Issues:
- Image/CDN availability varies; fallbacks may still miss.
- Local tests may not fetch WB due to environment restrictions.

Evolution:
- Iterated endpoints from simple price → maximal data.
- Refined CSV to direct fetch price+name.
- Added seller name enrichment via HTML parsing.
