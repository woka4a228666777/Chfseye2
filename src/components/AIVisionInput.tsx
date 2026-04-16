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
        category: p.category || 'other',
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

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-blue-600 hover:underline">← Назад</button>
        <h2 className="text-2xl font-bold">🤖 AI-анализ продуктов (v3)</h2>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${serverStatus?.loaded ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
          <span className="text-sm text-gray-600">
            {serverStatus?.loaded ? `${serverStatus.type}: Ready` : 'Загрузка нейросети...'}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        {!serverStatus?.loaded && (
          <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg flex items-start">
            <span className="mr-2">ℹ️</span>
            <div>
              <p className="font-bold">Инициализация AI:</p>
              <p className="text-sm">Мы загружаем легкую нейросеть прямо в ваш браузер или подключаем облачный API. Это происходит один раз.</p>
              <p className="text-xs mt-1 italic">
                Теперь распознавание работает <strong>быстрее и точнее</strong> с поддержкой LogMeal API.
              </p>
            </div>
          </div>
        )}

        {isProcessing ? (
          <div className="text-center py-12 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="font-medium text-gray-700">{processingStage}</p>
            <div className="space-y-2">
              <p className="text-xs text-gray-500 italic">
                {serverStatus?.type?.includes('Cloud') 
                  ? 'Облачный AI анализирует ваше фото...' 
                  : 'Генерация на CPU может занимать от 1 до 3 минут.'}
              </p>
              <p className="text-xs text-blue-500 animate-pulse">
                Пожалуйста, не закрывайте страницу...
              </p>
            </div>
          </div>
        ) : (
          <>
            {!selectedImage ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:bg-blue-50 transition-colors"
              >
                <div className="text-4xl mb-4">📸</div>
                <p className="text-gray-600">Нажмите, чтобы загрузить фото продуктов</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <img src={selectedImage} alt="Preview" className="w-full h-64 object-contain rounded-lg bg-gray-50 border" />
                  <button 
                    onClick={() => { setSelectedImage(null); setDetectedProducts([]); }}
                    className="mt-2 text-sm text-gray-500 hover:text-red-500"
                  >
                    Удалить фото
                  </button>
                </div>
                
                <div className="space-y-4">
                  <h3 className="font-semibold border-b pb-2">Результаты распознавания:</h3>
                  {error && <div className="text-red-500 text-sm">{error}</div>}
                  
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {detectedProducts.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-100">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-xs bg-white px-2 py-1 rounded text-gray-500 uppercase">{p.category}</span>
                      </div>
                    ))}
                  </div>

                  {detectedProducts.length > 0 && (
                    <button 
                      onClick={handleAddAll}
                      className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors"
                    >
                      Добавить все продукты ({detectedProducts.length})
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
