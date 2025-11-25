const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

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
  res.send('<html><head><title>WB Price Service</title></head><body><h1>WB Price Service</h1><p>Service is running</p><p>Usage: <a href="/wb-price?nm=245490050">/wb-price?nm=245490050</a></p></body></html>');
});

// GET /wb-price?nm=АРТИКУЛ
app.get('/wb-price', async (req, res) => {
  const nm = req.query.nm;
  if (!nm) {
    return res.status(400).json({ error: 'nm (артикул) обязателен' });
  }

  try {
    console.log('Request for nm:', nm);
    
    // Используем публичный поиск WB - менее строгий
    const searchUrl = `https://search.wb.ru/exactmatch/ru/common/v5/search?ab_testing=false&appType=1&curr=rub&dest=-1257786&query=${nm}&resultset=catalog&sort=popular&spp=30&suppressSpellcheck=false`;
    
    console.log('Trying search API');
    
    const searchResp = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Language': 'ru',
        'Origin': 'https://www.wildberries.ru',
        'Referer': 'https://www.wildberries.ru/'
      },
      timeout: 10000
    });

    const products = searchResp.data?.data?.products;
    if (!products || products.length === 0) {
      return res.status(404).json({ error: 'товар не найден' });
    }

    // Ищем точное совпадение по артикулу
    let product = products.find(p => String(p.id) === String(nm));
    if (!product) {
      product = products[0];
    }
    
    const priceRaw = product.salePriceU || product.priceU;
    if (!priceRaw) {
      return res.status(404).json({ error: 'цена не найдена' });
    }

    const price = priceRaw / 100;

    console.log('Success! Found:', product.name, 'Price:', price);

    res.json({
      nm: product.id,
      name: product.name,
      price,
      brand: product.brand,
      rating: product.rating,
      feedbacks: product.feedbacks
    });

  } catch (e) {
    console.error('WB ERROR:', e.response?.status, e.message);
    res.status(500).json({ 
      error: 'wb request failed',
      details: e.message,
      status: e.response?.status
    });
  }
});

app.listen(PORT, () => {
  console.log('WB price service started on port', PORT);
});
