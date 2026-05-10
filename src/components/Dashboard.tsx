import React, { useMemo, useState, useEffect } from 'react';
import { Product, Recipe } from '../types';
import RecipeService from '../services/recipeService';

interface DashboardProps {
  products: Product[];
  onUpdateProduct: (id: string, updates: Partial<Product>) => void;
  onDeleteProduct: (id: string) => void;
  onNavigate: (view: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  products,
  onUpdateProduct,
  onDeleteProduct,
  onNavigate
}) => {
  const unifiedProducts = products.map(p => {
    const categoryMap: Record<string, string> = {
      'vegetables': 'Овощи',
      'fruits': 'Фрукты',
      'beverages': 'Напитки',
      'protein': 'Мясо и птица',
      'carbs': 'Бакалея',
      'dairy': 'Молочные продукты',
      'other': 'Другое',

      'овощи': 'Овощи',
      'фрукты': 'Фрукты',
      'напитки': 'Напитки',
      'мясо и птица': 'Мясо и птица',
      'рыба и морепродукты': 'Рыба и морепродукты',
      'молочные продукты': 'Молочные продукты',
      'бакалея': 'Бакалея',
      'другое': 'Другое'
    };

    const currentCategory = p.category.toLowerCase();

    return {
      ...p,
      category: categoryMap[currentCategory] || p.category
    };
  });

  const productsByCategory = unifiedProducts.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = [];
    }

    acc[product.category].push(product);

    return acc;
  }, {} as Record<string, Product[]>);

  const lowStockProducts = unifiedProducts.filter(p => p.status === 'low');

  const getStatusColor = (status: Product['status']) => {
    switch (status) {
      case 'full':
        return 'bg-rose-600/90 text-white border border-rose-700/70 cursor-pointer';

      case 'low':
        return 'bg-yellow-500/50 text-yellow-700 border border-yellow-800/60 cursor-pointer';

      case 'empty':
        return 'bg-gray-800 text-gray-300 border border-gray-700 cursor-pointer';

      default:
        return 'bg-grayDark-[#363636] text-gray-800 cursor-pointer';
    }
  };

  const [recommendedRecipes, setRecommendedRecipes] = useState<
    (Recipe & { matchQuality: number })[]
  >([]);

  const [isLoadingRecipes, setIsLoadingRecipes] = useState(false);
  const [recipeError, setRecipeError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      const availableIngredients = unifiedProducts
        .filter(p => p.status !== 'empty')
        .map(p => p.name.toLowerCase());

      if (availableIngredients.length === 0) {
        setRecommendedRecipes([]);
        setRecipeError(null);
        return;
      }

      setIsLoadingRecipes(true);
      setRecipeError(null);

      try {
        const recipes = await RecipeService.findRecipesByIngredients(
          availableIngredients
        );

        if (RecipeService.lastError) {
          setRecipeError(RecipeService.lastError);
        }

        const processed = recipes.slice(0, 3).map(recipe => {
          const allIngredients = [
            ...recipe.usedIngredients,
            ...recipe.missedIngredients
          ];

          const matchQuality =
            allIngredients.length > 0
              ? Math.round(
                  (recipe.usedIngredients.length / allIngredients.length) * 100
                )
              : 0;

          return {
            ...recipe,
            matchQuality
          };
        });

        setRecommendedRecipes(processed);
      } catch (e) {
        console.error('Failed to fetch recommendations:', e);
      } finally {
        setIsLoadingRecipes(false);
      }
    };

    fetchRecommendations();
  }, [products]);

  return (
    <div className="space-y-6">
      {/* Stock Summary Section */}
      {lowStockProducts.length > 0 && (
        <div className="bg-rose-700/10 border-l-4 border-rose-500 p-4 rounded-r-lg shadow-sm">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-xl">⚠️</span>
            </div>

            <div className="ml-3">
              <h3 className="text-lg font-bold text-rose-600">
                Заканчиваются продукты:
              </h3>

              <div className="mt-1 text-base text-rose-500">
                {lowStockProducts.map(p => p.name).join(', ')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Section */}
      <div className="bg-grayDark-[#363636] rounded-xl shadow-lg p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-600 mb-4">
          Быстрое добавление
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => onNavigate('manual')}
            className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-500/50 rounded-xl hover:border-rose-500 hover:bg-rose-600/10 transition-all group"
          >
            <div className="w-16 h-16 bg-gray-500/10 rounded-full flex items-center justify-center mb-2 group-hover:bg-rose-700/50 transition-colors">
              <span className="text-4xl">📝</span>
            </div>

            <span className="text-sm font-medium text-gray-600">
              Ручной ввод
            </span>
          </button>

          <button
            onClick={() => onNavigate('receipt')}
            className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-500/50 rounded-xl hover:border-rose-500 hover:bg-rose-600/10 transition-all group"
          >
            <div className="w-16 h-16 bg-gray-500/10 rounded-full flex items-center justify-center mb-2 group-hover:bg-rose-700/50 transition-colors">
              <span className="text-4xl">🧾</span>
            </div>

            <span className="text-sm font-medium text-gray-600">
              Сканировать чек
            </span>

            <span className="text-xs text-rose-400 mt-1 font-medium">
              Авто-распознавание
            </span>
          </button>

          <button
            onClick={() => onNavigate('photo')}
            className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-500/50 rounded-xl hover:border-rose-500 hover:bg-rose-600/10 transition-all group"
          >
            <div className="w-16 h-16 bg-gray-500/10 rounded-full flex items-center justify-center mb-2 group-hover:bg-rose-700/50 transition-colors">
              <span className="text-4xl">🤖</span>
            </div>

            <span className="text-sm font-medium text-gray-600">
              AI Распознавание
            </span>

            <span className="text-xs text-rose-400 mt-1 font-medium">
              Нейросети + Компьютерное зрение
            </span>
          </button>
        </div>
      </div>

      {/* Current Products */}
      <div className="bg-grayDark-[#363636] rounded-xl shadow-lg p-6 border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-600">
            Мои продукты
          </h2>

          <span className="text-sm text-gray-800">
            {products.length} продуктов
          </span>
        </div>

        {Object.keys(productsByCategory).length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4 opacity-50">🛒</div>

            <p className="text-gray-800">
              Добавьте продукты, чтобы начать поиск рецептов
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(productsByCategory).map(
              ([category, categoryProducts]) => (
                <div key={category} className="space-y-3">
                  <h3 className="font-bold text-rose-500 text-sm uppercase tracking-wider pl-1">
                    {category}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {categoryProducts.map(product => (
                      <div
                        key={product.id}
                        className="flex items-center justify-between p-3 bg-gray-700/10/50 rounded-xl border border-gray-400/50 hover:border-grayDark-500 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">
                            {product.status === 'full' && '📦'}
                            {product.status === 'low' && '⚠️'}
                            {product.status === 'empty' && '❌'}
                          </span>

                          <span className="text-sm font-medium text-gray-500">
                            {product.name}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <select
                            value={product.status}
                            onChange={(e) =>
                              onUpdateProduct(product.id, {
                                status: e.target.value as Product['status']
                              })
                            }
                            className={`text-[10px] font-bold px-2 py-2 rounded-full outline-none transition-all ${getStatusColor(product.status)}`}
                          >
                            <option value="full">Есть</option>
                            <option value="low">Мало</option>
                            <option value="empty">Нет</option>
                          </select>

                          <button
                            onClick={() => onDeleteProduct(product.id)}
                            className="text-gray-500 hover:text-rose-600 transition-colors p-1"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Recommended Recipes */}
      <div className="bg-grayDark-[#363636] rounded-xl shadow-lg p-6 border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-600">
            Рекомендуемые рецепты
          </h2>

          <button
            onClick={() => onNavigate('recipes')}
            className="text-rose-400 hover:text-rose-300 text-sm font-medium transition-colors"
          >
            Все рецепты →
          </button>
        </div>

        {recipeError && (
          <div className="mb-4 bg-rose-600/10 border-l-4 border-rose-500 p-3 rounded shadow-sm flex items-center">
            <span className="mr-2">ℹ️</span>

            <p className="text-xs text-rose-600">
              {recipeError}
            </p>
          </div>
        )}

        {isLoadingRecipes ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
          </div>
        ) : recommendedRecipes.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4 opacity-50">👨‍🍳</div>

            <p className="text-gray-800 mb-4">
              Добавьте продукты, чтобы увидеть рекомендации
            </p>

            <button
              onClick={() => onNavigate('manual')}
              className="bg-rose-700 text-white px-6 py-2 rounded-xl font-bold hover:bg-rose-800 transition-all shadow-lg active:scale-95"
            >
              Добавить продукты
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recommendedRecipes.map(recipe => (
              <div
                key={recipe.id}
                onClick={() => onNavigate('recipes')}
                className="group cursor-pointer bg-gray-700/10/30 rounded-2xl border border-gray-400/50 overflow-hidden hover:shadow-xl hover:border-rose-500/50 transition-all duration-300"
              >
                <div className="h-32 overflow-hidden relative">
                  <img
                    src={recipe.image}
                    alt={recipe.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://placehold.co/400x300?text=Food';
                    }}
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-gray-300/80 to-transparent opacity-60"></div>

                  <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-rose-600/90 backdrop-blur-sm rounded-full text-[12px] font-semibold text-white shadow-lg tracking-wider">
                    {recipe.matchQuality}% СОВПАДЕНИЕ
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-bold text-sm text-gray-600 mb-2 line-clamp-1 group-hover:text-rose-600 transition-colors">
                    {recipe.title}
                  </h3>

                  <div className="flex items-center text-[10px] text-gray-800 space-x-3 font-medium">
                    <span className="flex items-center">
                      ⏱️ {recipe.readyInMinutes} мин
                    </span>

                    <span className="flex items-center">
                      👥 {recipe.servings} порц.
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
