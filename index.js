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
    
    // Имитация "человеческого" поведения - ждем перед запросом
    await randomDelay(1, 3);
    
    // Вычисляем basket URL по формуле WB
    const vol = Math.floor(nm / 100000);
    const part = Math.floor(nm / 1000);
    
    // Пробуем card API с хорошими заголовками
    const cardUrl = `https://card.wb.ru/cards/v1/detail?appType=1&curr=rub&dest=-1257786&spp=30&nm=${nm}`;
    
    console.log('Trying card API:', cardUrl);
    
    try {
      const cardResp = await axios.get(cardUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'ru-RU,ru;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Referer': 'https://www.wildberries.ru/'
        },
        timeout: 8000
      });
      
      const product = cardResp.data?.data?.products?.[0];
      if (product) {
        const priceRaw = product.salePriceU || product.priceU;
        if (priceRaw) {
          console.log('Success! Price found:', priceRaw / 100);
          return res.json({
            nm: product.id,
            price: priceRaw / 100,
            name: product.name,
            brand: product.brand,
            rating: product.rating
          });
        }
      }
    } catch (cardErr) {
      console.log('Card API failed, trying basket...', cardErr.message);
    }
    
    // Если card API не сработал, ждем еще и пробуем basket
    await randomDelay(2, 4);
    
    // Пробуем разные basket хосты
    const hosts = [
      'basket-01.wbbasket.ru',
      'basket-02.wbbasket.ru',
      'basket-03.wbbasket.ru',
      'basket-04.wbbasket.ru',
      'basket-05.wbbasket.ru'
    ];
    
    // Перемешиваем хосты для случайности
    const shuffledHosts = hosts.sort(() => Math.random() - 0.5);
    
    for (const host of shuffledHosts.slice(0, 2)) {
      try {
        const priceUrl = `https://${host}/vol${vol}/part${part}/${nm}/info/price-history.json`;
        
        console.log('Trying basket:', priceUrl);
        
        await delay(500); // Небольшая задержка между хостами
        
        const priceResp = await axios.get(priceUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          },
          timeout: 5000
        });
        
        if (priceResp.data && priceResp.data.length > 0) {
          const latest = priceResp.data[priceResp.data.length - 1];
          const price = latest.price?.RUB / 100 || 0;
          
          console.log('Success from basket! Price:', price);
          
          return res.json({
            nm,
            price,
            currency: 'RUB',
            timestamp: latest.dt
          });
        }
      } catch (err) {
        console.log('Basket failed:', host, err.message);
        continue;
      }
    }
    
    throw new Error('Все методы не сработали');

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
