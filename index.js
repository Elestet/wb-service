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
    // Формируем прямую ссылку на статические данные товара в CDN
    const vol = Math.floor(nm / 100000);
    const part = Math.floor(nm / 1000);
    
    // Основной URL к карточке товара на CDN
    const cardUrl = `https://basket-${String(vol % 20).padStart(2, '0')}.wbbasket.ru/vol${vol}/part${part}/${nm}/info/ru/card.json`;
    
    console.log('Fetching from CDN:', cardUrl);
    
    const response = await axios.get(cardUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      },
      timeout: 8000
    });

    const data = response.data;
    
    // Извлекаем цену из ответа
    const price = (data.extended?.basicPriceU || data.priceU || data.salePriceU || 0) / 100;
    
    if (price === 0) {
      return res.status(404).json({ error: 'цена не найдена' });
    }

    console.log('Success! Price:', price);

    return res.json({
      nm: data.nm_id || nm,
      name: data.imt_name || 'Unknown',
      price: price,
      brand: data.selling?.brand_name || data.brand || 'Unknown'
    });

  } catch (e) {
    console.error('CDN ERROR:', e.message);
    
    // Запасной вариант - пробуем другие basket серверы
    for (let i = 1; i <= 10; i++) {
      try {
        const vol = Math.floor(nm / 100000);
        const part = Math.floor(nm / 1000);
        const basketNum = String(i).padStart(2, '0');
        const url = `https://basket-${basketNum}.wbbasket.ru/vol${vol}/part${part}/${nm}/info/ru/card.json`;
        
        console.log('Trying basket', basketNum);
        
        const resp = await axios.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 5000
        });
        
        const data = resp.data;
        const price = (data.extended?.basicPriceU || data.priceU || data.salePriceU || 0) / 100;
        
        if (price > 0) {
          return res.json({
            nm: data.nm_id || nm,
            name: data.imt_name || 'Unknown',
            price: price,
            brand: data.selling?.brand_name || 'Unknown'
          });
        }
      } catch (err) {
        continue;
      }
    }
    
    res.status(500).json({ 
      error: 'не удалось получить данные',
      details: e.message
    });
  }
});

app.listen(PORT, () => {
  console.log('WB price service started on port', PORT);
});
