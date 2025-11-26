# Active Context

Current Focus:
- Отдельное отображение идентификатора и имени продавца: две колонки `ID продавца` и `Продавец (ФИО)` в UI.
- Поддержание согласованности: JSON (`/wb-max`) уже отдает `sellerId`, `sellerName`, `sellerCombined`; UI теперь использует раздельные значения.

Recent Changes:
- Reverted env-based creds, key, and caching to keep public CSV simple.
- Refactored `/wb-price-csv` to direct product fetch (v2→v1→basket→html) returning `price,name`.
- Added `fetchSellerName(sellerId)` parsing seller page HTML.
- UI: заменена комбинированная колонка на две: `ID продавца` и `Продавец (ФИО)`.

Next Steps:
- Возможно добавить раздельные колонки продавца (уже есть `sellerId` и `sellerName`) во все нужные CSV (в `wb-max-csv` уже присутствуют).
- Рассмотреть batch CSV endpoint для нескольких `nm`.

Decisions:
- Сохранять `/wb-price-csv` публичным и минимальным.
- HTML парсинг имени продавца использовать только для JSON/UI, не утяжеляя CSV.
- В UI поддерживать простоту чтения через раздельные колонки.

Preferences:
- Minimal public endpoints; robust fallbacks; readable UI.

Learnings:
- Wildberries APIs can vary; layered fallbacks are essential.
- Sheets `IMPORTDATA` returns headers+data; use `INDEX` to select cells.
