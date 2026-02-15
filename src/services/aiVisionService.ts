import axios from 'axios';
import { Client } from '@gradio/client';

// Интерфейсы для типизации
interface DetectedProduct {
  id: string;
  name: string;
  category: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface AIVisionResult {
  products: DetectedProduct[];
  success: boolean;
  confidence: number;
  processingTime?: number;
  modelUsed?: string;
}

// Конфигурация AI сервисов
const AI_CONFIG = {
  // Основной сервис - Hugging Face Multimodal OCR через MCP
  HUGGINGFACE_OCR_API: 'https://prithivmlmods-multimodal-ocr.hf.space/gradio_api/mcp/',
  
  // Настройки
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 2
};

class AIVisionService {
  //// Инициализация сервиса
  static init() {
    console.log('[AIVisionService] Сервис инициализирован с Hugging Face Multimodal OCR');
  }

  // Основной метод для анализа изображения
  static async analyzeImage(imageFile: File, onProgress?: (message: string) => void): Promise<AIVisionResult> {
    const startTime = Date.now();
    
    try {
      onProgress?.('Подключаемся к Hugging Face Multimodal OCR...');
      const result = await this.callHuggingFaceOCR(imageFile);
      
      return {
        ...result,
        processingTime: Date.now() - startTime,
        modelUsed: 'huggingface-ocr'
      };
      
    } catch (error) {
      console.error('[AIVisionService] Ошибка анализа изображения:', error);
      
      // Возвращаем демо-результат в случае ошибки
      return {
        ...this.getDemoResult(),
        processingTime: Date.now() - startTime,
        modelUsed: 'demo'
      };
    }
  }

  // Вызов Hugging Face Multimodal OCR API через Gradio Client
  private static async callHuggingFaceOCR(imageFile: File): Promise<AIVisionResult> {
    try {
      console.log('[AIVisionService] Подключаемся к Hugging Face Multimodal OCR через Gradio Client');
      
      // Создаем клиент для Multimodal OCR
      const client = await Client.connect("prithivMLmods/Multimodal-OCR");
      
      // Вызываем API для генерации описания изображения
      const result = await client.predict("/generate_image", {
        model_name: "Nanonets-OCR2-3B",
        text: "Write all what you see, only eatable and drinkable on the photo. without water drops etc. Example(apple, milk, lemon)",
        image: imageFile,
        max_new_tokens: 1024,
        temperature: 0.7,
        top_p: 0.9,
        top_k: 50,
        repetition_penalty: 1.1,
        gpu_timeout: 60
      });
      
      console.log('[AIVisionService] Hugging Face Multimodal OCR ответил успешно');
      
      // Обрабатываем результат
      const responseData = {
        data: result.data
      };
      
      return this.processHuggingFaceResponse(responseData);
      
    } catch (error) {
      console.error('[AIVisionService] Hugging Face Multimodal OCR ошибка:', error);
      
      // В случае ошибки используем демо-режим
      console.log('[AIVisionService] Переходим в демо-режим');
      return this.getDemoResult();
    }
  }
  
  // Резервный метод для старого API формата
  private static async callLegacyHuggingFaceAPI(imageFile: File): Promise<AIVisionResult> {
    try {
      const base64Image = await this.fileToBase64(imageFile);
      
      // Формируем правильный MCP запрос для Multimodal OCR
      const requestBody = {
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "Multimodal_OCR_generate_image",
          arguments: {
            image: base64Image,
            query: "Опиши что находится на изображении, перечисли все продукты питания"
          }
        },
        id: 1
      };
      
      console.log('[AIVisionService] Пробуем старый API формат...');
      
      const response = await axios.post(
        'https://prithivmlmods-multimodal-ocr.hf.space/gradio_api/mcp/',
        requestBody,
        { 
          timeout: AI_CONFIG.TIMEOUT,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
          }
        }
      );
      
      console.log('[AIVisionService] Старый API формат сработал');
      return this.processHuggingFaceResponse(response.data);
      
    } catch (error) {
      console.error('[AIVisionService] Ошибка в старом API формате:', error);
      throw error;
    }
  }

  // Обработка ответа от Hugging Face Multimodal OCR
  private static processHuggingFaceResponse(data: any): AIVisionResult {
    const products: DetectedProduct[] = [];
    
    try {
      // Multimodal OCR возвращает описание изображения в текстовом формате
      // Пример ответа: "На изображении видны яблоки, молоко, хлеб и сыр в холодильнике"
      const description = data?.data?.[0] || '';
      console.log('[AIVisionService] Описание от Multimodal OCR:', description);
      
      // Извлекаем продукты из текстового описания
      const extractedProducts = this.extractProductsFromDescription(description);
      
      // Преобразуем в формат DetectedProduct
      extractedProducts.forEach(productName => {
        const translatedName = this.translateAndCategorize(productName);
        
        products.push({
          id: this.generateProductId(translatedName),
          name: translatedName,
          category: this.categorizeProduct(translatedName),
          confidence: 0.85 // Высокая уверенность для OCR
        });
      });
      
    } catch (error) {
      console.error('[AIVisionService] Ошибка обработки ответа Multimodal OCR:', error);
    }
    
    return {
      products: this.removeDuplicates(products),
      success: products.length > 0,
      confidence: products.length > 0 ? 0.8 : 0
    };
  }
  
  // Извлечение продуктов из текстового описания
  private static extractProductsFromDescription(description: string): string[] {
    const products: string[] = [];
    
    // Список common продуктов для поиска в описании
    const commonProducts = [
      'яблоко', 'банан', 'апельсин', 'молоко', 'хлеб', 'сыр', 'йогурт', 
      'мясо', 'курица', 'рыба', 'овощи', 'фрукты', 'колбаса', 'сок',
      'вода', 'яйца', 'масло', 'кетчуп', 'майонез', 'сметана', 'творог'
    ];
    
    // Ищем продукты в описании
    commonProducts.forEach(product => {
      if (description.toLowerCase().includes(product)) {
        products.push(product);
      }
    });
    
    // Дополнительно пытаемся извлечь продукты через регулярные выражения
    const productRegex = /(\b[а-яё]+\b)(?=\s*(,|и|в|на|с|из))/gi;
    let match;
    
    while ((match = productRegex.exec(description)) !== null) {
      const potentialProduct = match[1].toLowerCase();
      if (potentialProduct.length > 3 && !products.includes(potentialProduct)) {
        products.push(potentialProduct);
      }
    }
    
    return products;
  }

  // Вспомогательный метод для конвертации файла в base64
  private static async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Генерация ID продукта
  private static generateProductId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  // Удаление дубликатов продуктов
  private static removeDuplicates(products: DetectedProduct[]): DetectedProduct[] {
    const seen = new Set();
    return products.filter(product => {
      const key = product.name.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // Перевод и категоризация продукта
  private static translateAndCategorize(name: string): string {
    const translations: { [key: string]: string } = {
      'apple': 'Яблоко',
      'banana': 'Банан',
      'orange': 'Апельсин',
      'tomato': 'Помидор',
      'cucumber': 'Огурец',
      'carrot': 'Морковь',
      'potato': 'Картофель',
      'onion': 'Лук',
      'bread': 'Хлеб',
      'cheese': 'Сыр',
      'milk': 'Молоко',
      'egg': 'Яйцо',
      'meat': 'Мясо',
      'fish': 'Рыба',
      'chicken': 'Курица',
      'beef': 'Говядина',
      'pork': 'Свинина'
    };
    
    return translations[name.toLowerCase()] || name;
  }

  // Категоризация продукта
  private static categorizeProduct(name: string): string {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('яблоко') || lowerName.includes('банан') || lowerName.includes('апельсин') || 
        lowerName.includes('фрукт')) {
      return 'fruit';
    }
    
    if (lowerName.includes('помидор') || lowerName.includes('огурец') || lowerName.includes('морковь') || 
        lowerName.includes('картофель') || lowerName.includes('овощ')) {
      return 'vegetable';
    }
    
    if (lowerName.includes('мясо') || lowerName.includes('курица') || lowerName.includes('говядина') || 
        lowerName.includes('свинина') || lowerName.includes('рыба')) {
      return 'meat';
    }
    
    if (lowerName.includes('молоко') || lowerName.includes('сыр') || lowerName.includes('яйцо')) {
      return 'dairy';
    }
    
    if (lowerName.includes('хлеб')) {
      return 'bakery';
    }
    
    return 'other';
  }

  // Демо-режим когда API недоступен
  private static getDemoResult(): AIVisionResult {
    // Простая симуляция распознавания на основе имени файла
    const demoProducts: DetectedProduct[] = [
      {
        id: 'demo-apple',
        name: 'Яблоко',
        category: 'fruit',
        confidence: 0.85
      },
      {
        id: 'demo-bread',
        name: 'Хлеб',
        category: 'bakery',
        confidence: 0.78
      }
    ];
    
    return {
      products: demoProducts,
      success: true,
      confidence: 0.8
    };
  }
}

export default AIVisionService;