const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Диагностика неожиданных ошибок чтобы процесс не падал молча
process.on('unhandledRejection', err => {
  console.error('UnhandledRejection:', err && err.message);
});
process.on('uncaughtException', err => {
  console.error('UncaughtException:', err && err.message);
});

// Функция задержки
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Случайная задержка от min до max секунд
const randomDelay = (minSec, maxSec) => {
  const ms = (minSec + Math.random() * (maxSec - minSec)) * 1000;
  console.log(`Waiting ${(ms / 1000).toFixed(1)}s before request...`);
  return delay(ms);
};

// Главная страница
app.get('/', (req, res) => {
  res.send(`<!doctype html>
<html><head><meta charset="utf-8" />
<title>WB Helper</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;max-width:720px;margin:40px auto;padding:0 16px;color:#222}
h1{margin:0 0 12px}
.box{border:1px solid #ddd;border-radius:8px;padding:16px}
label{display:block;margin:8px 0 4px}
input,select{padding:8px 10px;border:1px solid #bbb;border-radius:6px;font-size:16px;width:100%}
.row{display:flex;gap:12px;margin-top:12px;flex-wrap:wrap}
button{padding:10px 14px;border:none;background:#6c5ce7;color:#fff;border-radius:6px;font-size:15px;cursor:pointer}
button.secondary{background:#0984e3}
button.danger{background:#d63031}
table{width:100%;border-collapse:collapse;font-size:14px;margin-top:14px}
th,td{border:1px solid #ddd;padding:6px;text-align:left}
thead{background:#f5f5f5}
</style></head><body>
<h1>WB Helper</h1>
<div class="box">
  <label for="nm">Артикул WB</label>
  <input id="nm" type="text" placeholder="например 272673889" />
  <label for="domain">Домен</label>
  <select id="domain"><option value="ru">wildberries.ru</option><option value="kg">wildberries.kg</option><option value="kz">wildberries.kz</option></select>
  <div class="row">
    <button id="open">Открыть товар</button>
    <button id="price" class="secondary">Получить цену (API)</button>
    <button id="clear" class="danger">Очистить таблицу</button>
  </div>
  <div id="result" style="display:none"></div>
  <div style="overflow-x:auto">
    <table id="priceTable"><thead><tr>
      <th>Артикул</th><th>Название</th><th>Цена</th><th>Бренд</th><th>Валюта</th><th>Источник</th><th>Время</th><th>Статус</th>
    </tr></thead><tbody></tbody></table>
  </div>
</div>
<script>
window.addEventListener('DOMContentLoaded', function(){
  var nmEl = document.getElementById('nm');
  var domainEl = document.getElementById('domain');
  var btnOpen = document.getElementById('open');
  var btnPrice = document.getElementById('price');
  var btnClear = document.getElementById('clear');
  btnOpen.onclick = function(){
    var nm = nmEl.value.trim();
    if(!nm){ alert('Введите артикул'); return; }
    var domain = domainEl.value;
    var url = 'https://www.wildberries.'+domain+'/catalog/'+nm+'/detail.aspx';
    window.open(url,'_blank');
  };
  btnPrice.onclick = function(){
    var nm = nmEl.value.trim();
    if(!nm){ alert('Введите артикул'); return; }
    fetch('/wb-price?nm='+encodeURIComponent(nm))
      .then(function(r){return r.json();})
      .then(function(data){
        addRow(data,nm);
      })
      .catch(function(e){ alert('Ошибка запроса: '+e.message); });
  };
  btnClear.onclick = function(){
    var tb=document.querySelector('#priceTable tbody');
    if(tb) tb.innerHTML='';
  };
  function addRow(data,nm){
    var tb=document.querySelector('#priceTable tbody');
    if(!tb) return;
    var tr=document.createElement('tr');
    var timeStr=new Date().toLocaleTimeString();
    var currency=data.currency || (data.source && data.source.indexOf('.kg')>0 ? 'KGS' : data.source && data.source.indexOf('.kz')>0 ? 'KZT' : 'RUB');
    var status=data.error?data.error:'OK';
    var priceDisplay=data.error?'-':(typeof data.price==='number'?data.price.toString():'-');
    var sourceShort=(data.source||'-');
    var cols=[nm,data.name||'-',priceDisplay,data.brand||'-',currency,sourceShort,timeStr,status];
    for(var i=0;i<cols.length;i++){var td=document.createElement('td');td.textContent=cols[i];tr.appendChild(td);}tb.appendChild(tr);
  }
});
</script></body></html>`);
});

// Хелпер извлечения цены из объекта товара
function extractPrice(product) {
  const candidates = [];
  ['salePriceU','clientSalePriceU','basicPriceU','priceU','fullPriceU'].forEach(k => {
    if (typeof product[k] === 'number' && product[k] > 0) candidates.push(product[k]);
  });
  if (product.extended) {
    ['clientPriceU','basicPriceU','salePriceU','priceU'].forEach(k => {
      if (typeof product.extended[k] === 'number' && product.extended[k] > 0) candidates.push(product.extended[k]);
    });
  }
  if (Array.isArray(product.sizes)) {
    for (const s of product.sizes) {
      const p = s && s.price;
      if (p) {
        // v2 формат: price имеет поля basic, product, total
        ['salePriceU','clientPriceU','basicPriceU','priceU','fullPriceU','basic','product','total'].forEach(k => {
          if (typeof p[k] === 'number' && p[k] > 0) candidates.push(p[k]);
        });
        if (typeof p.basic === 'number' && p.basic > 0) candidates.push(p.basic);
        if (typeof p.product === 'number' && p.product > 0) candidates.push(p.product);
        if (typeof p.total === 'number' && p.total > 0) candidates.push(p.total);
      }
    }
  }
  return candidates.length ? Math.min(...candidates) : 0;
}

// Попытка получить цену из basket CDN (новый формат доменов)
async function tryBasket(nm) {
  const vol = Math.floor(nm / 100000);
  const part = Math.floor(nm / 1000);
  const domains = [];
  // basket-01.wb.ru до basket-40.wb.ru
  for (let i=1;i<=40;i++) domains.push(`basket-${String(i).padStart(2,'0')}.wb.ru`);
  for (const d of domains) {
    const url = `https://${d}/vol${vol}/part${part}/${nm}/info/ru/card.json`;
    try {
      const resp = await axios.get(url, { headers: { 'User-Agent':'Mozilla/5.0','Accept':'application/json' }, timeout: 6000 });
      const data = resp.data;
      if (data) {
        const priceCandidates = [
          data.salePriceU,
          data.priceU,
          data.basicPriceU,
          data.extended?.basicPriceU,
          data.extended?.clientPriceU
        ].filter(x => typeof x === 'number' && x>0);
        if (priceCandidates.length) {
          return { price: Math.min(...priceCandidates)/100, name: data.imt_name || '', brand: data.selling?.brand_name || '', source: url };
        }
      }
    } catch (e) {
      continue;
    }
  }
  return null;
}

// Fallback парсинг из HTML страницы товара (SSR + текст).
async function fetchFromHtml(nm) {
  const urls = [
    `https://www.wildberries.ru/catalog/${nm}/detail.aspx`,
    `https://www.wildberries.kg/catalog/${nm}/detail.aspx`,
    `https://www.wildberries.kz/catalog/${nm}/detail.aspx`
  ];
  for (const htmlUrl of urls) {
    let html;
    try {
      const resp = await axios.get(htmlUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' }, timeout: 15000 });
      html = resp.data;
    } catch (e) {
      continue; // следующий домен
    }

    // Попытка извлечь window.__NUXT__ (иногда скрипт заканчивается </script>)
    let nuxtBlock = null;
    const nuxtScriptMatch = html.match(/window.__NUXT__=(.*?);<\/script>/s);
    if (nuxtScriptMatch) nuxtBlock = nuxtScriptMatch[1];
    if (!nuxtBlock) {
      const altMatch = html.match(/window.__NUXT__=(\{.*?\});/s);
      if (altMatch) nuxtBlock = altMatch[1];
    }
    if (nuxtBlock) {
      try {
        // Часто это уже объект; если начинается с '{' — парсим.
        let nuxtObj;
        if (nuxtBlock.trim().startsWith('{')) {
          nuxtObj = JSON.parse(nuxtBlock.replace(/;$/,''));
        }
        if (nuxtObj) {
          const jsonStr = JSON.stringify(nuxtObj);
          const m = jsonStr.match(/"salePriceU":(\d+)/) || jsonStr.match(/"priceU":(\d+)/);
          if (m) {
            return { price: parseInt(m[1],10)/100, currency: htmlUrl.includes('.kg') ? 'KGS' : htmlUrl.includes('.kz') ? 'KZT' : 'RUB', name:'', brand:'', source: htmlUrl.includes('.kg') ? 'html-nuxt-kg' : htmlUrl.includes('.kz') ? 'html-nuxt-kz' : 'html-nuxt' };
          }
        }
      } catch (_) { /* ignore */ }
    }

    // Прямой поиск числовых salePriceU/priceU в HTML
    const numMatch = html.match(/salePriceU":(\d+)/) || html.match(/priceU":(\d+)/);
    if (numMatch) {
      return { price: parseInt(numMatch[1],10)/100, currency: htmlUrl.includes('.kg') ? 'KGS' : htmlUrl.includes('.kz') ? 'KZT' : 'RUB', name:'', brand:'', source: htmlUrl.includes('.kg') ? 'html-regex-kg' : htmlUrl.includes('.kz') ? 'html-regex-kz' : 'html-regex' };
    }

    // Текстовая цена: допускаем неразрывные пробелы и узкие пробелы
    const textPriceRegex = /([0-9][0-9\s\u00A0\u202F\.]{0,12})\s*(сом|KGS|руб|₽|тенге|KZT)/i;
    const textPriceMatch = html.match(textPriceRegex);
    if (textPriceMatch) {
      const rawDigits = textPriceMatch[1].replace(/[\s\u00A0\u202F\.]+/g,'');
      const value = parseInt(rawDigits,10);
      if (!isNaN(value) && value > 0) {
        const curToken = textPriceMatch[2].toLowerCase();
        let currency = 'RUB';
        if (curToken.startsWith('сом') || curToken === 'kgs') currency = 'KGS';
        else if (curToken.startsWith('тенге') || curToken === 'kzt') currency = 'KZT';
        return { price: value, currency, name:'', brand:'', source: htmlUrl.includes('.kg') ? 'html-text-kg' : htmlUrl.includes('.kz') ? 'html-text-kz' : 'html-text' };
      }
    }
  }
  return null;
}

// GET /wb-price?nm=АРТИКУЛ
app.get('/wb-price', async (req, res) => {
  const nm = req.query.nm;
  if (!nm) return res.status(400).json({ error: 'nm (артикул) обязателен' });

  // Списки возможных параметров для перебора
  const destList = [-1257786, -1029256, -1059509]; // сократим для скорости
  const appTypes = [1]; // сначала только тип 1
  const endpoints = [
    (appType,dest) => `https://card.wb.ru/cards/v2/detail?appType=${appType}&curr=rub&dest=${dest}&nm=${nm}`,
    (appType,dest) => `https://card.wb.ru/cards/v1/detail?appType=${appType}&curr=rub&dest=${dest}&nm=${nm}`,
    (appType,dest) => `https://card.wb.ru/cards/detail?appType=${appType}&curr=rub&dest=${dest}&nm=${nm}`
  ];

  let lastError = null;
  let debugTried = [];
  let attemptStatuses = [];

  for (const dest of destList) {
    for (const appType of appTypes) {
      for (const buildUrl of endpoints) {
        const url = buildUrl(appType,dest);
        try {
          debugTried.push(url);
          const response = await axios.get(url, {
            headers: {
              'User-Agent': 'WildberriesApp/1.0',
              'Accept': 'application/json',
              'Accept-Language': 'ru'
            },
            timeout: 10000
          });
          attemptStatuses.push({ url, status: response.status, count: response.data?.data?.products?.length || 0 });
          const product = response.data?.data?.products?.find(p => String(p.id) === String(nm)) || response.data?.data?.products?.[0];
          if (!product) continue;
          // Для диагностики: показать часть объектов price из sizes
          try {
            const samplePrices = Array.isArray(product.sizes) ? product.sizes.slice(0,3).map(s => s && s.price) : [];
            attemptStatuses.push({ url: url + '#sample', samplePrices });
          } catch(_) {}
          const rawPrice = extractPrice(product);
          if (rawPrice > 0) {
            return res.json({
              nm: product.id,
              name: product.name,
              price: rawPrice/100,
              brand: product.brand,
              source: url,
              attempts: attemptStatuses
            });
          }
          // Явная проверка цен во вложенных sizes[].price для v2
          let sizeCandidates = [];
          if (Array.isArray(product.sizes)) {
            for (const s of product.sizes) {
              const p = s && s.price;
              if (!p) continue;
              ['basic','product','total'].forEach(k => {
                if (typeof p[k] === 'number' && p[k] > 0) sizeCandidates.push(p[k]);
              });
            }
          }
          if (sizeCandidates.length) {
            const priceVal = Math.min(...sizeCandidates)/100;
            return res.json({
              nm: product.id,
              name: product.name,
              price: priceVal,
              brand: product.brand,
              source: url + '#sizes.price',
              attempts: attemptStatuses
            });
          }
        } catch (e) {
          lastError = e;
          attemptStatuses.push({ url, error: e.message, status: e.response?.status });
          continue;
        }
      }
    }
  }

  // HTML fallback
  const htmlData = await fetchFromHtml(nm);
  if (htmlData && htmlData.price > 0) {
    return res.json({ nm, ...htmlData, source: 'html' });
  }

  // Basket fallback
  const basketData = await tryBasket(Number(nm));
  if (basketData && basketData.price > 0) {
    return res.json({ nm, ...basketData, source: basketData.source || 'basket' });
  }

  return res.status(404).json({
    error: 'цена не найдена',
    tried: debugTried,
    attempts: attemptStatuses,
    lastError: lastError?.message
  });
});

app.listen(PORT, () => {
  console.log('WB price service started on port', PORT);
});

// Дополнительный endpoint для просмотра сырого ответа
app.get('/wb-raw', async (req, res) => {
  const nm = req.query.nm;
  if (!nm) return res.status(400).json({ error: 'nm обязателен' });
  try {
    const url = `https://card.wb.ru/cards/detail?appType=1&curr=rub&dest=-1257786&spp=30&nm=${nm}`;
    const response = await axios.get(url, { headers: { 'User-Agent': 'WildberriesApp/1.0', 'Accept': 'application/json' }, timeout: 10000 });
    res.json(response.data);
  } catch (e) {
    res.status(500).json({ error: 'raw fetch failed', details: e.message, status: e.response?.status });
  }
});

// Простой текстовый ответ для Google Sheets без Apps Script: только число
app.get('/wb-price-plain', async (req, res) => {
  try {
    const nm = req.query.nm;
    if (!nm) return res.status(400).send('nm required');
    // Переиспользуем основной обработчик через локальный вызов функций
    const destList = [-1257786, -1029256, -1059509];
    const appTypes = [1];
    const endpoints = [
      (appType,dest) => `https://card.wb.ru/cards/v2/detail?appType=${appType}&curr=rub&dest=${dest}&nm=${nm}`
    ];
    for (const dest of destList) {
      for (const appType of appTypes) {
        for (const buildUrl of endpoints) {
          const url = buildUrl(appType, dest);
          try {
            const response = await axios.get(url, { headers: { 'User-Agent': 'WildberriesApp/1.0', 'Accept': 'application/json' }, timeout: 10000 });
            const product = response.data?.data?.products?.find(p => String(p.id) === String(nm)) || response.data?.data?.products?.[0];
            if (!product) continue;
            let rawPrice = extractPrice(product);
            if (rawPrice <= 0 && Array.isArray(product.sizes)) {
              let sizeCandidates = [];
              for (const s of product.sizes) {
                const p = s && s.price;
                if (!p) continue;
                ['basic','product','total'].forEach(k => { if (typeof p[k] === 'number' && p[k] > 0) sizeCandidates.push(p[k]); });
              }
              if (sizeCandidates.length) rawPrice = Math.min(...sizeCandidates);
            }
            if (rawPrice > 0) {
              res.setHeader('Content-Type','text/plain; charset=utf-8');
              return res.send(String(rawPrice/100));
            }
          } catch (_) { /* try next */ }
        }
      }
    }
    // Fallback: HTML или basket
    const htmlData = await fetchFromHtml(nm);
    if (htmlData && htmlData.price > 0) {
      res.setHeader('Content-Type','text/plain; charset=utf-8');
      return res.send(String(htmlData.price));
    }
    const basketData = await tryBasket(Number(nm));
    if (basketData && basketData.price > 0) {
      res.setHeader('Content-Type','text/plain; charset=utf-8');
      return res.send(String(basketData.price));
    }
    return res.status(404).send('price not found');
  } catch (e) {
    return res.status(500).send('error');
  }
});

// CSV-ответ: заголовок + значение (2 строки)
app.get('/wb-price-csv', async (req, res) => {
  try {
    const nm = req.query.nm;
    if (!nm) return res.status(400).send('nm required');
    const plainUrl = req.protocol + '://' + req.get('host') + '/wb-price-plain?nm=' + encodeURIComponent(nm);
    try {
      const r = await axios.get(plainUrl, { timeout: 10000 });
      res.setHeader('Content-Type','text/csv; charset=utf-8');
      return res.send('price\n' + String(r.data));
    } catch (_) {
      return res.status(404).send('price\n');
    }
  } catch (e) {
    return res.status(500).send('price\n');
  }
});