import axios from 'axios';

// Конфигурация AI сервисов
const ROBOFLOW_CONFIG = {
  API_URL: 'https://serverless.roboflow.com/chefseye/27',
  API_KEY: 'QpWRpoxWB9nwcGd3WYeK'
};

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

class AIVisionService {
  static async init() {
    console.log('[AIVisionService] Сервис инициализирован (Roboflow Mode)');
  }

  static async checkServerStatus(): Promise<{loaded: boolean, status: string, type: string, error?: string}> {
    return { loaded: true, status: 'Ready', type: 'Roboflow Cloud AI' };
  }

  static async analyzeImage(imageFile: File, onProgress?: (msg: string) => void): Promise<AIVisionResult> {
    try {
      return await this.analyzeWithRoboflow(imageFile, onProgress);
    } catch (e: any) {
      console.error('[AIVisionService] Roboflow Error:', e.message);
      throw e;
    }
  }

  private static async analyzeWithRoboflow(imageFile: File, onProgress?: (msg: string) => void): Promise<AIVisionResult> {
    const startTime = Date.now();
    onProgress?.('Анализ фото...');
    
    try {
      const base64Image = await this.fileToBase64(imageFile);
      
      const response = await axios({
        method: "POST",
        url: ROBOFLOW_CONFIG.API_URL,
        params: { api_key: ROBOFLOW_CONFIG.API_KEY },
        data: base64Image,
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });

      const data = response.data;
      const products: any[] = [];

      if (data.predictions && data.predictions.length > 0) {
        data.predictions.forEach((pred: any, idx: number) => {
          const russianName = this.translateToRussian(pred.class);
          const isDuplicate = products.some(p => p.name.toLowerCase() === russianName.toLowerCase());
          
          if (!isDuplicate) {
            products.push({
              name: russianName,
              category: this.categorizeProduct(pred.class),
              confidence: pred.confidence,
              id: `roboflow-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`
            });
          }
        });
      }

      return {
        products,
        success: true,
        confidence: products.length > 0 ? Math.max(...products.map((p: any) => p.confidence)) : 0,
        processingTime: Date.now() - startTime,
        modelUsed: 'Roboflow Cloud AI'
      };
    } catch (error: any) {
      throw new Error(`Ошибка анализа изображения`);
    }
  }

  private static async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1].replace(/\s/g, ''));
      };
      reader.onerror = error => reject(error);
    });
  }

  static categorizeProduct(name: string): string {
    const lower = name.toLowerCase();
    if (['bottle', 'cup', 'wine glass', 'juice', 'water', 'milk', 'beer', 'wine', 'soda', 'beverage'].some(k => lower.includes(k))) return 'Напитки';
    if (['apple', 'banana', 'orange', 'fruit', 'pear', 'grape', 'strawberry', 'lemon', 'cherry', 'kiwi', 'mandarin', 'peach', 'plum'].some(k => lower.includes(k))) return 'Фрукты';
    if (['broccoli', 'carrot', 'vegetable', 'tomato', 'cucumber', 'potato', 'onion', 'salad', 'pepper', 'garlic', 'cabbage', 'corn', 'zucchini', 'eggplant', 'parsley', 'dill', 'basil', 'pumpkin'].some(k => lower.includes(k))) return 'Овощи';
    if (['egg', 'meat', 'chicken', 'beef', 'pork', 'ham', 'sausage', 'steak', 'bacon', 'turkey', 'lamb'].some(k => lower.includes(k))) return 'Мясо и птица';
    if (['fish', 'seafood', 'shrimp', 'prawn', 'salmon', 'tuna', 'cod', 'mackerel'].some(k => lower.includes(k))) return 'Рыба и морепродукты';
    if (['cheese', 'yogurt', 'butter', 'cream', 'sour cream', 'cottage cheese', 'kefir', 'milk'].some(k => lower.includes(k))) return 'Молочные продукты';
    if (['bread', 'pasta', 'rice', 'cereal', 'baguette', 'loaf', 'bun', 'toast', 'croissant', 'flour', 'sugar', 'salt', 'oil', 'buckwheat', 'oats', 'macaroni'].some(k => lower.includes(k))) return 'Бакалея';
    return 'Другое';
  }

  // ЕДИНЫЙ СЛОВАРЬ (English -> Russian)
  private static readonly EN_RU: Record<string, string> = {
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
    'egg': 'Яйцо',
    'eggs': 'Яйца',
    'milk': 'Молоко',
    'cheese': 'Сыр',
    'bread': 'Хлеб',
    'meat': 'Мясо',
    'chicken': 'Курица',
    'fish': 'Рыба',
    'tomato': 'Помидор',
    'cucumber': 'Огурец',
    'potato': 'Картофель',
    'onion': 'Лук',
    'garlic': 'Чеснок',
    'yogurt': 'Йогурт',
    'juice': 'Сок',
    'water': 'Вода',
    'strawberry': 'Клубника',
    'lemon': 'Лимон',
    'pear': 'Груша',
    'grape': 'Виноград',
    'pepper': 'Перец',
    'ham': 'Ветчина',
    'sausage': 'Колбаса',
    'cabbage': 'Капуста',
    'corn': 'Кукуруза',
    'zucchini': 'Кабачок',
    'eggplant': 'Баклажан',
    'pasta': 'Макароны',
    'rice': 'Рис',
    'parsley': 'Петрушка',
    'salad': 'Салат',
    'oil': 'Масло',
    'butter': 'Сливочное масло',
    'sour cream': 'Сметана',
    'cottage cheese': 'Творог',
    'flour': 'Мука',
    'sugar': 'Сахар',
    'salt': 'Соль',
    'beef': 'Говядина',
    'pork': 'Свинина',
    'turkey': 'Индейка',
    'shrimp': 'Креветки',
    'mushrooms': 'Грибы',
    'kefir': 'Кефир',
    'cream': 'Сливки',
    'salmon': 'Лосось',
    'tuna': 'Тунец',
    'pumpkin': 'Тыква',
    'dill': 'Укроп',
    'basil': 'Базилик',
    'mandarin': 'Мандарин',
    'lime': 'Лайм',
    'kiwi': 'Киви',
    'raspberry': 'Малина',
    'blueberry': 'Черника',
    'buckwheat': 'Гречка',
    'oats': 'Овсянка',
    'vinegar': 'Уксус',
    'honey': 'Мед',
    'nuts': 'Орехи',
    'mayonnaise': 'Майонез',
    'ketchup': 'Кетчуп',
    'soy sauce': 'Соевый соус',
    'mustard': 'Горчица'
  };

  // ЕДИНЫЙ СЛОВАРЬ (Russian -> English)
  private static readonly RU_EN: Record<string, string> = Object.fromEntries(
    Object.entries(AIVisionService.EN_RU).map(([en, ru]) => [ru.toLowerCase(), en])
  );

  // Дополнительные правила для RU -> EN
  private static readonly RU_EN_EXTRA: Record<string, string> = {
    'яблоки': 'apple',
    'бананы': 'banana',
    'апельсины': 'orange',
    'картошка': 'potato',
    'помидоры': 'tomato',
    'огурцы': 'cucumber',
    'лимоны': 'lemon',
    'груши': 'pear',
    'булочка': 'bun',
    'макароны': 'pasta',
    'зелень': 'herbs',
    'куриное филе': 'chicken breast',
    'болгарский перец': 'bell pepper'
  };

  static translateToRussian(enName: string): string {
    const clean = enName.toLowerCase().trim();
    if (this.EN_RU[clean]) return this.EN_RU[clean];
    
    for (const [en, ru] of Object.entries(this.EN_RU)) {
      if (clean.includes(en) && en.length > 3) return ru;
    }
    return enName.charAt(0).toUpperCase() + enName.slice(1);
  }

  static translateToEnglish(ruName: string): string {
    const clean = ruName.toLowerCase().trim();
    if (this.RU_EN[clean]) return this.RU_EN[clean];
    if (this.RU_EN_EXTRA[clean]) return this.RU_EN_EXTRA[clean];

    for (const [ru, en] of Object.entries(this.RU_EN)) {
      if (clean.includes(ru) && ru.length > 3) return en;
    }

    if (clean.endsWith('ы') || clean.endsWith('и')) {
      const singular = clean.slice(0, -1);
      if (this.RU_EN[singular]) return this.RU_EN[singular];
    }

    return ruName;
  }
}

export default AIVisionService;
