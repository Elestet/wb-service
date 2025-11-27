# Active Context

Current Focus:
- Разделение продавца: отдельные колонки `ID продавца` и `Продавец (ФИО)` в UI.
- Склады: показывать названия складов и количество в формате `Название — N шт`.
- Модель: колонка `Модель` (FBO/FBS) рядом со складами.
- Ссылка: артикул кликабелен и ведёт на `wildberries.kg`.

Recent Changes:
- Reverted env-based creds, key, and caching to keep public CSV simple.
- Refactored `/wb-price-csv` to direct product fetch (v2→v1→basket→html) returning `price,name`.
- Added `fetchSellerName(sellerId)` parsing seller page HTML.
- UI: продавец разделён на две колонки.
- UI: колонка `Склады` теперь `Название — N шт` (данные из `sizes[].stocks`), ID можно показать в подсказке.
- UI: добавлена колонка `Модель` (FBO/FBS) по набору `wh` (фулфилмент → FBO, иначе FBS).
- UI: артикул стал ссылкой на KG.

Next Steps:
- Расширять словарь `wh → название` по наблюдениям для совпадения с WB.
- Добавить прозрачность источника остатков: тултип с сырьём `sizes[].stocks`.
- История замеров остатков для динамики.

Decisions:
- Сохранять `/wb-price-csv` публичным и минимальным.
- HTML парсинг имени продавца использовать только для JSON/UI, не утяжеляя CSV.
- В UI поддерживать простоту чтения через раздельные колонки.
- Данные по складам считаются из публичного `sizes[].stocks` (агрегация по `wh`).
- Для аналитики конкурентов используем только публичные данные WB (без приватных ключей).

Preferences:
- Minimal public endpoints; robust fallbacks; readable UI.

Learnings:
- Wildberries APIs can vary; layered fallbacks are essential.
- Sheets `IMPORTDATA` returns headers+data; use `INDEX` to select cells.
