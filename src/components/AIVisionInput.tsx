import React, { useState, useRef, useEffect } from 'react';
import { Product } from '../types';
import AIVisionService from '../services/aiVisionService';

interface AIVisionInputProps {
  onAddProducts: (products: Product[]) => void;
  onBack: () => void;
}

const AIVisionInput: React.FC<AIVisionInputProps> = ({ onAddProducts, onBack }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [detectedProducts, setDetectedProducts] = useState<Product[]>([]);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [serverStatus, setServerStatus] = useState<{loaded: boolean, status: string, type: string, error?: string} | null>(null);
  const [newProductName, setNewProductName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getApiDisplayName = (api: string): string => {
    const apiNames: Record<string, string> = {
      'Llama-3.2-11B-Vision': 'Llama 3.2 Vision AI',
      'fallback': 'резервный алгоритм',
      'demo': 'тестовый режим'
    };
    return apiNames[api] || api;
  };

  // Опрос статуса сервера каждые 3 секунды
  useEffect(() => {
    const updateStatus = async () => {
      const status = await AIVisionService.checkServerStatus();
      setServerStatus(status);
    };
    updateStatus();
    const interval = setInterval(updateStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setDetectedProducts([]);
    setIsProcessing(true);

    try {
      // Превью
      const reader = new FileReader();
      reader.onload = (e) => setSelectedImage(e.target?.result as string);
      reader.readAsDataURL(file);

      setProcessingStage('Подготовка изображения...');
      const result = await AIVisionService.analyzeImage(file, (msg) => {
        setProcessingStage(msg);
      });

      const products: Product[] = result.products.map((p, i) => ({
        id: `ai-${Date.now()}-${i}`,
        name: p.name,
        category: p.category || 'Другое',
        status: 'full',
        confidence: p.confidence,
        source: 'ai-vision'
      }));

      setDetectedProducts(products);
      if (products.length === 0) {
        setError('❌ Нейросеть не нашла продуктов на фото. Попробуйте другой ракурс.');
      } else if (result.modelUsed) {
        // Показываем какой AI сработал
        console.log(`[AIVisionInput] Использована модель: ${result.modelUsed}`);
        setProcessingStage(`Успешно! Использован: ${result.modelUsed}`);
        setTimeout(() => setProcessingStage(''), 3000);
      }

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Ошибка при анализе фото');
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  };

  const handleAddAll = () => {
    if (detectedProducts.length > 0) {
      onAddProducts(detectedProducts);
      onBack();
    }
  };

  const handleRemoveProduct = (id: string) => {
    setDetectedProducts(prev => prev.filter(p => p.id !== id));
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) return;

    const newProduct: Product = {
      id: `manual-${Date.now()}`,
      name: newProductName.trim(),
      category: AIVisionService.categorizeProduct(newProductName.trim()) as any,
      status: 'full',
      source: 'manual'
    };

    setDetectedProducts(prev => [...prev, newProduct]);
    setNewProductName('');
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-rose-600 hover:text-rose-700 font-medium transition-colors flex items-center">
          <span className="mr-1">←</span> Назад
        </button>
        <h2 className="text-2xl font-bold text-gray-900">🤖 AI-анализ продуктов (v3)</h2>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${serverStatus?.loaded ? 'bg-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.4)]' : 'bg-yellow-500'}`}></div>
          <span className="text-sm text-gray-500">
            {serverStatus?.loaded ? `${serverStatus.type}: Ready` : 'Загрузка нейросети...'}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        {!serverStatus?.loaded && (
          <div className="mb-4 bg-rose-50 border border-rose-100 text-rose-800 p-4 rounded-xl flex items-start animate-pulse">
            <span className="mr-2">⏳</span>
            <div>
              <p className="font-bold">Инициализация AI:</p>
              <p className="text-sm">Мы загружаем легкую нейросеть прямо в ваш браузер или подключаем облачный API. Это происходит один раз.</p>
              <p className="text-xs mt-1 italic">
                Теперь распознавание работает <strong>быстрее и точнее</strong>.
              </p>
            </div>
          </div>
        )}

        {isProcessing ? (
          <div className="text-center py-12 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600 mx-auto"></div>
            <p className="font-medium text-gray-700">{processingStage}</p>
            <div className="space-y-2">
              <p className="text-xs text-gray-500 italic">
                {serverStatus?.type?.includes('Cloud') 
                  ? 'Облачный AI анализирует ваше фото...' 
                  : 'Генерация на CPU может занимать от 1 до 3 минут.'}
              </p>
              <p className="text-xs text-rose-500 animate-pulse">
                Пожалуйста, не закрывайте страницу...
              </p>
            </div>
          </div>
        ) : (
          <>
            {!selectedImage ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center cursor-pointer hover:border-rose-400 hover:bg-rose-50 transition-all group"
              >
                <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">📸</div>
                <p className="text-gray-600 font-medium">Нажмите, чтобы загрузить фото продуктов</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-gray-50">
                    <img src={selectedImage} alt="Preview" className="w-full h-64 object-contain" />
                  </div>
                  <button 
                    onClick={() => { setSelectedImage(null); setDetectedProducts([]); }}
                    className="mt-4 text-sm text-gray-400 hover:text-rose-600 font-medium transition-colors flex items-center justify-center w-full"
                  >
                    🗑️ Удалить фото и сбросить
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h3 className="font-bold text-gray-900">Результаты распознавания:</h3>
                    <span className="text-[10px] px-2 py-0.5 bg-rose-900/10 text-rose-600 rounded-full font-black uppercase tracking-widest">
                      {detectedProducts.length} предметов
                    </span>
                  </div>
                  
                  {error && (
                    <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-lg">
                      {error}
                    </div>
                  )}
                  
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                    {detectedProducts.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 hover:border-rose-200 transition-all group shadow-sm">
                        <div className="flex items-center space-x-3">
                          <span className="font-bold text-gray-800 text-sm">{p.name}</span>
                          <span className="text-[9px] bg-gray-50 px-2 py-0.5 rounded text-gray-400 uppercase font-black border border-gray-100 tracking-widest">
                            {p.category}
                          </span>
                        </div>
                        <button 
                          onClick={() => handleRemoveProduct(p.id)}
                          className="text-gray-300 hover:text-rose-500 transition-colors p-1"
                          title="Удалить из списка"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Manual add form */}
                  <form onSubmit={handleManualAdd} className="flex space-x-2 pt-3 border-t border-gray-100">
                    <input
                      type="text"
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      placeholder="Добавить вручную..."
                      className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                    />
                    <button
                      type="submit"
                      className="bg-gray-100 text-gray-600 w-10 h-10 rounded-xl font-bold hover:bg-rose-600 hover:text-white transition-all active:scale-90"
                    >
                      +
                    </button>
                  </form>

                  {detectedProducts.length > 0 && (
                    <button 
                      onClick={handleAddAll}
                      className="w-full py-4 bg-rose-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-900/20 active:scale-[0.98] mt-4"
                    >
                      Добавить всё в инвентарь
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AIVisionInput;
