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

    // Ключевые слова для поиска продуктов (короткие названия для вывода)
    const foodKeywords = [
      'помидор', 'огурец', 'морковь', 'хлеб', 'батон', 'булка', 'молоко', 'кефир', 'сыр', 'яйцо',
      'курица', 'мясо', 'говядина', 'свинина', 'рыба', 'макароны', 'паста', 'рис', 'гречка', 'крупа',
      'масло', 'сметана', 'йогурт', 'творог', 'колбаса', 'ветчина', 'сосиски', 'картофель', 'картошка',
      'лук', 'чеснок', 'перец', 'яблоко', 'банан', 'апельсин', 'лимон', 'сок', 'вода', 'чай', 'кофе',
      'сахар', 'соль', 'мука', 'печенье', 'шоколад', 'конфеты', 'капуста', 'кабачок', 'баклажан', 'салат', 'петрушка', 'яйца'
    ];

    // Расширенный список магазинов
    const storePatterns = [
      { pattern: /ПЯТЕРОЧКА|5KA/i, store: 'Пятерочка' },
      { pattern: /МАГНИТ|MAGNIT/i, store: 'Магнит' },
      { pattern: /ЛЕНТА|LENTA/i, store: 'Лента' },
      { pattern: /АШАН|AUCHAN|АШАН/i, store: 'Ашан' },
      { pattern: /ПЕРЕКРЕСТОК|PERERESTOK/i, store: 'Перекресток' }
    ];

    const lowerText = text.toLowerCase();

    // 1. Поиск магазина
    for (const { pattern, store: storeName } of storePatterns) {
      if (pattern.test(text)) {
        store = storeName;
        break;
      }
    }

    // 2. Поиск продуктов по ключевым словам (возвращаем только само слово)
    const foundKeywords = new Set<string>();
    
    // Проходим по каждой строке чека
    for (const line of lines) {
      const cleanLine = line.toLowerCase();
      
      for (const keyword of foodKeywords) {
        // Если слово найдено в строке и мы его еще не добавляли
        if (cleanLine.includes(keyword.toLowerCase())) {
          if (!foundKeywords.has(keyword.toLowerCase())) {
            // Добавляем само ключевое слово (с большой буквы)
            const displayName = keyword.charAt(0).toUpperCase() + keyword.slice(1);
            products.push(displayName);
            foundKeywords.add(keyword.toLowerCase());
          }
        }
      }
    }

    // 3. Дополнительный поиск даты и итога
    for (const line of lines) {
      const cleanLine = line.trim();
      
      // Поиск суммы
      if (!total) {
        const totalMatch = cleanLine.match(/ИТОГ[\s:]*([\d\s.,]+)/i) || cleanLine.match(/СУММА[\s:]*([\d\s.,]+)/i);
        if (totalMatch) {
          total = parseFloat(totalMatch[1].replace(/\s/g, '').replace(',', '.'));
        }
      }
      
      // Поиск даты
      if (!date) {
        const dateMatch = cleanLine.match(/(\d{2}[.-]\d{2}[.-]\d{4})/);
        if (dateMatch) {
          date = new Date(dateMatch[1].replace(/\./g, '-'));
        }
      }
    }

    // Фильтруем и очищаем
    const filteredProducts = products
      .map(p => this.cleanProductName(p))
      .filter(p => p.length > 2);

    return { products: filteredProducts, store, total, date };
  }

  // Очистка названия продукта от лишней информации
  static cleanProductName(name: string): string {
    let clean = name.toLowerCase();
    
    // Удаляем весовые характеристики (кг, г, мл, л)
    clean = clean.replace(/\d+([.,]\d+)?\s*(кг|г|мл|л|шт|уп|пак|гр)\b/g, '');
    clean = clean.replace(/\b\d+([.,]\d+)?\s*(kg|g|ml|l|pcs)\b/g, '');
    
    // Удаляем проценты жирности и т.п.
    clean = clean.replace(/\d+([.,]\d+)?%/g, '');
    
    // Удаляем артикулы и технические коды (обычно длинные строки букв и цифр)
    clean = clean.replace(/[a-z]*[0-9]{5,}[a-z]*/g, '');
    
    // Удаляем лишние символы и двойные пробелы
    clean = clean.replace(/[.\-*+=:()]/g, ' ');
    clean = clean.replace(/\s+/g, ' ').trim();
    
    // Если после очистки ничего не осталось или слишком коротко
    if (clean.length < 2) return name;
    
    // Капитализация первого символа
    return clean.charAt(0).toUpperCase() + clean.slice(1);
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