import React, { useState, useRef } from 'react';
import { Product } from '../types';
import { OCRService } from '../services/ocrService';
import AIVisionService from '../services/aiVisionService';

interface ReceiptInputProps {
  onAddProducts: (products: Product[]) => void;
  onBack: () => void;
}

const ReceiptInput: React.FC<ReceiptInputProps> = ({ onAddProducts, onBack }) => {
  const [receiptText, setReceiptText] = useState('');
  const [store, setStore] = useState('');
  const [parsedProducts, setParsedProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditingValue] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processProducts = (productNames: string[]): Product[] => {
    return productNames.map((productName, index) => {
      const cleanedName = OCRService.cleanProductName(productName);
      return {
        id: `receipt-${Date.now()}-${index}`,
        name: cleanedName,
        category: AIVisionService.categorizeProduct(cleanedName) as any,
        status: 'full',
        source: 'ocr'
      };
    });
  };

  const parseReceiptFromText = () => {
    if (!receiptText.trim()) return;

    const result = OCRService.parseReceiptText(receiptText);
    const products = processProducts(result.products);

    if (result.store && !store) {
      setStore(result.store);
    }

    setParsedProducts(products);
    setSelectedProducts(new Set(products.map(p => p.id)));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError('');

    try {
      const extractedText = await OCRService.extractTextFromImage(file);
      setReceiptText(extractedText);
      
      const result = OCRService.parseReceiptText(extractedText);
      const products = processProducts(result.products);

      if (result.store && !store) {
        setStore(result.store);
      }

      setParsedProducts(products);
      setSelectedProducts(new Set(products.map(p => p.id)));
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка обработки изображения');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditStart = (product: Product) => {
    setEditingId(product.id);
    setEditingValue(product.name);
  };

  const handleEditSave = (id: string) => {
    if (!editValue.trim()) return;
    
    setParsedProducts(prev => prev.map(p => 
      p.id === id ? { 
        ...p, 
        name: editValue.trim(), 
        category: AIVisionService.categorizeProduct(editValue.trim()) as any 
      } : p
    ));
    setEditingId(null);
  };

  const handleRemoveProduct = (id: string) => {
    setParsedProducts(prev => prev.filter(p => p.id !== id));
    const newSelected = new Set(selectedProducts);
    newSelected.delete(id);
    setSelectedProducts(newSelected);
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) return;

    const cleanedName = OCRService.cleanProductName(newProductName.trim());
    const newProduct: Product = {
      id: `manual-${Date.now()}`,
      name: cleanedName,
      category: AIVisionService.categorizeProduct(cleanedName) as any,
      status: 'full',
      source: 'manual'
    };

    setParsedProducts(prev => [...prev, newProduct]);
    setSelectedProducts(prev => new Set([...Array.from(prev), newProduct.id]));
    setNewProductName('');
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleProductToggle = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleAddSelected = () => {
    const productsToAdd = parsedProducts.filter(product => 
      selectedProducts.has(product.id)
    );
    
    if (productsToAdd.length > 0) {
      onAddProducts(productsToAdd);
    }
  };

  const selectAll = () => {
    setSelectedProducts(new Set(parsedProducts.map(p => p.id)));
  };

  const selectNone = () => {
    setSelectedProducts(new Set());
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center">
        <button
          onClick={onBack}
          className="mr-4 p-2 text-rose-600 hover:bg-gray-100 rounded-full transition-colors"
        >
          ←
        </button>
        <h2 className="text-2xl font-bold text-gray-900">Сканирование чека</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 space-y-5 border border-gray-200">
        <div>
          <label htmlFor="store" className="block text-sm font-medium text-gray-700 mb-2">
            Магазин (опционально)
          </label>
          <select
            id="store"
            value={store}
            onChange={(e) => setStore(e.target.value)}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition-all"
          >
            <option value="">Выберите магазин</option>
            <option value="Пятерочка">Пятерочка</option>
            <option value="Магнит">Магнит</option>
            <option value="Лента">Лента</option>
            <option value="Другой">Другой магазин</option>
          </select>
        </div>

        <div>
          <label htmlFor="receiptText" className="block text-sm font-medium text-gray-700 mb-2">
            Текст чека
          </label>
          <textarea
            id="receiptText"
            value={receiptText}
            onChange={(e) => setReceiptText(e.target.value)}
            placeholder="Вставьте сюда текст из чека..."
            rows={6}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition-all font-mono text-sm shadow-inner"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={parseReceiptFromText}
            disabled={!receiptText.trim()}
            className="flex-1 min-w-[140px] px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
          >
            Разобрать чек
          </button>
          
          <button
            onClick={triggerFileInput}
            className="flex-1 min-w-[140px] px-6 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-all active:scale-95 flex items-center justify-center space-x-2 shadow-sm"
          >
            <span>📷</span>
            <span>Загрузить фото</span>
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {parsedProducts.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={selectAll}
              className="px-4 py-1.5 bg-gray-50 border border-gray-200 text-gray-500 rounded-lg text-xs font-bold hover:text-rose-600 hover:bg-rose-50 transition-all"
            >
              Выбрать все
            </button>
            <button
              onClick={selectNone}
              className="px-4 py-1.5 bg-gray-50 border border-gray-200 text-gray-500 rounded-lg text-xs font-bold hover:text-rose-600 hover:bg-rose-50 transition-all"
            >
              Снять выделение
            </button>
          </div>
        )}
      </div>

      {isProcessing && (
        <div className="py-12 text-center animate-pulse">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500 mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">Обработка изображения...</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm flex items-center">
          <span className="mr-2">⚠️</span> {error}
        </div>
      )}

      {parsedProducts.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-gray-900">
                Распознанные продукты
              </h3>
              <span className="text-[10px] px-3 py-1 bg-rose-900/10 text-rose-600 rounded-full font-black tracking-widest border border-rose-100 shadow-sm uppercase">
                {selectedProducts.size} выбрано
              </span>
            </div>

            <div className="space-y-2 mb-8 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
              {parsedProducts.map((product) => (
                <div
                  key={product.id}
                  className={`flex items-center p-4 rounded-xl border transition-all group ${
                    selectedProducts.has(product.id)
                      ? 'bg-rose-50/50 border-rose-200'
                      : 'bg-white border-gray-100 opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedProducts.has(product.id)}
                    onChange={() => handleProductToggle(product.id)}
                    className="mr-4 h-5 w-5 rounded border-gray-300 text-rose-600 focus:ring-rose-500 transition-all cursor-pointer"
                  />
                  
                  <div className="flex-1 flex items-center justify-between">
                    {editingId === product.id ? (
                      <div className="flex-1 mr-4">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={() => handleEditSave(product.id)}
                          onKeyDown={(e) => e.key === 'Enter' && handleEditSave(product.id)}
                          autoFocus
                          className="w-full px-3 py-1.5 bg-white border border-rose-400 rounded-lg text-gray-900 focus:outline-none text-sm shadow-sm"
                        />
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center space-x-3 overflow-hidden">
                        <span 
                          className="text-sm font-bold text-gray-800 cursor-text truncate"
                          onClick={() => handleEditStart(product)}
                        >
                          {product.name}
                        </span>
                        <span className="text-[9px] bg-gray-50 px-2 py-0.5 rounded-full text-gray-400 uppercase font-black tracking-widest border border-gray-100">
                          {product.category}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => handleEditStart(product)}
                        className="p-2 text-gray-300 hover:text-rose-500 transition-colors"
                        title="Редактировать"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleRemoveProduct(product.id)}
                        className="p-2 text-gray-300 hover:text-rose-600 transition-colors"
                        title="Удалить"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col space-y-4 pt-4 border-t border-gray-100">
              <form onSubmit={handleManualAdd} className="flex space-x-2">
                <input
                  type="text"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="Добавить вручную..."
                  className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                />
                <button
                  type="submit"
                  className="bg-gray-100 text-gray-600 w-10 h-10 rounded-xl flex items-center justify-center font-bold hover:bg-rose-600 hover:text-white transition-all active:scale-90"
                >
                  +
                </button>
              </form>

              <button
                onClick={handleAddSelected}
                disabled={selectedProducts.size === 0}
                className="w-full py-4 bg-rose-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-rose-700 disabled:opacity-50 transition-all shadow-lg shadow-rose-900/20 active:scale-[0.98]"
              >
                Добавить выбранное ({selectedProducts.size})
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Как это работает:</h3>
        <div className="space-y-4 text-sm text-gray-600">
          <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-xl shadow-sm">
            <strong className="text-rose-900">Автоматическое распознавание:</strong>
            <p className="mt-1">Загрузите фото чека - система сама распознает текст и извлечет продукты!</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <strong className="block text-gray-800 mb-1">📷 Фото чека:</strong>
              Сфотографируйте чек и загрузите фото
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <strong className="block text-gray-800 mb-1">📋 Текст чека:</strong>
              Скопируйте текст из приложения магазина
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white p-3 rounded-xl border border-gray-100 text-center shadow-sm">
              <strong className="text-gray-900 block mb-1 text-xs">Пятерочка</strong>
              <span className="text-[9px] text-gray-400 uppercase font-black">Приложение, email</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-gray-100 text-center shadow-sm">
              <strong className="text-gray-900 block mb-1 text-xs">Магнит</strong>
              <span className="text-[9px] text-gray-400 uppercase font-black">СМС, приложение</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-gray-100 text-center shadow-sm">
              <strong className="text-gray-900 block mb-1 text-xs">Лента</strong>
              <span className="text-[9px] text-gray-400 uppercase font-black">Приложение, email</span>
            </div>
          </div>
          
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl italic text-xs">
            <span className="text-rose-500 mr-2">💡</span>
            <strong>Совет:</strong> Фото чека должно быть четким и хорошо освещенным для лучшего распознавания.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptInput;
