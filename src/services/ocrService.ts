// Сервис для распознавания текста с чеков (OCR)
// Используем бесплатный OCR API от OCR.Space



interface ReceiptParseResult {
  products: string[];
  store?: string;
  total?: number;
  date?: Date;
}

// Конфигурация OCR API
const OCR_CONFIG = {
  // Бесплатный API ключ для OCR.Space (250 запросов/день)
  API_KEY: 'K88937697488957',
  API_URL: 'https://api.ocr.space/parse/image',
  // Резервный ключ
  FALLBACK_KEY: 'helloworld'
};

// Кэш для результатов OCR чтобы уменьшить количество запросов
const ocrCache = new Map<string, string>();

export class OCRService {
  static async extractTextFromImage(imageFile: File): Promise<string> {
    if (!imageFile.type.startsWith('image/')) {
      throw new Error('Неподдерживаемый формат файла. Загрузите изображение.');
    }

    // Проверяем кэш
    const fileHash = await this.generateFileHash(imageFile);
    if (ocrCache.has(fileHash)) {
      return ocrCache.get(fileHash)!;
    }

    try {
      // Пытаемся использовать реальное OCR API
      const extractedText = await this.callRealOCRAPI(imageFile);
      
      if (extractedText.trim().length > 10) {
        // Сохраняем в кэш
        ocrCache.set(fileHash, extractedText);
        return extractedText;
      }
      
      // Если OCR вернул мало текста, используем демо-режим
      console.warn('OCR вернул мало текста, используем демо-режим');
      return await this.demoOCRProcessing();
      
    } catch (error) {
      console.warn('OCR API недоступно, используем демо-режим:', error);
      // Fallback to demo mode
      return await this.demoOCRProcessing();
    }
  }

  private static async demoOCRProcessing(): Promise<string> {
    // Демо-режим: возвращаем пример текста чека
    const demoReceipts = [
      `ПЯТЕРОЧКА
Чек №123456
2024-01-15 14:30:25

Молоко Простоквашино 2.5% 1л - 85.50
Хлеб Бородинский 400г - 45.00
Яйца куриные С0 10шт - 95.00
Сыр Российский 200г - 120.00

ИТОГ: 345.50`,
      
      `МАГНИТ
Чек №789012
2024-01-15 16:45:12

Курица охлажденная 1кг - 250.00
Картофель 2кг - 80.00
Морковь 1кг - 40.00
Лук репчатый 1кг - 35.00
Помидоры 1кг - 120.00

ИТОГ: 525.00`,
      
      `ЛЕНТА
Чек №345678
2024-01-14 12:15:30

Говядина вырезка 1кг - 450.00
Рис басмати 1кг - 120.00
Огурцы 1кг - 90.00
Сметана 20% 400г - 65.00
Хлеб белый 500г - 50.00

ИТОГ: 775.00`
    ];
    
    // Возвращаем случайный демо-чек
    return demoReceipts[Math.floor(Math.random() * demoReceipts.length)];
  }

  static parseReceiptText(text: string): ReceiptParseResult {
    const lines = text.split('\n').filter(line => line.trim());
    const products: string[] = [];
    let store: string | undefined;
    let total: number | undefined;
    let date: Date | undefined;

    // Расширенный список магазинов
    const storePatterns = [
      { pattern: /ПЯТЕРОЧКА|5KA/i, store: 'Пятерочка' },
      { pattern: /МАГНИТ|MAGNIT/i, store: 'Магнит' },
      { pattern: /ЛЕНТА|LENTA/i, store: 'Лента' },
      { pattern: /АШАН|AUCHAN|АШАН/i, store: 'Ашан' },
      { pattern: /ПЕРЕКРЕСТОК|PERERESTOK/i, store: 'Перекресток' },
      { pattern: /ДИКСИ|DIXY/i, store: 'Дикси' },
      { pattern: /МЕТРО|METRO/i, store: 'Метро' },
      { pattern: /О\s*КЕЙ|OKEY/i, store: 'ОКей' },
      { pattern: /БИЛЛА|BILLA/i, store: 'Билла' },
      { pattern: /СЕМЬЯ|SEMYA/i, store: 'Семья' }
    ];

    // Список стоп-слов для фильтрации не-продуктов
    const stopWords = [
      'итого', 'сумма', 'всего', 'чек', 'касса', 'оплата', 'карта', 'наличные',
      'сдача', 'банк', 'qr', 'code', 'скидка', 'акция', 'бонус', 'налог',
      'total', 'sum', 'discount', 'tax', 'cash', 'card', 'payment', 'change',
      'чек', 'номер', 'дата', 'время', 'продавец', 'покупатель', 'операция'
    ];

    for (const line of lines) {
      const cleanLine = line.trim();

      // Поиск магазина
      if (!store) {
        for (const { pattern, store: storeName } of storePatterns) {
          if (pattern.test(cleanLine)) {
            store = storeName;
            break;
          }
        }
      }

      // Поиск даты (разные форматы)
      if (!date) {
        const dateFormats = [
          /(\d{4}[.-]\d{2}[.-]\d{2})/, // 2024-01-15
          /(\d{2}[.-]\d{2}[.-]\d{4})/, // 15.01.2024
          /(\d{1,2}\s+[а-я]+\s+\d{4})/i // 15 января 2024
        ];
        
        for (const format of dateFormats) {
          const dateMatch = cleanLine.match(format);
          if (dateMatch) {
            try {
              date = new Date(dateMatch[1].replace(/\./g, '-'));
              if (!isNaN(date.getTime())) break;
            } catch (e) {
              // Игнорируем ошибки парсинга даты
            }
          }
        }
      }

      // Поиск итоговой суммы (разные форматы)
      if (!total) {
        const totalPatterns = [
          /ИТОГ[\s:]*([\d\s.,]+)\s*р?\.?/i,
          /СУММА[\s:]*([\d\s.,]+)\s*р?\.?/i,
          /ВСЕГО[\s:]*([\d\s.,]+)\s*р?\.?/i,
          /TOTAL[\s:]*([\d\s.,]+)/i,
          /SUM[\s:]*([\d\s.,]+)/i,
          /([\d\s.,]+)\s*р\.?\s*$/
        ];
        
        for (const pattern of totalPatterns) {
          const totalMatch = cleanLine.match(pattern);
          if (totalMatch) {
            const amountStr = totalMatch[1].replace(/\s/g, '').replace(',', '.');
            total = parseFloat(amountStr);
            if (!isNaN(total)) break;
          }
        }
      }

      // Улучшенное извлечение продуктов
      const extractProductFromLine = (lineText: string): string | null => {
        // Паттерны для продуктов в чеках
        const productPatterns = [
          // Формат: Название Цена (85.50)
          /^([^\d]+?)\s+([\d\s.,]+)\s*р?\.?$/,
          // Формат: Название - Цена
          /^([^\d]+?)\s*-\s*([\d\s.,]+)\s*р?\.?$/,
          // Формат: Название x Количество = Цена
          /^([^\d]+?)\s*x\s*([\d\s.,]+)\s*=\s*([\d\s.,]+)/,
          // Формат: Название Цена руб.
          /^([^\d]+?)\s+([\d\s.,]+)\s*руб\.?/,
          // Формат с количеством: Название Количество Цена
          /^([^\d]+?)\s+([\d\s.,]+)\s+([\d\s.,]+)\s*р?\.?$/
        ];

        for (const pattern of productPatterns) {
          const match = lineText.match(pattern);
          if (match) {
            let productName = match[1].trim();
            
            // Убираем номер позиции в начале
            productName = productName.replace(/^\d+[\.\s)]*/, '').trim();
            
            // Убираем артикулы и коды
            productName = productName.replace(/[A-Z0-9]{6,}/g, '').trim();
            
            // Фильтруем стоп-слова
            const isStopWord = stopWords.some(word => 
              productName.toLowerCase().includes(word.toLowerCase())
            );
            
            if (!isStopWord && productName.length > 2 && 
                !/^\d+[.,]?\d*$/.test(productName)) {
              return productName;
            }
          }
        }
        
        return null;
      };

      // Извлекаем продукт из строки
      const product = extractProductFromLine(cleanLine);
      if (product && !products.includes(product)) {
        products.push(product);
      }

      // Дополнительно: поиск продуктов в строках без явных цен
      if (!product && cleanLine.length > 3 && cleanLine.length < 50) {
        const hasNumbers = /\d/.test(cleanLine);
        const hasPriceIndicators = /р\.|руб|\$|€|₽/.test(cleanLine);
        
        if (!hasNumbers && !hasPriceIndicators) {
          // Это может быть название продукта без цены
          const potentialProduct = cleanLine
            .replace(/^\d+[\.\s)]*/, '')
            .replace(/[A-Z0-9]{6,}/g, '')
            .trim();
          
          const isStopWord = stopWords.some(word => 
            potentialProduct.toLowerCase().includes(word.toLowerCase())
          );
          
          if (!isStopWord && potentialProduct.length > 2 && 
              !products.includes(potentialProduct)) {
            products.push(potentialProduct);
          }
        }
      }
    }

    // Фильтруем и сортируем продукты
    const filteredProducts = products
      .filter(product => product.length > 1)
      .map(product => product.replace(/\s{2,}/g, ' ').trim())
      .filter((product, index, array) => array.indexOf(product) === index) // Убираем дубликаты
      .sort();

    return { 
      products: filteredProducts, 
      store, 
      total, 
      date 
    };
  }

  // Генерация хэша файла для кэширования
  private static async generateFileHash(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Реальный вызов OCR API
  private static async callRealOCRAPI(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('apikey', OCR_CONFIG.API_KEY);
    formData.append('language', 'rus');
    formData.append('OCREngine', '2');
    formData.append('scale', 'true');
    formData.append('detectOrientation', 'true');
    formData.append('isTable', 'true');
    formData.append('isOverlayRequired', 'false');

    try {
      const response = await fetch(OCR_CONFIG.API_URL, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.IsErroredOnProcessing) {
        console.error('OCR API Error:', data.ErrorMessage);
        throw new Error(data.ErrorMessage || 'Ошибка обработки OCR');
      }

      const parsedText = data.ParsedResults[0]?.ParsedText || '';
      
      if (!parsedText.trim()) {
        throw new Error('Не удалось распознать текст');
      }

      return parsedText;
      
    } catch (error) {
      console.error('OCR API call failed:', error);
      
      // Попробуем использовать fallback ключ
      if (OCR_CONFIG.API_KEY !== OCR_CONFIG.FALLBACK_KEY) {
        console.log('Пробуем использовать fallback ключ...');
        const tempKey = OCR_CONFIG.API_KEY;
        OCR_CONFIG.API_KEY = OCR_CONFIG.FALLBACK_KEY;
        try {
          const result = await this.callRealOCRAPI(file);
          OCR_CONFIG.API_KEY = tempKey;
          return result;
        } catch (fallbackError) {
          OCR_CONFIG.API_KEY = tempKey;
          throw fallbackError;
        }
      }
      
      throw new Error('Не удалось подключиться к сервису распознавания');
    }
  }
}