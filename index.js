const express = require('express');
const axios = require('axios');
const cors = require('cors');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Загружаем базу юридических лиц продавцов
let SELLERS_DB = {};
try {
  const dbPath = path.join(__dirname, 'sellers-db.json');
  SELLERS_DB = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  console.log(`Загружено ${Object.keys(SELLERS_DB).length} продавцов в базу`);
} catch (err) {
  console.warn('База продавцов не загружена:', err.message);
}

// Кэш для юридических лиц (чтобы не парсить одного продавца несколько раз)
const LEGAL_NAMES_CACHE = new Map();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'wb-helper-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 часа
}));

// Учетные данные (статичные)
const ADMIN_LOGIN = 'admin';
const ADMIN_PASSWORD = 'tarelkastakan';

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

// Middleware для проверки авторизации
function requireAuth(req, res, next) {
  if (req.session && req.session.isAuthenticated) {
    return next();
  }
  res.redirect('/login');
}

// Страница входа
app.get('/login', (req, res) => {
  if (req.session && req.session.isAuthenticated) {
    return res.redirect('/');
  }
  res.send(`<!doctype html>
<html><head><meta charset="utf-8" />
<title>Вход - WB Helper</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:0;padding:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%)}
.login-box{background:#fff;border-radius:16px;padding:40px;box-shadow:0 20px 60px rgba(0,0,0,0.3);width:100%;max-width:400px}
.login-box h1{margin:0 0 10px;font-size:28px;color:#2d3436;text-align:center}
.login-box .subtitle{text-align:center;color:#636e72;margin-bottom:30px;font-size:14px}
.form-group{margin-bottom:20px}
label{display:block;margin-bottom:8px;font-weight:600;color:#2d3436;font-size:14px}
input{width:100%;padding:12px 16px;border:2px solid #dfe6e9;border-radius:8px;font-size:15px;transition:border 0.2s;box-sizing:border-box}
input:focus{outline:none;border-color:#6c5ce7}
button{width:100%;padding:14px;border:none;background:#6c5ce7;color:#fff;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;transition:all 0.2s}
button:hover{background:#5f4dd1;transform:translateY(-2px);box-shadow:0 4px 12px rgba(108,92,231,0.4)}
.hint{font-size:12px;color:#b2bec3;margin-top:4px}
.error{background:#ff7675;color:#fff;padding:12px;border-radius:6px;margin-bottom:20px;font-size:14px;display:none}
</style></head><body>
<div class="login-box">
  <h1>🚀 WB Helper MAX</h1>
  <p class="subtitle">Войдите для доступа к сервису</p>
  <div id="error" class="error"></div>
  <form id="loginForm">
    <div class="form-group">
      <label for="login">Логин</label>
      <input type="text" id="login" name="login" required autocomplete="username" />
    </div>
    <div class="form-group">
      <label for="password">Пароль</label>
      <input type="password" id="password" name="password" required autocomplete="current-password" />
      <div class="hint">Подсказка: посуда</div>
    </div>
    <button type="submit">Войти</button>
  </form>
</div>
<script>
document.getElementById('loginForm').onsubmit = function(e) {
  e.preventDefault();
  var login = document.getElementById('login').value;
  var password = document.getElementById('password').value;
  fetch('/api/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({login: login, password: password})
  })
  .then(function(r){return r.json();})
  .then(function(data){
    if(data.success){
      window.location.href = '/';
    } else {
      var err = document.getElementById('error');
      err.textContent = data.message || 'Неверный логин или пароль';
      err.style.display = 'block';
    }
  })
  .catch(function(e){
    var err = document.getElementById('error');
    err.textContent = 'Ошибка соединения';
    err.style.display = 'block';
  });
};
</script></body></html>`);
});

// API для входа
app.post('/api/login', (req, res) => {
  const { login, password } = req.body;
  if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
    req.session.isAuthenticated = true;
    req.session.user = login;
    return res.json({ success: true });
  }
  res.json({ success: false, message: 'Неверный логин или пароль' });
});

// API для выхода
app.get('/api/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Главная страница (только для авторизованных)
app.get('/', requireAuth, (req, res) => {
  res.send(`<!doctype html>
<html><head><meta charset="utf-8" />
<title>WB Helper MAX</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:0;padding:20px;color:#222;background:#f8f9fa}
h1{margin:0 0 20px;font-size:32px;color:#2d3436}
.container{width:100%;max-width:100%;background:#fff;border-radius:12px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.08)}
.controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:20px}
.field{display:flex;flex-direction:column}
label{font-weight:600;margin-bottom:6px;font-size:14px;color:#636e72}
input,select{padding:10px 12px;border:2px solid #dfe6e9;border-radius:8px;font-size:15px;transition:border 0.2s}
input:focus,select:focus{outline:none;border-color:#6c5ce7}
.buttons{display:flex;gap:12px;margin-top:20px;flex-wrap:wrap}
button{padding:12px 24px;border:none;background:#6c5ce7;color:#fff;border-radius:8px;font-size:15px;cursor:pointer;font-weight:600;transition:all 0.2s}
button:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(108,92,231,0.3)}
button.secondary{background:#0984e3}
button.danger{background:#d63031}
button.success{background:#00b894}
.info-box{background:#f1f3f5;padding:16px;border-radius:8px;margin:20px 0;font-size:14px}
.info-box strong{color:#2d3436}
table{width:100%;border-collapse:collapse;font-size:13px;margin-top:20px;background:#fff}
th,td{border:1px solid #dfe6e9;padding:10px 12px;text-align:left}
th{background:#6c5ce7;color:#fff;font-weight:600;position:sticky;top:0}
tbody tr:hover{background:#f8f9fa}
.product-img{width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #dfe6e9}
.table-wrapper{overflow-x:auto;margin-top:20px;border-radius:8px;border:1px solid #dfe6e9}
.status-ok{color:#00b894;font-weight:600}
.status-error{color:#d63031;font-weight:600}
.badge{display:inline-block;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;margin:2px}
.badge-primary{background:#dfe6ff;color:#0984e3}
.badge-success{background:#d5f4e6;color:#00b894}
.badge-warning{background:#ffeaa7;color:#fdcb6e}
</style></head><body>
<div class="container">
<h1>🚀 WB Helper MAX</h1>
<div class="info-box">
  <strong>Максимальная версия:</strong> Получайте все доступные данные о товаре — цену, остатки, рейтинг, отзывы, изображения, склады и информацию о пункте выдачи (dest).
</div>
<div class="controls">
  <div class="field">
    <label for="nm">Артикул WB</label>
    <input id="nm" type="text" placeholder="например 272673889" />
  </div>
  <div class="field">
    <label for="domain">Домен</label>
    <select id="domain">
      <option value="ru">wildberries.ru (RUB)</option>
      <option value="kg">wildberries.kg (KGS)</option>
      <option value="kz">wildberries.kz (KZT)</option>
    </select>
  </div>
  <div class="field">
    <label for="dest">Пункт выдачи (dest)</label>
    <select id="dest">
      <option value="">Авто (перебор)</option>
      <option value="-1257786">-1257786 (Москва)</option>
      <option value="-1029256">-1029256 (СПб)</option>
      <option value="-1059509">-1059509 (Казань)</option>
      <option value="-59208">-59208 (Екатеринбург)</option>
      <option value="-364763">-364763 (Новосибирск)</option>
    </select>
  </div>
</div>
<div class="buttons">
  <button id="fetch" class="success">📊 Получить данные</button>
  <button id="open" class="secondary">🔗 Открыть товар</button>
  <button id="clear" class="danger">🗑️ Очистить таблицу</button>
  <button onclick="window.location.href='/api/logout'" style="background:#636e72">🚪 Выход</button>
</div>
<div class="table-wrapper">
  <table id="dataTable">
    <thead><tr>
      <th>Артикул</th>
      <th>Фото товара</th>
      <th>Название</th>
      <th>Бренд</th>
      <th>Продавец (ID)</th>
      <th>Категория</th>
      <th>Цвет</th>
      <th>Цена</th>
      <th>Валюта</th>
      <th>Рейтинг</th>
      <th>Отзывы</th>
      <th>Кол-во фото</th>
      <th>Остатки</th>
      <th>Склады</th>
      <th>Модель</th>
      <th>Dest</th>
      <th>Источник</th>
      <th>Время</th>
      <th>Статус</th>
    </tr></thead>
    <tbody></tbody>
  </table>
</div>
</div>
<script>
window.addEventListener('DOMContentLoaded', function(){
  var nmEl = document.getElementById('nm');
  var domainEl = document.getElementById('domain');
  var destEl = document.getElementById('dest');
  var btnFetch = document.getElementById('fetch');
  var btnOpen = document.getElementById('open');
  var btnClear = document.getElementById('clear');

  btnOpen.onclick = function(){
    var nm = nmEl.value.trim();
    if(!nm){ alert('Введите артикул'); return; }
    var domain = domainEl.value;
    var url = 'https://www.wildberries.'+domain+'/catalog/'+nm+'/detail.aspx';
    window.open(url,'_blank');
  };

  btnFetch.onclick = function(){
    var nm = nmEl.value.trim();
    if(!nm){ alert('Введите артикул'); return; }
    var domain = domainEl.value;
    var dest = destEl.value;
    var url = '/wb-max?nm='+encodeURIComponent(nm)+'&domain='+encodeURIComponent(domain);
    if(dest) url += '&dest='+encodeURIComponent(dest);
    
    btnFetch.disabled = true;
    btnFetch.textContent = '⏳ Загрузка...';
    
    fetch(url)
      .then(function(r){return r.json();})
      .then(function(data){
        addRow(data);
        btnFetch.disabled = false;
        btnFetch.textContent = '📊 Получить данные';
      })
      .catch(function(e){
        alert('Ошибка запроса: '+e.message);
        btnFetch.disabled = false;
        btnFetch.textContent = '📊 Получить данные';
      });
  };

  btnClear.onclick = function(){
    var tb=document.querySelector('#dataTable tbody');
    if(tb) tb.innerHTML='';
  };

  function addRow(data){
    var tb=document.querySelector('#dataTable tbody');
    if(!tb) return;
    var tr=document.createElement('tr');
    var timeStr=new Date().toLocaleTimeString();
    
    var status = data.error ? '<span class="status-error">'+data.error+'</span>' : '<span class="status-ok">OK (успешно)</span>';
    var price = '-';
    if (!data.error) {
      if (data.price !== undefined && data.price !== null && data.price > 0) {
        price = data.price.toFixed(2);
      } else if (data.stocksQty === 0 || (data.warehouses && data.warehouses.length === 0)) {
        price = 'нет в наличии';
      } else {
        price = '0.00';
      }
    }
    var rating = (data.rating || 0) + ' ' + (data.rating ? '(из 5)' : '');
    var feedbacks = (data.feedbacks || 0) + ' ' + (data.feedbacks ? '(шт)' : '');
    var images = (data.images || 0) + ' ' + (data.images ? '(фото)' : '');
    var stocksQty = (data.stocksQty || 0) + ' ' + (data.stocksQty ? '(шт на складах)' : '');
    
      var warehouses = '-';
      var fulfillmentWh = {
        '206348': true, // Кольцово (Екатеринбург)
        '120762': true, // Подольск
        '301760': true, // Новосибирск (сортировочный)
        '507': true,    // Электросталь
        '117986': true, // СПб Север
        '206828': true, // Софьино
        '204151': true, // Марушкинское
        '204163': true, // Тверь
        '203490': true, // Казань
        '205362': true  // Ростов-на-Дону
      };
      var modelText = '-';
    if(data.warehouses && data.warehouses.length > 0){
      // Преобразуем ID складов в человекочитаемые названия
      var whMap = {
        '206348':'Кольцово (Екатеринбург)',
        '120762':'Подольск (Мск область)',
        '301760':'Новосиб (Сортировочный)',
        '507':'Электросталь',
        '117986':'Санкт‑Петербург Север',
        '206828':'Софьино',
        '204151':'Марушкинское',
        '204163':'Тверь',
        '203490':'Казань',
        '205362':'Ростов‑на‑Дону'
      };
      // Если пришли количества по складам — используем их
      var items = Array.isArray(data.warehousesQty) && data.warehousesQty.length > 0
        ? data.warehousesQty.map(function(it){
            var id = String(it.wh);
            var name = whMap[id] || ('Склад '+id);
            var qty = Number(it.qty || 0);
            return '<span class="badge badge-primary">'+name+' — '+qty+' шт</span>';
          })
        : data.warehouses.map(function(w){
            var id = String(w);
            var name = whMap[id] || ('Склад '+id);
            return '<span class="badge badge-primary">'+name+' — ? шт</span>';
          });
      var whList = items.join(' ');
      warehouses = whList;
      // Определяем модель: FBO, если есть остатки на любом из fulfillment складов; иначе FBS
      var hasFulfillment = false;
      if (Array.isArray(data.warehousesQty) && data.warehousesQty.length > 0) {
        for (var j=0;j<data.warehousesQty.length;j++){
          var wid = String(data.warehousesQty[j].wh || '');
          if (fulfillmentWh[wid]) { hasFulfillment = true; break; }
        }
      } else if (Array.isArray(data.warehouses)) {
        for (var k=0;k<data.warehouses.length;k++){
          var wid2 = String(data.warehouses[k] || '');
          if (fulfillmentWh[wid2]) { hasFulfillment = true; break; }
        }
      }
      modelText = hasFulfillment ? 'FBO' : 'FBS';
    }
    
    var destUsed = (data.destUsed || '-');
    if(data.destUsed){
      var destName = '';
      if(data.destUsed === '-1257786') destName = 'Москва';
      else if(data.destUsed === '-1029256') destName = 'СПб';
      else if(data.destUsed === '-1059509') destName = 'Казань';
      else if(data.destUsed === '-59208') destName = 'Екатеринбург';
      else if(data.destUsed === '-364763') destName = 'Новосибирск';
      else destName = 'регион';
      destUsed = data.destUsed + ' (' + destName + ')';
    }
    
    var source = (data.source || '-');
    if(data.source){
      var srcName = '';
      if(data.source.indexOf('v2') >= 0) srcName = 'API v2';
      else if(data.source.indexOf('v1') >= 0) srcName = 'API v1';
      else if(data.source.indexOf('basket') >= 0) srcName = 'CDN корзины';
      else if(data.source.indexOf('html') >= 0) srcName = 'HTML страница';
      else srcName = data.source;
      source = data.source + ' (' + srcName + ')';
    }
    
    var currency = data.currency || 'RUB';
    var currencyName = '';
    if(currency === 'RUB') currencyName = 'российский рубль';
    else if(currency === 'KGS') currencyName = 'киргизский сом';
    else if(currency === 'KZT') currencyName = 'казахстанский тенге';
    currency = currency + (currencyName ? ' (' + currencyName + ')' : '');
    
    var mainImage = '-';
    if(data.mainImage){
      var imgHtml = '<img src="'+data.mainImage+'" class="product-img" alt="Фото" crossorigin="anonymous" onerror="';
      imgHtml += 'var alt=[';
      imgHtml += 'this.src.replace(\\'.webp\\',\\'.jpg\\'),';
      imgHtml += 'this.src.replace(\\'basket-\\'+this.src.match(/basket-(\\\\d+)/)[1],\\'basket-01\\'),';
      imgHtml += '\\'https://images.wbstatic.net/big/new/\\'+this.src.match(/(\\\\d+)\\\\/part/)[1]+\\'0000/\\'+this.src.match(/part\\\\/(\\\\d+)/)[1]+\\'-1.jpg\\'';
      imgHtml += '];';
      imgHtml += 'if(!this.tried)this.tried=0;';
      imgHtml += 'this.tried++;';
      imgHtml += 'if(this.tried<alt.length){this.src=alt[this.tried-1];}else{this.style.display=\\'none\\';this.parentElement.innerHTML=\\'<div style=\\\"width:80px;height:80px;background:#eee;display:flex;align-items:center;justify-content:center;border-radius:6px;color:#999;font-size:11px\\\">\u041d\u0435\u0442 \u0444\u043e\u0442\u043e</div>\\';}" />';
      mainImage = imgHtml;
    }
    
    var sellerId = data.sellerId || '-';
    var storeName = data.storeName || '-';
    // Формируем строку: Название (ID)
    var sellerDisplay = '-';
    if (storeName !== '-' && sellerId !== '-') {
      sellerDisplay = storeName + ' (' + sellerId + ')';
    } else if (storeName !== '-') {
      sellerDisplay = storeName;
    } else if (sellerId !== '-') {
      sellerDisplay = 'ID: ' + sellerId;
    }
    var category = data.category || '-';
    var color = data.color || '-';
    var productUrl = (function(){
      var host = 'www.wildberries.kg';
      return 'https://' + host + '/catalog/' + (data.nm || '') + '/detail.aspx';
    })();
    var nmLink = data.nm ? ('<a href="'+productUrl+'" target="_blank" rel="noopener noreferrer">'+data.nm+'</a>') : '-';
    var cols = [
      nmLink,
      mainImage,
      data.name || '-',
      data.brand || '-',
      sellerDisplay,
      category,
      color,
      price,
      currency,
      rating,
      feedbacks,
      images,
      stocksQty,
      warehouses,
      modelText,
      destUsed,
      source,
      timeStr,
      status
    ];
    
    for(var i=0;i<cols.length;i++){
      var td=document.createElement('td');
      if(i === 0 || i === 1 || i === 13 || i === 18){ // 0=link, 1=image, 13=warehouses, 18=status use innerHTML
        td.innerHTML = cols[i];
      } else {
        td.textContent = cols[i];
      }
      tr.appendChild(td);
    }
    tb.appendChild(tr);
  }
});
</script></body></html>`);
});

// Хелпер извлечения цены из объекта товара
function extractPrice(product) {
  const candidates = [];
  // Прямые поля продукта
  ['salePriceU','clientSalePriceU','basicPriceU','priceU'].forEach(k => {
    if (typeof product[k] === 'number' && product[k] > 0) candidates.push(product[k]);
  });
  // Цены в sizes (v2 формат)
  if (Array.isArray(product.sizes)) {
    for (const s of product.sizes) {
      const p = s && s.price;
      if (p) {
        ['basic','product','total'].forEach(k => {
          if (typeof p[k] === 'number' && p[k] > 0) candidates.push(p[k]);
        });
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

// Получить полное название юридического лица со страницы продавца
async function fetchLegalEntityName(sellerId) {
  if (!sellerId) return '';
  const id = String(sellerId).trim();
  
  // Проверяем кэш
  if (LEGAL_NAMES_CACHE.has(id)) {
    const cached = LEGAL_NAMES_CACHE.get(id);
    console.log(`✓ Из кэша для ${id}: ${cached}`);
    return cached;
  }
  
  // Пробуем разные домены
  const domains = ['wildberries.kg', 'wildberries.kz', 'wildberries.ru'];
  
  for (const domain of domains) {
    const url = `https://www.${domain}/seller/${id}`;
    
    // Добавляем случайную задержку 0.5-2 сек между запросами к разным доменам
    await delay(500 + Math.random() * 1500);
    
    try {
      const resp = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0'
        },
        timeout: 15000,
        maxRedirects: 5
      });
      const html = String(resp.data || '');
    
      // Ищем полное название юрлица в popup с реквизитами
      // Паттерн: "Общество с ограниченной ответственностью ...", "Индивидуальный предприниматель ..."
      const patterns = [
        /(?:Общество с ограниченной ответственностью|ООО)\s+[«"]?([А-ЯЁа-яёA-Za-z0-9\s\-\.]+?)[«"]?(?=\s*<?(?:ИНН|ОГРН|КПП|Номер|117105|\d{10,}))/i,
        /(?:Индивидуальный предприниматель|ИП)\s+([А-ЯЁа-яё\s]+?)(?=\s*<?(?:ИНН|ОГРН|КПП|Номер|\d{10,}))/i,
        /(?:Акционерное общество|АО)\s+[«"]?([А-ЯЁа-яёA-Za-z0-9\s\-\.]+?)[«"]?(?=\s*<?(?:ИНН|ОГРН|КПП|Номер|\d{10,}))/i
      ];
      
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          const fullName = match[1].trim();
          // Убираем лишние пробелы и спецсимволы
          const cleaned = fullName.replace(/\s+/g, ' ').replace(/[<>]/g, '');
          console.log(`✓ Найдено юрлицо для ${id} (${domain}): ${cleaned}`);
          // Сохраняем в кэш
          LEGAL_NAMES_CACHE.set(id, cleaned);
          return cleaned;
        }
      }
      
      // Если не нашли в реквизитах, пытаемся найти в title (для ИП)
      const ipMatch = html.match(/<title>\s*ИП\s+([А-ЯЁа-яё\s]+?)\s*[-–—]\s*Wildberries/i);
      if (ipMatch && ipMatch[1]) {
        const name = `Индивидуальный предприниматель ${ipMatch[1].trim()}`;
        console.log(`✓ Найдено ИП для ${id} (${domain}): ${name}`);
        // Сохраняем в кэш
        LEGAL_NAMES_CACHE.set(id, name);
        return name;
      }
    } catch (err) {
      // Логируем только если это не таймаут или сетевая ошибка
      if (!err.code || (err.code !== 'ECONNABORTED' && err.code !== 'ETIMEDOUT')) {
        console.log(`Не удалось загрузить ${domain}/seller/${id}: ${err.message}`);
      }
      continue; // пробуем следующий домен
    }
  }
  
  console.log(`✗ Не удалось получить юрлицо для продавца ${id}`);
  // Сохраняем пустую строку в кэш чтобы не пытаться снова
  LEGAL_NAMES_CACHE.set(id, '');
  return '';
}

// GET /wb-price?nm=АРТИКУЛ
app.get('/wb-price', requireAuth, async (req, res) => {
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

// Прокси для изображений WB (обходим блокировку CDN)
app.get('/wb-image', async (req, res) => {
  const nm = req.query.nm;
  const pic = req.query.pic || 1;
  if (!nm) return res.status(400).send('nm required');

  const vol = Math.floor(nm / 100000);
  const part = Math.floor(nm / 1000);
  
  // Пробуем разные CDN
  const urls = [
    `https://basket-${String((vol % 20) + 1).padStart(2, '0')}.wbbasket.ru/vol${vol}/part${part}/${nm}/images/big/${pic}.webp`,
    `https://basket-01.wbbasket.ru/vol${vol}/part${part}/${nm}/images/big/${pic}.jpg`,
    `https://images.wbstatic.net/big/new/${vol}0000/${nm}-${pic}.jpg`,
    `https://basket-${String((vol % 20) + 1).padStart(2, '0')}.wb.ru/vol${vol}/part${part}/${nm}/images/big/${pic}.jpg`
  ];

  for (const url of urls) {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
        }
      });
      
      const contentType = response.headers['content-type'] || 'image/jpeg';
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=86400'); // кэш на 24 часа
      return res.send(response.data);
    } catch (e) {
      continue;
    }
  }
  
  // Если ничего не сработало - возвращаем placeholder SVG
  res.set('Content-Type', 'image/svg+xml');
  res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
    <rect fill="#ddd" width="100" height="100"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="14" fill="#999">Нет фото</text>
  </svg>`);
});

app.listen(PORT, () => {
  console.log('WB price service started on port', PORT);
});

// Дополнительный endpoint для просмотра сырого ответа
app.get('/wb-raw', requireAuth, async (req, res) => {
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

// CSV с ценой и названием для Google Sheets - ПУБЛИЧНЫЙ API
app.get('/wb-price-csv', async (req, res) => {
  const nmRaw = req.query.nm;
  const domain = (req.query.domain || 'ru').trim();
  if (!nmRaw) return res.status(400).type('text/csv').send('price,name\n,');
  const nm = String(nmRaw).trim();

  // Базовый список dest (георегионы) для попыток получения карточки
  const destList = ['-1257786','-1029256','-1059509'];
  let product = null;
  let priceU = 0;

  // Пытаемся через v2 detail
  for (const dest of destList) {
    const url = `https://card.wb.ru/cards/v2/detail?appType=1&curr=rub&dest=${dest}&nm=${nm}`;
    try {
      const r = await axios.get(url, { headers: { 'User-Agent':'WildberriesApp/1.0' }, timeout: 8000 });
      const products = r?.data?.data?.products || [];
      if (!products.length) continue;
      product = products.find(p => String(p.id) === nm) || products[0];
      priceU = extractPrice(product);
      if (priceU > 0) break; // нашли валидную цену
    } catch (_) { /* пробуем следующий dest */ }
  }

  // Fallback v1 если не нашли
  if (!product || priceU <= 0) {
    try {
      const url = `https://card.wb.ru/cards/v1/detail?appType=1&curr=rub&nm=${nm}`;
      const r = await axios.get(url, { headers: { 'User-Agent':'WildberriesApp/1.0' }, timeout: 8000 });
      const products = r?.data?.data?.products || [];
      if (products.length) {
        product = products.find(p => String(p.id) === nm) || products[0];
        if (priceU <= 0) priceU = extractPrice(product);
      }
    } catch (_) {}
  }

  // Basket CDN fallback
  if ((!product || priceU <= 0)) {
    const basketData = await tryBasket(Number(nm));
    if (basketData && basketData.price > 0) {
      return res.type('text/csv').send('price,name\n' + String(basketData.price) + ',"' + (basketData.name || '') + '"');
    }
  }

  // HTML fallback
  if (priceU <= 0) {
    const htmlData = await fetchFromHtml(nm);
    if (htmlData && htmlData.price > 0) {
      return res.type('text/csv').send('price,name\n' + String(htmlData.price) + ',""');
    }
  }

  if (!product) {
    return res.status(404).type('text/csv').send('price,name\n,');
  }

  // Формируем финальные значения
  const name = product.name || product.imt_name || '';
  const price = priceU > 0 ? (priceU / 100) : 0;
  const safeName = String(name).replace(/"/g,'""');

  res.type('text/csv').send('price,name\n' + String(price) + ',"' + safeName + '"');
});

// Функция для подсчета остатков и складов
function summarizeStocks(product) {
  const sizes = Array.isArray(product?.sizes) ? product.sizes : [];
  let totalQty = 0;
  const perWh = new Map();
  for (const s of sizes) {
    const stocks = Array.isArray(s.stocks) ? s.stocks : [];
    for (const st of stocks) {
      const q = Number(st.qty || 0);
      const wh = String(st.wh || '');
      if (!isNaN(q)) {
        totalQty += q;
        if (wh) perWh.set(wh, (perWh.get(wh) || 0) + q);
      }
    }
  }
  const warehouses = Array.from(perWh.keys());
  const warehousesQty = warehouses.map(wh => ({ wh, qty: perWh.get(wh) || 0 }));
  return { totalQty, warehouses, warehousesQty };
}

// ===== Endpoint для максимальных данных (JSON) =====
app.get('/wb-max', requireAuth, async (req, res) => {
  const nm = String(req.query.nm || '').trim();
  const dest = String(req.query.dest || '').trim();
  const domain = String(req.query.domain || 'ru').trim();
  
  if (!nm) {
    return res.status(400).json({ error: 'Артикул (nm) обязателен' });
  }

  // Определяем список dest для перебора
  const destCandidates = [];
  if (dest) destCandidates.push(dest);
  destCandidates.push('-1257786', '-1029256', '-1059509', '-59208', '-364763');

  let product = null;
  let source = null;
  let destUsed = null;

  // Пробуем v2/detail с разными dest
  for (const d of destCandidates) {
    try {
      const url = `https://card.wb.ru/cards/v2/detail?appType=1&curr=rub&dest=${d}&nm=${nm}`;
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'WildberriesApp/1.0', 'Accept': 'application/json' },
        timeout: 10000
      });
      const products = response?.data?.data?.products || [];
      if (products.length > 0) {
        product = products.find(p => String(p.id) === String(nm)) || products[0];
        source = `v2/detail`;
        destUsed = d;
        break;
      }
    } catch (e) {
      continue;
    }
  }

  // Fallback: v1
  if (!product) {
    try {
      const url = `https://card.wb.ru/cards/v1/detail?appType=1&curr=rub&nm=${nm}`;
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'WildberriesApp/1.0' },
        timeout: 10000
      });
      const products = response?.data?.data?.products || [];
      if (products.length > 0) {
        product = products[0];
        source = 'v1/detail';
      }
    } catch (e) {}
  }

  // Fallback: basket CDN
  let basketPrice = 0;
  if (!product) {
    try {
      const vol = Math.floor(nm / 100000);
      const part = Math.floor(nm / 1000);
      const url = `https://basket-01.wb.ru/vol${vol}/part${part}/${nm}/info/ru/card.json`;
      const response = await axios.get(url, { timeout: 8000 });
      const data = response?.data || {};
      const cand = Number(data.salePriceU || data.priceU || data.basicPriceU || 0);
      if (!isNaN(cand) && cand > 0) {
        basketPrice = cand;
        source = 'basket-cdn';
        product = { id: nm, name: data.imt_name || '', brand: data.selling?.brand_name || '' };
      }
    } catch (e) {}
  }

  // Fallback: HTML
  if (!product && basketPrice === 0) {
    const htmlData = await fetchFromHtml(nm);
    if (htmlData && htmlData.price > 0) {
      return res.json({
        nm,
        name: htmlData.name || '',
        brand: htmlData.brand || '',
        sellerId: '',
        price: htmlData.price,
        currency: htmlData.currency || 'RUB',
        rating: 0,
        feedbacks: 0,
        images: 0,
        stocksQty: 0,
        warehouses: [],
        destUsed: '',
        source: htmlData.source || 'html',
        domain
      });
    }
  }

  if (!product) {
    return res.status(404).json({ error: 'Товар не найден' });
  }

  // Извлекаем данные
  let priceU = extractPrice(product);
  if (basketPrice > 0 && priceU === 0) priceU = basketPrice;

  // Дополнительные поля
  const name = product.name || product.imt_name || '';
  const brand = product.brand || product.selling?.brand_name || '';
  const sellerId = product.sellerId || product.supplierId || '';
  
  // Юридическое лицо продавца
  let storeName = product.supplier || ''; // fallback: краткое торговое название из API
  
  if (sellerId) {
    // 1. Проверяем статическую базу
    if (SELLERS_DB[String(sellerId)]) {
      storeName = SELLERS_DB[String(sellerId)].legalName || storeName;
      console.log(`✓ Из базы для ${sellerId}: ${storeName}`);
    } else {
      // 2. Парсим со страницы продавца на WB
      const legalName = await fetchLegalEntityName(sellerId);
      if (legalName) {
        storeName = legalName;
        console.log(`✓ Спарсено для ${sellerId}: ${storeName}`);
      } else {
        console.log(`⚠ Для ${sellerId} используем краткое название: ${storeName}`);
      }
    }
  }
  
  // Категория товара
  let category = '';
  if (product.subjectName) {
    category = product.subjectName;
  } else if (product.subjectId) {
    // Маппинг популярных subjectId на названия категорий
    const subjectMap = {
      // Одежда женская
      128: 'Блузки и рубашки', 129: 'Брюки', 130: 'Верхняя одежда', 131: 'Джемперы, свитеры, кардиганы',
      132: 'Джинсы', 133: 'Комбинезоны', 134: 'Костюмы', 135: 'Платья', 136: 'Юбки', 143: 'Футболки и топы',
      // Одежда мужская
      1652: 'Футболки', 1653: 'Джинсы', 1654: 'Рубашки', 1655: 'Брюки',
      // Белье и носки
      163: 'Носки', 164: 'Колготки, чулки, гольфы', 6397: 'Нижнее белье',
      // Спорт
      177: 'Спортивные костюмы', 299: 'Спортивное питание', 685: 'Спортивные товары',
      // Обувь
      306: 'Кроссовки и кеды', 311: 'Ботинки', 312: 'Сапоги', 1851: 'Туфли', 2094: 'Сандалии',
      // Электроника
      566: 'Смартфоны', 851: 'Ноутбуки', 1051: 'Планшеты', 2675: 'Чехлы для телефонов',
      1652: 'Наушники', 2389: 'Умные часы', 3902: 'Зарядные устройства',
      // Дом и интерьер
      1619: 'Постельное белье', 2553: 'Посуда', 4604: 'Текстиль для дома', 5503: 'Мебель',
      // Красота и здоровье
      1346: 'Помада', 1645: 'Крем для лица', 2398: 'Парфюмерия', 3618: 'Средства для волос',
      // Детям
      5508: 'Игрушки', 4198: 'Товары для детей', 1106: 'Детская одежда',
      // Аксессуары
      1587: 'Сумки', 1680: 'Рюкзаки', 2674: 'Кошельки', 1456: 'Ремни',
      // Автотовары
      1142: 'Автотовары', 4604: 'Аксессуары для авто'
    };
    category = subjectMap[product.subjectId] || `Категория ${product.subjectId}`;
  }
  
  // Цвет товара - берем первый цвет (основной для данного артикула)
  let color = '';
  if (Array.isArray(product.colors) && product.colors.length > 0) {
    color = product.colors[0].name || '';
  }
  
  const rating = product.rating || 0;
  const feedbacks = product.feedbacks || 0;
  const images = Array.isArray(product.pics) ? product.pics.length : (Array.isArray(product.images) ? product.images.length : 0);

  // Главное фото товара - используем прямой URL с корректным форматом
  let mainImage = '';
  if (product.id || nm) {
    const productId = product.id || nm;
    const vol = Math.floor(productId / 100000);
    const part = Math.floor(productId / 1000);
    let picNum = 1;
    if (Array.isArray(product.pics) && product.pics.length > 0) {
      picNum = product.pics[0];
    } else if (Array.isArray(product.colors) && product.colors.length > 0 && Array.isArray(product.colors[0].pics)) {
      picNum = product.colors[0].pics[0] || 1;
    }
    // Генерируем прямые URL для разных CDN (браузер попробует сам)
    const basketNum = String(1 + (vol % 20)).padStart(2, '0');
    mainImage = `https://basket-${basketNum}.wbbasket.ru/vol${vol}/part${part}/${productId}/images/big/${picNum}.webp`;
  }

  // Остатки и склады
  const { totalQty, warehouses, warehousesQty } = summarizeStocks(product);

  // Валюта по домену
  let currency = 'RUB';
  if (domain === 'kg') currency = 'KGS';
  else if (domain === 'kz') currency = 'KZT';

  // Отладка: выводим данные в консоль сервера
  console.log('Product ID:', product.id || nm, 'mainImage URL:', mainImage);
  if (Array.isArray(product.pics)) console.log('pics:', product.pics.slice(0, 3));

  return res.json({
    nm,
    name,
    brand,
    sellerId,
    storeName,
    category,
    color,
    price: priceU > 0 ? priceU / 100 : 0,
    currency,
    rating,
    feedbacks,
    images,
    mainImage,
    stocksQty: totalQty,
    warehouses,
    warehousesQty,
    destUsed: destUsed || '',
    source: source || 'unknown',
    domain
  });
});

// ===== Max CSV endpoint: rich, single-row data for Sheets =====
app.get('/wb-max-csv', async (req, res) => {
  const nm = String(req.query.nm || '').trim();
  const dest = String(req.query.dest || '').trim();
  const domain = String(req.query.domain || 'ru').trim();
  if (!nm) {
    res.status(400).type('text/csv').send('error,message\n400,Missing nm');
    return;
  }

  // Вспомогательная функция для безопасного получения значений
  function safeGet(obj, path, defVal) {
    try {
      const parts = String(path).split('.');
      let cur = obj;
      for (const p of parts) {
        if (cur == null) return defVal;
        cur = cur[p];
      }
      return cur == null ? defVal : cur;
    } catch (_) {
      return defVal;
    }
  }

  // Определение валюты по домену
  function currencyByDomain(d) {
    if (d === 'kg') return 'KGS';
    if (d === 'kz') return 'KZT';
    return 'RUB';
  }

  // Try v2 detail first with a few dests
  const destCandidates = [];
  if (dest) destCandidates.push(dest);
  destCandidates.push('-1257786','-1029256','-1059509');

  let product = null;
  let source = null;
  let priceU = 0;

  try {
    for (const d of destCandidates) {
      try {
        const url = `https://card.wb.ru/cards/v2/detail?appType=1&curr=rub&dest=${d}&nm=${nm}`;
        const r = await axios.get(url, { headers: { 'User-Agent': 'WildberriesApp/1.0' }, timeout: 10000 });
        const products = r?.data?.data?.products || [];
        if (products.length) {
          product = products.find(p => String(p.id) === String(nm)) || products[0];
          source = `v2:${d}`;
          break;
        }
      } catch (_) {}
    }

    if (!product) {
      // v1 fallback
      try {
        const url = `https://card.wb.ru/cards/v1/detail?appType=1&curr=rub&nm=${nm}`;
        const r = await axios.get(url, { headers: { 'User-Agent': 'WildberriesApp/1.0' }, timeout: 10000 });
        const products = r?.data?.data?.products || [];
        if (products.length) {
          product = products[0];
          source = 'v1';
        }
      } catch (_) {}
    }

    // Basket CDN
    let basketPrice = 0;
    if (!product) {
      try {
        const vol = Math.floor(nm / 100000);
        const part = Math.floor(nm / 1000);
        const url = `https://basket-01.wb.ru/vol${vol}/part${part}/${nm}/info/ru/card.json`;
        const r = await axios.get(url, { timeout: 8000 });
        const data = r?.data || {};
        const cand = Number(data.salePriceU || data.priceU || data.basicPriceU || 0);
        if (!isNaN(cand) && cand > 0) {
          basketPrice = cand;
          source = 'basket';
        }
      } catch (_) {}
    }

    // HTML fallback
    let htmlPrice = 0;
    if (!product && basketPrice === 0) {
      try {
        const host = domain === 'kg' ? 'www.wildberries.kg' : domain === 'kz' ? 'www.wildberries.kz' : 'www.wildberries.ru';
        const url = `https://${host}/catalog/${nm}/detail.aspx`;
        const r = await axios.get(url, { timeout: 12000 });
        const html = String(r?.data || '');
        const m = html.match(/salePriceU":(\d+)/) || html.match(/priceU":(\d+)/);
        if (m) {
          htmlPrice = Number(m[1]);
          source = `html:${domain}`;
        }
      } catch (_) {}
    }

    if (product) priceU = extractPrice(product);
    if ((!priceU || priceU <= 0) && basketPrice > 0) priceU = basketPrice;
    if ((!priceU || priceU <= 0) && htmlPrice > 0) priceU = htmlPrice;

    const price = priceU > 0 ? (priceU / 100) : 0;
    const name = safeGet(product, 'name', '') || safeGet(product, 'product', '');
    const brand = safeGet(product, 'brand', '');
    const sellerId = safeGet(product, 'sellerId', '') || safeGet(product, 'supplierId', '');
    const rating = safeGet(product, 'rating', 0);
    const feedbacks = safeGet(product, 'feedbacks', 0);
    const pics = Array.isArray(product?.pics) ? product.pics.length : (Array.isArray(product?.images) ? product.images.length : 0);
    const { totalQty, warehouses } = summarizeStocks(product || {});
    const destUsed = source && source.startsWith('v2:') ? source.split(':')[1] : (dest || '');
    const currency = currencyByDomain(domain);
    const url = domain === 'kg' ? `https://www.wildberries.kg/catalog/${nm}/detail.aspx` : domain === 'kz' ? `https://www.wildberries.kz/catalog/${nm}/detail.aspx` : `https://www.wildberries.ru/catalog/${nm}/detail.aspx`;

    const header = [
      'nm','name','brand','sellerId','storeName','category','color','price','currency','destUsed','domain','source','rating','feedbacks','images','stocksTotalQty','warehouses','url'
    ];
    
    // Юридическое лицо продавца
    let storeName = safeGet(product, 'supplier', '') || ''; // fallback: краткое название из API
    
    if (sellerId) {
      // 1. Проверяем статическую базу
      if (SELLERS_DB[String(sellerId)]) {
        storeName = SELLERS_DB[String(sellerId)].legalName || storeName;
      } else {
        // 2. Парсим со страницы продавца на WB
        const legalName = await fetchLegalEntityName(sellerId);
        if (legalName) {
          storeName = legalName;
        }
      }
    }
    
    // Категория
    let category = '';
    if (product && product.subjectName) {
      category = product.subjectName;
    } else if (product && product.subjectId) {
      const subjectMap = {
        // Одежда
        128: 'Блузки и рубашки', 129: 'Брюки', 130: 'Верхняя одежда', 131: 'Джемперы, свитера, кардиганы',
        132: 'Джинсы', 133: 'Комбинезоны', 134: 'Костюмы', 135: 'Платья', 136: 'Юбки', 143: 'Футболки и топы',
        1652: 'Футболки', 1653: 'Джинсы', 1654: 'Рубашки', 1655: 'Брюки',
        // Белье и носки
        163: 'Носки', 164: 'Колготки, чулки, гольфы', 6397: 'Нижнее белье',
        // Спорт
        177: 'Спортивные костюмы', 299: 'Спортивное питание', 685: 'Спортивные товары',
        // Обувь
        306: 'Кроссовки и кеды', 311: 'Ботинки', 312: 'Сапоги', 1851: 'Туфли', 2094: 'Сандалии',
        // Электроника
        566: 'Смартфоны', 851: 'Ноутбуки', 1051: 'Планшеты', 2675: 'Чехлы для телефонов',
        2389: 'Умные часы', 3902: 'Зарядные устройства',
        // Дом
        1619: 'Постельное белье', 2553: 'Посуда', 4604: 'Текстиль для дома', 5503: 'Мебель',
        // Красота
        1346: 'Помада', 1645: 'Крем для лица', 2398: 'Парфюмерия', 3618: 'Средства для волос',
        // Детям
        5508: 'Игрушки', 4198: 'Товары для детей', 1106: 'Детская одежда',
        // Аксессуары
        1587: 'Сумки', 1680: 'Рюкзаки', 2674: 'Кошельки', 1456: 'Ремни',
        // Авто
        1142: 'Автотовары'
      };
      category = subjectMap[product.subjectId] || `Категория ${product.subjectId}`;
    }
    
    // Цвет - берем первый цвет
    let color = '';
    if (product && Array.isArray(product.colors) && product.colors.length > 0) {
      color = product.colors[0].name || '';
    }
    
    const row = [
      nm,
      String(name).replace(/"/g,'""'),
      String(brand).replace(/"/g,'""'),
      String(sellerId),
      String(storeName).replace(/"/g,'""'),
      String(category).replace(/"/g,'""'),
      String(color).replace(/"/g,'""'),
      String(price),
      currency,
      String(destUsed),
      domain,
      String(source || 'unknown'),
      String(rating || 0),
      String(feedbacks || 0),
      String(pics || 0),
      String(totalQty || 0),
      String(warehouses.join('|')),
      url
    ];

    const csv = `${header.join(',')}\n"${row[0]}","${row[1]}","${row[2]}","${row[3]}","${row[4]}","${row[5]}","${row[6]}","${row[7]}","${row[8]}","${row[9]}","${row[10]}","${row[11]}","${row[12]}","${row[13]}","${row[14]}","${row[15]}","${row[16]}","${row[17]}"`;
    res.status(200).type('text/csv').send(csv);
  } catch (e) {
    res.status(500).type('text/csv').send('error,message\n500,Internal error');
  }
});