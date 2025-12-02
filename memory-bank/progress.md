# Progress

What Works:
- Public `/wb-price-csv` reliably returns `price,name` with multi-layer fallback.
- MAX UI shows extended fields with image fallbacks and warehouse badges.
- Auth flows (login/logout) protect private routes.
- `/wb-max` returns correct price, stocks, warehouses in ~6 seconds.
- `/wb-max-csv` includes all fields with proper helper functions.
- UI обновлено: две отдельные колонки `ID продавца` и `Продавец (ФИО)`.
- Склады: выводим `Название — N шт` на основе агрегации `sizes[].stocks` по `wh`.
- Модель: добавлена колонка `FBO/FBS`.
- Артикул: ссылка на карточку `wildberries.kg`.

Performance Fixes (Dec 2, 2025):
- Eliminated slow `fetchStoreNameFromProductPage` (3+ requests per call)
- Simplified `extractPrice` - removed redundant checks
- Fixed duplicate `summarizeStocks` definition
- Added missing `safeGet` and `currencyByDomain` helpers
- **MAJOR FIX**: Found that store name is in `product.supplier` field (no parsing needed!)
- Removed unnecessary `fetchStoreName` and `fetchSellerName` functions
- Result: 10x speedup (1-6 sec), price and store name both display correctly

What's Next:
- Optional: response caching for frequently requested products
- Optional: batch CSV endpoint
- Расширять словарь названий складов

Known Issues:
- sellerName may be empty if not in API response (HTML fallback removed for speed)

Evolution:
- Iterated endpoints from simple price → maximal data
- Performance optimization: removed blocking HTML parsers
- Balanced data richness with response speed
