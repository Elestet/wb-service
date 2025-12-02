# Active Context

Current Focus:
- Получение названия магазина по артикулу товара.
- Критическая оптимизация производительности: устранение медленных запросов.
- Цена теперь извлекается быстро и корректно.
- Склады: показывать названия складов и количество в формате `Название — N шт`.

Recent Changes (Dec 2, 2025):
- **CRITICAL FIX**: Удалён медленный `fetchStoreNameFromProductPage` который делал 3+ HTTP-запроса
- **CRITICAL FIX**: Упрощён `fetchSellerName` - таймаут снижен до 5 сек, убраны избыточные regex
- **CRITICAL FIX**: Упрощён `extractPrice` - убраны дублирующиеся проверки, оставлены только рабочие поля
- **CRITICAL FIX**: Удалено дублирование функции `summarizeStocks` (была определена дважды)
- **CRITICAL FIX**: Добавлены недостающие функции `safeGet` и `currencyByDomain` в wb-max-csv
- **UI FIX**: Исправлена проверка цены - теперь `price !== null && price > 0` вместо `typeof price === 'number'`
- **UI FIX**: Исправлены индексы innerHTML - правильно отображаются фото, склады и статус
- **UI FIX**: Товары без остатков показывают "нет в наличии" вместо "0.00"
- **CRITICAL FIX**: Название магазина теперь берётся из `product.supplier` в API v2 (не требует парсинга!)
- **NEW FEATURE**: В `/wb-max` возвращается `storeName` и `sellerName` (оба из `product.supplier`)
- **NEW FEATURE**: CSV endpoint `/wb-max-csv` включает колонку `storeName`
- **OPTIMIZATION**: Удалены медленные функции `fetchStoreName` и `fetchSellerName` - больше не нужны
- Результат: загрузка **~1-6 сек**, название магазина всегда доступно из API
- UI: продавец разделён на две колонки, артикул — ссылка на KG
- UI: колонка `Склады` показывает `Название — N шт`, модель FBO/FBS

Next Steps:
- Добавить кэширование часто запрашиваемых товаров (опционально)
- Расширять словарь `wh → название` по наблюдениям

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
