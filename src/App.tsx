import { useState, useEffect } from 'react';
import { Product, Recipe } from './types';
import { storage } from './utils/storage';
import Dashboard from './components/Dashboard';
import ManualInput from './components/ManualInput';
import ReceiptInput from './components/ReceiptInput';
import AIVisionInput from './components/AIVisionInput';
import RecipeList from './components/RecipeList';
import ShoppingList from './components/ShoppingList';

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'manual' | 'receipt' | 'photo' | 'recipes' | 'shopping'>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const closeMenu = () => setIsMenuOpen(false);

  const navigateTo = (view: 'dashboard' | 'manual' | 'receipt' | 'photo' | 'recipes' | 'shopping') => {
    setCurrentView(view);
    closeMenu();
  };

  const loadInitialData = async () => {
    try {
      const [loadedProducts, loadedRecipes] = await Promise.all([
        storage.getProducts(),
        storage.getCachedRecipes()
      ]);
      setProducts(loadedProducts);
      setRecipes(loadedRecipes);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProduct = async (product: Product) => {
    try {
      await storage.addProduct(product);
      setProducts(prev => [...prev, product]);
    } catch (error) {
      console.error('Failed to add product:', error);
    }
  };

  const handleUpdateProduct = async (id: string, updates: Partial<Product>) => {
    try {
      await storage.updateProduct(id, updates);
      setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    } catch (error) {
      console.error('Failed to update product:', error);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await storage.deleteProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Failed to delete product:', error);
    }
  };

  const handleAddProducts = async (newProducts: Product[]) => {
    try {
      for (const product of newProducts) {
        await storage.addProduct(product);
      }
      setProducts(prev => [...prev, ...newProducts]);
    } catch (error) {
      console.error('Failed to add products:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-rose-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="fixed w-full padding bg-white shadow-sm border-b min-h-[120px] border-gray-200 flex items-center justify-center z-50">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center cursor-pointer" onClick={() => navigateTo('dashboard')}>
              <img src="/ChefsEyeLogo.png" alt="Chef's Eye" className="h-[100px] w-auto" />
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden min-[601px]:flex space-x-2">
              <button
                onClick={() => navigateTo('dashboard')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentView === 'dashboard'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-rose-600 hover:bg-gray-100'
                }`}
              >
                Главная
              </button>
              <button
                onClick={() => navigateTo('recipes')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentView === 'recipes'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-rose-600 hover:bg-gray-100'
                }`}
              >
                Рецепты
              </button>
              <button
                onClick={() => navigateTo('shopping')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentView === 'shopping'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-rose-600 hover:bg-gray-100'
                }`}
              >
                Список покупок
              </button>
            </nav>

            {/* Mobile Burger Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex min-[601px]:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Toggle menu"
            >
              <div className="w-6 h-5 flex flex-col justify-between">
                <span className={`w-full h-0.5 bg-rose-600 rounded-full transition-all ${isMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
                <span className={`w-full h-0.5 bg-rose-600 rounded-full transition-all ${isMenuOpen ? 'opacity-0' : ''}`}></span>
                <span className={`w-full h-0.5 bg-rose-600 rounded-full transition-all ${isMenuOpen ? '-rotate-45 -translate-y-2.5' : ''}`}></span>
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-white shadow-lg border-b border-gray-200 min-[601px]:hidden animate-in slide-in-from-top duration-200">
            <nav className="flex flex-col p-4 space-y-2">
              <button
                onClick={() => navigateTo('dashboard')}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  currentView === 'dashboard'
                    ? 'bg-rose-50 text-rose-600 border border-rose-100'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                🏠 Главная
              </button>
              <button
                onClick={() => navigateTo('recipes')}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  currentView === 'recipes'
                    ? 'bg-rose-50 text-rose-600 border border-rose-100'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                🍳 Рецепты
              </button>
              <button
                onClick={() => navigateTo('shopping')}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  currentView === 'shopping'
                    ? 'bg-rose-50 text-rose-600 border border-rose-100'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                🛒 Список покупок
              </button>
            </nav>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-[140px]">
        {currentView === 'dashboard' && (
          <Dashboard
            products={products}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            onNavigate={(view) => setCurrentView(view as Parameters<typeof setCurrentView>[0])}
          />
        )}

        {currentView === 'manual' && (
          <ManualInput
            onAddProduct={handleAddProduct}
            onBack={() => setCurrentView('dashboard')}
          />
        )}

        {currentView === 'receipt' && (
          <ReceiptInput
            onAddProducts={(newProducts) => {
              newProducts.forEach(handleAddProduct);
              setCurrentView('dashboard');
            }}
            onBack={() => setCurrentView('dashboard')}
          />
        )}

        {currentView === 'photo' && (
          <AIVisionInput
            onAddProducts={(newProducts) => {
              newProducts.forEach(handleAddProduct);
              setCurrentView('dashboard');
            }}
            onBack={() => setCurrentView('dashboard')}
          />
        )}

        {currentView === 'recipes' && (
          <RecipeList
            products={products}
            recipes={recipes}
            onRecipesUpdate={setRecipes}
            onAddProduct={handleAddProduct}
          />
        )}

        {currentView === 'shopping' && (
        <ShoppingList 
          onBack={() => setCurrentView('dashboard')}
          onAddProducts={handleAddProducts}
        />
      )}
      </main>
    </div>
  );
}

export default App;