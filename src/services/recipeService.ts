import axios from 'axios';
import { Recipe, RecipeSearchFilters } from '../types';
import { RECIPE_DATABASE } from '../data/recipes';
import AIVisionService from './aiVisionService';

// Конфигурация Spoonacular API
const SPOONACULAR_CONFIG = {
  API_KEY: '100d06ccf8bf4cff9461a207e6882660', 
  BASE_URL: 'https://api.spoonacular.com/recipes'
};

class RecipeService {
  static lastError: string | null = null;

  /**
   * Поиск рецептов по имеющимся ингредиентам
   */
  static async findRecipesByIngredients(ingredients: string[]): Promise<Recipe[]> {
    if (ingredients.length === 0) return [];
    this.lastError = null;

    try {
      // ПЕРЕВОДИМ ИНГРЕДИЕНТЫ НА АНГЛИЙСКИЙ (API не понимает русский)
      const englishIngredients = ingredients
        .map(ing => {
          const translated = AIVisionService.translateToEnglish(ing);
          // Если перевод не удался (вернул то же самое на кириллице), логируем
          if (/[а-яА-Я]/.test(translated)) {
            console.warn(`[RecipeService] Не удалось перевести ингредиент: ${ing}`);
          }
          return translated;
        })
        .filter(ing => !/[а-яА-Я]/.test(ing)); // Убираем непереведенные, чтобы не путать API

      if (englishIngredients.length === 0) {
        console.error('[RecipeService] Нет подходящих ингредиентов для поиска на английском');
        return [];
      }
      
      console.log('[RecipeService] Поиск рецептов (RU):', ingredients);
      console.log('[RecipeService] Поиск рецептов (EN):', englishIngredients);
      
      const ingredientsString = englishIngredients.join(',');
      console.log('[RecipeService] Итоговая строка ингредиентов для API:', ingredientsString);

      const response = await axios.get(`${SPOONACULAR_CONFIG.BASE_URL}/findByIngredients`, {
        params: {
          apiKey: SPOONACULAR_CONFIG.API_KEY,
          ingredients: ingredientsString,
          number: 12,
          ranking: 1,
          ignorePantry: true
        }
      });

      console.log('[RecipeService] Полный URL запроса (без ключа):', `${SPOONACULAR_CONFIG.BASE_URL}/findByIngredients?ingredients=${ingredientsString}`);
      console.log('[RecipeService] Статус ответа:', response.status);
      console.log('[RecipeService] Данные ответа:', response.data);

      if (!response.data || !Array.isArray(response.data)) {
        console.error('[RecipeService] Некорректный формат данных от API:', response.data);
        throw new Error('Invalid API response format');
      }

      console.log('[RecipeService] Ответ API получен:', response.data.length, 'рецептов');

      // Преобразование формата Spoonacular в наш формат Recipe
      const apiRecipes: Recipe[] = response.data.map((r: any) => ({
        id: r.id,
        title: this.translateTitle(r.title), 
        image: r.image,
        usedIngredients: r.usedIngredients.map((i: any) => AIVisionService.translateToRussian(i.name)),
        missedIngredients: r.missedIngredients.map((i: any) => AIVisionService.translateToRussian(i.name)),
        readyInMinutes: r.readyInMinutes || 30, 
        servings: r.servings || 2,
        sourceUrl: r.sourceUrl || `https://spoonacular.com/recipes/${r.title.replace(/\s+/g, '-')}-${r.id}`
      }));

      if (apiRecipes.length === 0) {
        console.warn('[RecipeService] API не нашло рецептов, используем локальную базу');
        return this.getLocalRecommendations(ingredients);
      }

      // Получаем детали (время и инструкции) для первых 6 рецептов
      const recipesWithDetails = await this.enrichRecipesWithDetails(apiRecipes.slice(0, 6));
      
      return [...recipesWithDetails, ...apiRecipes.slice(6)];
    } catch (error: any) {
      console.error('[RecipeService] Ошибка API Spoonacular:');
      if (error.response) {
        // Ошибка от самого сервера (401, 402, 404 и т.д.)
        if (error.response.status === 402) {
          this.lastError = 'Лимит бесплатных запросов к API Spoonacular исчерпан на сегодня. Используем локальную базу.';
          console.error('ЛИМИТ ЗАПРОСОВ ИСЧЕРПАН (Daily Quota Exceeded)');
        } else if (error.response.status === 401) {
          this.lastError = 'Неверный API ключ Spoonacular. Проверьте настройки.';
          console.error('НЕВЕРНЫЙ API КЛЮЧ');
        } else {
          this.lastError = `Ошибка API (${error.response.status}). Используем локальную базу.`;
        }
      } else {
        this.lastError = 'Ошибка сети. Проверьте подключение к интернету.';
        console.error('Message:', error.message);
      }
      
      console.log('[RecipeService] Используем локальную базу данных как запасной вариант');
      return this.getLocalRecommendations(ingredients);
    }
  }

  /**
   * Получение детальной информации о рецептах
   */
  private static async enrichRecipesWithDetails(recipes: Recipe[]): Promise<Recipe[]> {
    if (recipes.length === 0) return [];
    
    try {
      const ids = recipes.map(r => r.id).join(',');
      console.log('[RecipeService] Загрузка деталей для рецептов с ID:', ids);
      
      const response = await axios.get(`${SPOONACULAR_CONFIG.BASE_URL}/informationBulk`, {
        params: {
          apiKey: SPOONACULAR_CONFIG.API_KEY,
          ids: ids
        }
      });

      console.log('[RecipeService] Детали рецептов загружены:', response.data.length);

      return recipes.map(r => {
        const details = response.data.find((d: any) => d.id === r.id);
        if (details) {
          return {
            ...r,
            readyInMinutes: details.readyInMinutes,
            servings: details.servings,
            instructions: details.analyzedInstructions?.[0]?.steps.map((s: any) => s.step) || [],
            sourceUrl: details.sourceUrl
          };
        }
        return r;
      });
    } catch (e) {
      console.warn('[RecipeService] Не удалось загрузить детали рецептов');
      return recipes;
    }
  }

  /**
   * Локальный поиск (fallback)
   */
  private static getLocalRecommendations(availableIngredients: string[]): Recipe[] {
    return RECIPE_DATABASE.map(recipe => {
      const allIngredients = [...recipe.usedIngredients, ...recipe.missedIngredients];
      const used = allIngredients.filter(ing => 
        availableIngredients.some(available => 
          available.includes(ing.toLowerCase()) || ing.toLowerCase().includes(available)
        )
      );
      const missed = allIngredients.filter(ing => 
        !availableIngredients.some(available => 
          available.includes(ing.toLowerCase()) || ing.toLowerCase().includes(available)
        )
      );
      
      return { ...recipe, usedIngredients: used, missedIngredients: missed };
    }).filter(r => r.usedIngredients.length > 0)
    .sort((a, b) => b.usedIngredients.length - a.usedIngredients.length);
  }

  /**
   * Умный перевод заголовков
   */
  private static translateTitle(title: string): string {
    if (!title) return '';
    
    const translations: Record<string, string> = {
      'Salad': 'Салат',
      'Pasta': 'Паста',
      'Chicken': 'Курица',
      'Potato': 'Картофель',
      'Soup': 'Суп',
      'Omelette': 'Омлет',
      'Egg': 'Яйцо',
      'Eggs': 'Яйца',
      'Beef': 'Говядина',
      'Pork': 'Свинина',
      'Fish': 'Рыба',
      'Roasted': 'Запеченный',
      'Fried': 'Жареный',
      'Baked': 'Печеный',
      'Stew': 'Рагу',
      'Curry': 'Карри',
      'Rice': 'Рис',
      'Vegetable': 'Овощной',
      'Healthy': 'Полезный',
      'Easy': 'Простой',
      'Quick': 'Быстрый',
      'Homemade': 'Домашний',
      'Garlic': 'Чесночный',
      'Cheese': 'Сырный',
      'Creamy': 'Сливочный',
      'Spicy': 'Острый',
      'Sweet': 'Сладкий',
      'Sour': 'Кислый',
      'Lemon': 'Лимонный',
      'Apple': 'Яблочный',
      'Banana': 'Банановый',
      'Strawberry': 'Клубничный',
      'Chocolate': 'Шоколадный',
      'Cake': 'Торт',
      'Cookies': 'Печенье',
      'Pie': 'Пирог',
      'Bread': 'Хлеб',
      'Sandwich': 'Сэндвич',
      'Burger': 'Бургер',
      'Pizza': 'Пицца',
      'Tomato': 'Томатный',
      'Sauce': 'Соус',
      'With': 'с',
      'And': 'и',
      'Breast': 'Грудка',
      'Thigh': 'Бедро',
      'Wings': 'Крылышки',
      'Roast': 'Жаркое',
      'Boiled': 'Отварной',
      'Steamed': 'На пару',
      'Grilled': 'Гриль',
      'Mushroom': 'Грибной',
      'Onion': 'Луковый',
      'Green': 'Зеленый',
      'Red': 'Красный',
      'Fresh': 'Свежий'
    };
    
    let words = title.split(/\s+/);
    let translatedWords = words.map(word => {
      // Убираем пунктуацию для поиска
      const cleanWord = word.replace(/[.,!?;:]/g, '');
      const punctuation = word.slice(cleanWord.length);
      
      // Ищем в словаре
      for (const [en, ru] of Object.entries(translations)) {
        if (cleanWord.toLowerCase() === en.toLowerCase()) {
          return ru + punctuation;
        }
      }
      
      // Если слово - это "with" или "and", переводим в нижний регистр
      if (cleanWord.toLowerCase() === 'with') return 'с';
      if (cleanWord.toLowerCase() === 'and') return 'и';
      
      return word;
    });
    
    return translatedWords.join(' ');
  }
}

export default RecipeService;
