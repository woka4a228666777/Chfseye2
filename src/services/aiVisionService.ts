// Конфигурация AI сервисов
// Теперь используем TensorFlow.js прямо в браузере!
// Это бесплатно, работает без интернета и не требует API ключей.

interface AIVisionResult {
  products: {
    name: string;
    category: string;
    confidence: number;
    id?: string;
  }[];
  success: boolean;
  confidence: number;
  processingTime: number;
  modelUsed?: string;
  rawCaption?: string;
}

declare global {
  interface Window {
    cocoSsd: any;
  }
}

class AIVisionService {
  private static model: any = null;

  private static getApiKey() {
    let key = import.meta.env.VITE_LOGMEAL_API_KEY;
    if (key) {
      key = key.trim(); // Убираем возможные пробелы/переносы строк
      console.log('[AIVisionService] API Ключ найден. Длина:', key.length, 'Первые 4 символа:', key.substring(0, 4));
    } else {
      console.log('[AIVisionService] API Ключ ОТСУТСТВУЕТ в import.meta.env');
    }
    return key;
  }

  static async init() {
    console.log('[AIVisionService] Инициализация TensorFlow.js COCO-SSD...');
    try {
      if (!this.model && window.cocoSsd) {
        this.model = await window.cocoSsd.load();
        console.log('[AIVisionService] Модель загружена успешно');
      }
    } catch (e) {
      console.error('[AIVisionService] Ошибка загрузки модели:', e);
    }
  }

  // Проверка статуса
  static async checkServerStatus(): Promise<{loaded: boolean, status: string, type: string, error?: string}> {
    const key = this.getApiKey();
    const hasLogMealKey = !!key && key !== 'YOUR_LOGMEAL_API_KEY_HERE' && key.length > 5;
    
    if (hasLogMealKey) {
      return { loaded: true, status: 'Ready', type: 'LogMeal API (Cloud AI)' };
    }

    if (this.model) {
      return { loaded: true, status: 'Ready', type: 'Browser-side AI (Fallback)' };
    }
    if (window.cocoSsd) {
      await this.init();
      return { loaded: !!this.model, status: this.model ? 'Ready' : 'Loading...', type: 'Browser-side AI' };
    }
    return { loaded: false, status: 'Scripts Missing', type: 'Browser-side AI' };
  }

  // Анализ изображения
  static async analyzeImage(imageFile: File, onProgress?: (msg: string) => void): Promise<AIVisionResult> {
    const key = this.getApiKey();
    const hasLogMealKey = !!key && key !== 'YOUR_LOGMEAL_API_KEY_HERE' && key.length > 5;

    console.log('[AIVisionService] analyzeImage called. hasLogMealKey:', hasLogMealKey);

    if (hasLogMealKey) {
      try {
        return await this.analyzeWithLogMeal(imageFile, onProgress, key);
      } catch (e) {
        console.warn('[AIVisionService] LogMeal failed, falling back to local...', e);
        return this.analyzeLocally(imageFile, onProgress);
      }
    }

    return this.analyzeLocally(imageFile, onProgress);
  }

  // Анализ через LogMeal API
  private static async analyzeWithLogMeal(imageFile: File, onProgress?: (msg: string) => void, apiKeyOverride?: string): Promise<AIVisionResult> {
    const startTime = Date.now();
    const apiKey = apiKeyOverride || this.getApiKey();
    onProgress?.('Отправка фото в LogMeal Cloud AI (Segmentation)...');
    
    console.log('[AIVisionService] v5: Запуск Segmentation API для распознавания нескольких объектов...');
    
    try {
      const createRequest = async (authHeader: string) => {
        const formData = new FormData();
        formData.append('image', imageFile);
        // Используем v2/image/segmentation/complete для распознавания всех объектов
        return fetch('https://api.logmeal.com/v2/image/segmentation/complete', {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Accept': 'application/json'
          },
          body: formData
        });
      };

      // Пробуем сначала с Bearer
      let response = await createRequest(`Bearer ${apiKey}`);

      // Если 401, пробуем Token
      if (response.status === 401) {
        console.warn('[AIVisionService] 401 с Bearer, пробуем Token...');
        response = await createRequest(`Token ${apiKey}`);
      }

      if (response.status === 401) {
        const errJson = await response.json().catch(() => ({}));
        console.error('[AIVisionService] 401 Unauthorized! Оба метода (Bearer/Token) отклонены.');
        console.error('[AIVisionService] Ответ сервера:', errJson);
        throw new Error(`API ключ LogMeal не авторизован (401): ${errJson.message || 'Проверьте ключ'}`);
      }

      if (!response.ok) {
        const errText = await response.text();
        console.error('[AIVisionService] LogMeal API Error:', errText);
        throw new Error(`LogMeal API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('[AIVisionService] LogMeal Segmentation Response:', data);

      const products: any[] = [];

      // Обработка формата v2/image/segmentation/complete
      // Извлекаем все распознанные сегменты (все продукты на фото)
      if (data.segmentation_results) {
        data.segmentation_results.forEach((seg: any, idx: number) => {
          if (seg.recognition_results && seg.recognition_results.length > 0) {
            // Берем самый вероятный вариант для каждого сегмента
            const bestResult = seg.recognition_results[0];
            
            // Проверяем на дубликаты (иногда один объект сегментируется дважды)
            const exists = products.some(p => p.name.toLowerCase() === this.translateToRussian(bestResult.name).toLowerCase());
            
            if (!exists) {
              products.push({
                name: this.translateToRussian(bestResult.name),
                category: this.categorizeProduct(bestResult.name),
                confidence: bestResult.prob || 0.9,
                id: `logmeal-seg-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`
              });
            }
          }
        });
      } else if (data.recognition_results) {
        // Fallback если вдруг вернулся формат обычного recognition
        data.recognition_results.forEach((res: any) => {
          products.push({
            name: this.translateToRussian(res.name),
            category: this.categorizeProduct(res.name),
            confidence: res.prob || 0.9,
            id: `logmeal-rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          });
        });
      }

      console.log('[AIVisionService] Итого распознано продуктов:', products.length, products);

      return {
        products,
        success: true,
        confidence: products.length > 0 ? Math.max(...products.map((p: any) => p.confidence)) : 0,
        processingTime: Date.now() - startTime,
        modelUsed: 'LogMeal Cloud AI (Multi-Object Segmentation)'
      };

    } catch (error) {
      console.error('[AIVisionService] Ошибка LogMeal API:', error);
      throw error;
    }
  }

  // Вынес локальный анализ в отдельный метод для удобства fallback
  private static async analyzeLocally(imageFile: File, onProgress?: (msg: string) => void): Promise<AIVisionResult> {
    const startTime = Date.now();
    try {
      if (!this.model) {
        onProgress?.('Загрузка локальной нейросети...');
        await this.init();
      }

      if (!this.model) throw new Error('Не удалось загрузить локальную модель');

      onProgress?.('Локальный анализ объектов...');
      const img = await this.fileToImage(imageFile);
      const predictions = await this.model.detect(img);

      const products = predictions
        .filter((p: any) => p.score > 0.4)
        .map((p: any) => ({
          name: this.translateToRussian(p.class),
          category: this.categorizeProduct(p.class),
          confidence: p.score,
          id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }));

      return {
        products,
        success: true,
        confidence: products.length > 0 ? Math.max(...products.map((p: any) => p.confidence)) : 0,
        processingTime: Date.now() - startTime,
        modelUsed: 'TensorFlow.js COCO-SSD (Local Fallback)'
      };
    } catch (e) {
      console.error('[AIVisionService] Ошибка локального анализа:', e);
      throw e;
    }
  }

  private static fileToImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Категоризация
  private static categorizeProduct(name: string): string {
    const lower = name.toLowerCase();
    if (['bottle', 'cup', 'wine glass', 'juice', 'water', 'milk', 'beer', 'wine', 'soda', 'beverage'].some(k => lower.includes(k))) return 'beverages';
    if (['apple', 'banana', 'orange', 'fruit', 'pear', 'grape', 'strawberry', 'lemon', 'cherry'].some(k => lower.includes(k))) return 'fruits';
    if (['broccoli', 'carrot', 'vegetable', 'tomato', 'cucumber', 'potato', 'onion', 'salad', 'pepper', 'garlic', 'cabbage', 'corn', 'zucchini', 'eggplant'].some(k => lower.includes(k))) return 'vegetables';
    if (['sandwich', 'hot dog', 'pizza', 'donut', 'cake', 'egg', 'cheese', 'meat', 'chicken', 'fish', 'beef', 'pork', 'yogurt', 'ham', 'sausage', 'tofu'].some(k => lower.includes(k))) return 'protein';
    if (['bread', 'pasta', 'rice', 'cereal', 'baguette', 'loaf', 'bun', 'toast', 'croissant'].some(k => lower.includes(k))) return 'carbs';
    return 'other';
  }

  // Словарь для перевода
  private static translateToRussian(name: string): string {
    const dict: Record<string, string> = {
      'apple': 'Яблоко',
      'banana': 'Банан',
      'orange': 'Апельсин',
      'broccoli': 'Брокколи',
      'carrot': 'Морковь',
      'hot dog': 'Хот-дог',
      'pizza': 'Пицца',
      'donut': 'Пончик',
      'cake': 'Торт',
      'sandwich': 'Сэндвич',
      'bottle': 'Бутылка',
      'wine glass': 'Бокал',
      'cup': 'Чашка',
      'bowl': 'Миска',
      'knife': 'Нож',
      'fork': 'Вилка',
      'spoon': 'Ложка',
      'egg': 'Яйцо',
      'milk': 'Молоко',
      'cheese': 'Сыр',
      'slice of cheese': 'Ломтик сыра',
      'bread': 'Хлеб',
      'meat': 'Мясо',
      'chicken': 'Курица',
      'fish': 'Рыба',
      'tomato': 'Помидор',
      'cherry tomato': 'Помидор черри',
      'cucumber': 'Огурец',
      'potato': 'Картофель',
      'onion': 'Лук',
      'garlic': 'Чеснок',
      'yogurt': 'Йогурт',
      'juice': 'Сок',
      'water': 'Вода',
      'beer': 'Пиво',
      'wine': 'Вино',
      'strawberry': 'Клубника',
      'lemon': 'Лимон',
      'pear': 'Груша',
      'grape': 'Виноград',
      'pepper': 'Перец',
      'baguette': 'Багет',
      'baguette with seeds': 'Багет с семенами',
      'tin loaf': 'Формовой хлеб',
      'loaf': 'Буханка хлеба',
      'bun': 'Булочка',
      'ham': 'Ветчина',
      'sausage': 'Колбаса',
      'cabbage': 'Капуста',
      'corn': 'Кукуруза',
      'zucchini': 'Кабачок',
      'eggplant': 'Баклажан',
      'pasta': 'Макароны',
      'rice': 'Рис'
    };
    
    let cleanName = name.toLowerCase().trim();
    
    // Пытаемся найти точное совпадение
    if (dict[cleanName]) return dict[cleanName];

    // Пытаемся найти по вхождению (например, если пришло "fresh garlic")
    for (const key in dict) {
      if (cleanName.includes(key) && key.length > 3) {
        return dict[key];
      }
    }
    
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
}

export default AIVisionService;
