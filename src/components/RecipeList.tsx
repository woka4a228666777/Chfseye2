import React, { useState, useEffect } from 'react';
import { Product, Recipe, RecipeSearchFilters, ShoppingListItem } from '../types';
import { storage } from '../utils/storage';
import AIVisionService from '../services/aiVisionService';
import RecipeService from '../services/recipeService';
import { RECIPE_DATABASE } from '../data/recipes';

interface RecipeListProps {
  products: Product[];
  recipes: Recipe[];
  onRecipesUpdate: (recipes: Recipe[]) => void;
  onAddProduct: (product: Product) => void;
}

const RecipeList: React.FC<RecipeListProps> = ({ products, recipes, onRecipesUpdate, onAddProduct }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<RecipeSearchFilters>({});
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const availableProducts = products.filter(p => p.status !== 'empty');
  const availableIngredients = availableProducts.map(p => p.name.toLowerCase());

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    const favs = await storage.getFavorites();
    setFavorites(favs);
  };

  const toggleFavorite = async (recipeId: number) => {
    const isNowFavorite = await storage.toggleFavorite(recipeId);
    if (isNowFavorite) {
      setFavorites(prev => [...prev, recipeId]);
    } else {
      setFavorites(prev => prev.filter(id => id !== recipeId));
    }
  };

  const addToShoppingList = async (ingredient: string) => {
    const newItem: ShoppingListItem = {
      id: Date.now().toString() + Math.random(),
      name: ingredient.charAt(0).toUpperCase() + ingredient.slice(1),
      category: AIVisionService.categorizeProduct(ingredient) as any,
      quantity: '1 шт',
      completed: false,
      addedAt: new Date()
    };
    await storage.addToShoppingList(newItem);
    alert(`${newItem.name} добавлен в список покупок!`);
  };

  const markAsAvailable = (ingredient: string) => {
    const newProduct: Product = {
      id: `available-${Date.now()}-${Math.random()}`,
      name: ingredient.charAt(0).toUpperCase() + ingredient.slice(1),
      category: AIVisionService.categorizeProduct(ingredient) as any,
      status: 'full',
      source: 'manual'
    };
    onAddProduct(newProduct);
    
    if (selectedRecipe) {
      const updatedRecipe = {
        ...selectedRecipe,
        usedIngredients: [...selectedRecipe.usedIngredients, ingredient],
        missedIngredients: selectedRecipe.missedIngredients.filter(ing => ing !== ingredient)
      };
      setSelectedRecipe(updatedRecipe);
      onRecipesUpdate(recipes.map(r => r.id === updatedRecipe.id ? updatedRecipe : r));
    }
    
  };

  const searchRecipes = async () => {
    if (availableIngredients.length === 0) return;

    setIsLoading(true);
    setApiError(null);
    try {
      const matchedRecipes = await RecipeService.findRecipesByIngredients(availableIngredients);
      if (RecipeService.lastError) {
        setApiError(RecipeService.lastError);
      }
      onRecipesUpdate(matchedRecipes);
      await storage.cacheRecipes(matchedRecipes);
    } catch (error) {
      console.error('Failed to search recipes:', error);
      setApiError('Не удалось выполнить поиск. Используем локальную базу.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (recipes.length === 0 && availableIngredients.length > 0) {
      searchRecipes();
    }
  }, [availableIngredients]);

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTime = !filters.maxTime || recipe.readyInMinutes <= filters.maxTime;
    const matchesFavorite = !showFavoritesOnly || favorites.includes(recipe.id);
    return matchesSearch && matchesTime && matchesFavorite;
  });

  const getMatchQuality = (recipe: Recipe) => {
    const totalIngredients = recipe.usedIngredients.length + recipe.missedIngredients.length;
    if (totalIngredients === 0) return 0;
    return Math.round((recipe.usedIngredients.length / totalIngredients) * 100);
  };

  if (availableProducts.length === 0) {
    return (
      <div className="text-center py-16 bg-grayDark-[#363636] rounded-xl shadow-lg border border-gray-300">
        <div className="text-6xl mb-4 opacity-50">🛒</div>
        <h2 className="text-xl font-bold text-gray-600 mb-2">Добавьте продукты</h2>
        <p className="text-gray-600 max-w-xs mx-auto">Чтобы увидеть рецепты, добавьте продукты в свой список через фото, чек или вручную</p>
        <button 
          onClick={() => window.location.hash = '#manual'} 
          className="mt-6 px-8 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg active:scale-95"
        >
          Добавить первый продукт
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="bg-grayDark-[#363636] rounded-xl shadow-lg p-6 border border-gray-300">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-600">Поиск рецептов</h2>
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              showFavoritesOnly 
                ? 'bg-rose-600/10 text-rose-400 border border-rose-600 shadow-lg shadow-rose-900/20' 
                : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-400/10 hover:text-rose-500'
            }`}
          >
            {showFavoritesOnly ? '❤️ Только избранные' : '🤍 Показать избранные'}
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-600 mb-1">Поиск</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Название рецепта..."
              className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-xl text-gray-600 placeholder-gray-500 focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition-all"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Макс. время</label>
            <select
              value={filters.maxTime || ''}
              onChange={(e) => setFilters({ ...filters, maxTime: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-xl text-gray-600 focus:ring-2 focus:ring-rose-500 outline-none transition-all"
            >
              <option value="">Любое время</option>
              <option value="15">До 15 мин</option>
              <option value="30">До 30 мин</option>
              <option value="45">До 45 мин</option>
              <option value="60">До 1 часа</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={searchRecipes}
              disabled={isLoading}
              className="w-full px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 disabled:opacity-50 transition-all shadow-lg font-bold active:scale-95"
            >
              {isLoading ? 'Ищем...' : 'Обновить поиск'}
            </button>
          </div>
        </div>

        {apiError && (
          <div className="mt-4 bg-rose-600/10 border-l-4 border-rose-500 p-3 rounded shadow-sm flex items-center">
            <span className="mr-2">ℹ️</span>
            <p className="text-sm text-rose-600">{apiError}</p>
          </div>
        )}
      </div>

      {/* Recipes Grid */}
      {filteredRecipes.length === 0 ? (
        <div className="text-center py-16 bg-grayDark-[#363636] rounded-xl shadow-lg border border-gray-300">
          <div className="text-6xl mb-4 opacity-50">🍳</div>
          <h3 className="text-lg font-semibold text-gray-600 mb-2">
            {showFavoritesOnly ? 'У вас пока нет избранных рецептов' : 'Рецепты не найдены'}
          </h3>
          <p className="text-gray-600 max-w-xs mx-auto">
            {showFavoritesOnly 
              ? 'Нажмите на сердечко у любого рецепта, чтобы он появился здесь' 
              : 'Попробуйте добавить больше продуктов или изменить параметры поиска'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredRecipes.map((recipe) => (
            <div key={recipe.id} className="bg-grayDark-[#363636] rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 border border-gray-300 hover:border-rose-500/30 flex flex-col group">
              <div className="relative">
                <div className="h-56 overflow-hidden bg-gray-100">
                  <img 
                    src={recipe.image} 
                    alt={recipe.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/400x300?text=Food';
                    }}
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-gray-400/90 via-gray-400/20 to-transparent opacity-80"></div>
                
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(recipe.id);
                    }}
                    className={`p-2.5 rounded-full shadow-xl backdrop-blur-md transition-all active:scale-90 ${
                      favorites.includes(recipe.id) 
                        ? 'bg-rose-600/10 border-rose-600 border-[1px] text-white' 
                        : 'bg-grayDark-100/50 text-gray-600 hover:text-white hover:bg-rose-500/80'
                    }`}
                  >
                    {favorites.includes(recipe.id) ? '❤️' : '🤍'}
                  </button>
                  <div className={`px-2.5 py-1 rounded-full text-[10px] bg-rose-600/80 text-white shadow-xl backdrop-blur-md tracking-wider ${
                    getMatchQuality(recipe) >= 80 
                      ? 'bg-rose-600 text-white' 
                      : getMatchQuality(recipe) >= 50
                      ? 'bg-rose-700/80 text-white'
                      : 'bg-grayDark-900/80 text-gray-300'
                  }`}>
                    {getMatchQuality(recipe)}% СОВПАДЕНИЕ
                  </div>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-bold text-lg text-gray-600 mb-2 leading-tight h-14 overflow-hidden line-clamp-2 group-hover:text-rose-400 transition-colors">
                  {recipe.title}
                </h3>
                
                <div className="flex items-center text-xs text-gray-600 mb-5 space-x-4 font-medium">
                  <span className="flex items-center bg-rose-600 text-gray-100 text-[12px] px-2 py-1 rounded-md">⏱️ {recipe.readyInMinutes} мин</span>
                  <span className="flex items-center bg-gray-100 text-[12px] px-2 py-1 rounded-md">👥 {recipe.servings} порц.</span>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <h4 className="text-[12px] font-bold text-rose-400 uppercase mb-2">В наличии:</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {recipe.usedIngredients.map((ing, i) => (
                        <span key={i} className="px-2 py-1 bg-rose-500/10 text-rose-600 text-[14px] font-semibold rounded-lg border border-rose-800/30">
                          {ing}
                        </span>
                      ))}
                    </div>
                  </div>

                  {recipe.missedIngredients.length > 0 && (
                    <div>
                      <h4 className="text-[12px] font-bold text-gray-500 uppercase mb-2">Докупить:</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {recipe.missedIngredients.map((ing, i) => (
                          <span key={i} className="px-2 py-1 bg-gray-100/10 text-gray-700 text-[14px] font-semibold rounded-lg border border-gray-800/20">
                            {ing}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setSelectedRecipe(recipe)}
                  className="w-full mt-auto py-3 bg-rose-600 text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-900/20 active:scale-[0.98]"
                >
                  Открыть рецепт
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 backdrop-blur-sm top-[-25px]">
          <div className="bg-[#3d1e1e52] backdrop-blur-md rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200 border border-gray-600">
            <div className="relative h-64 bg-grayDark-900">
              <img 
                src={selectedRecipe.image} 
                alt={selectedRecipe.title}
                className="w-full h-full object-cover opacity-70"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://placehold.co/800x600?text=Food';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-grayDark-800 to-transparent"></div>
              <button
                onClick={() => setSelectedRecipe(null)}
                className="absolute top-4 right-4 w-10 h-10 bg-grayDark-900/60 hover:bg-rose-600 text-white rounded-full flex items-center justify-center transition-all backdrop-blur-md border border-gray-300"
              >
                ✕
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-3xl font-black text-gray-100 mb-2 leading-tight">{selectedRecipe.title}</h3>
                  <div className="flex items-center text-sm text-gray-600 space-x-4 font-medium">
                    <span className="bg-rose-600 px-3 text-gray-100 py-1 rounded-lg">⏱️ {selectedRecipe.readyInMinutes} минут</span>
                    <span className="bg-gray-100 px-3 py-1 rounded-lg">👥 {selectedRecipe.servings} порции</span>
                  </div>
                </div>
                <button
                  onClick={() => toggleFavorite(selectedRecipe.id)}
                  className={`text-2xl p-3 rounded-2xl transition-all shadow-lg active:scale-90 ${
                    favorites.includes(selectedRecipe.id) 
                      ? 'bg-rose-600/20 text-white shadow-rose-900/20' 
                      : 'bg-gray-100/10 text-gray-600 hover:text-white'
                  }`}
                >
                  {favorites.includes(selectedRecipe.id) ? '❤️' : '🤍'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-8">
                <div>
                  <h4 className="font-black text-rose-400 mb-5 flex items-center text-xs uppercase tracking-[0.2em]">
                    <span className="mr-2 text-base">🛒</span> Ингредиенты
                  </h4>
                  <ul className="space-y-3">
                    {selectedRecipe.usedIngredients.map((ing, i) => (
                      <li key={i} className="flex items-center text-sm text-gray-200 bg-rose-900/10 p-2 rounded-xl border border-rose-900/20">
                        <span className="text-rose-600 mr-3 font-bold">✓</span> {ing}
                      </li>
                    ))}
                    {selectedRecipe.missedIngredients.map((ing, i) => (
                      <li key={i} className="flex items-center justify-between group py-1 pl-2">
                        <div className="flex items-center text-sm text-gray-100 italic">
                          <span className="text-gray-100 mr-3">○</span> {ing}
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => markAsAvailable(ing)}
                            className="text-[9px] font-black uppercase tracking-wider bg-rose-600/80 text-gray-100 px-2.5 py-1.5 rounded-lg   transition-all border border-rose-900/80"
                          >
                            Есть
                          </button>
                          <button
                            onClick={() => addToShoppingList(ing)}
                            className="text-[9px] font-black uppercase tracking-wider bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-lg  transition-all border border-gray-300"
                          >
                            + Список
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-black text-rose-400 mb-5 flex items-center text-xs uppercase tracking-[0.2em]">
                    <span className="mr-2 text-base">👨‍🍳</span> Приготовление
                  </h4>
                  <div className="space-y-5">
                    {selectedRecipe.instructions?.map((step, i) => (
                      <div key={i} className="flex space-x-4">
                        <span className="flex-shrink-0 w-7 h-7 bg-rose-900/40 text-rose-400 rounded-xl flex items-center justify-center text-xs font-black border border-rose-800/30">
                          {i + 1}
                        </span>
                        <p className="text-sm text-gray-300 leading-relaxed font-medium">{step}</p>
                      </div>
                    )) || (
                      <p className="text-sm text-gray-500 italic bg-gray-100/50 p-4 rounded-xl border border-gray-300">Инструкции по приготовлению временно недоступны.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecipeList;
