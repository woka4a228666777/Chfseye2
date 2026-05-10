import React, { useState } from 'react';
import { Product } from '../types';
import AIVisionService from '../services/aiVisionService';

interface ManualInputProps {
  onAddProduct: (product: Product) => void;
  onBack: () => void;
}

const ManualInput: React.FC<ManualInputProps> = ({ onAddProduct, onBack }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('other');
  const [status, setStatus] = useState<Product['status']>('full');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newProduct: Product = {
      id: Date.now().toString(),
      name: name.trim(),
      category: category as any,
      status,
      source: 'manual'
    };

    onAddProduct(newProduct);
    setName('');
  };

  const categories = [
    { id: 'vegetables', name: 'Овощи', icon: '🥕' },
    { id: 'fruits', name: 'Фрукты', icon: '🍎' },
    { id: 'protein', name: 'Мясо и птица', icon: '🍗' },
    { id: 'dairy', name: 'Молочные продукты', icon: '🥛' },
    { id: 'carbs', name: 'Бакалея', icon: '🍝' },
    { id: 'beverages', name: 'Напитки', icon: '🥤' },
    { id: 'other', name: 'Другое', icon: '📦' }
  ];

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center">
        <button
          onClick={onBack}
          className="mr-4 p-2 text-rose-400 hover:bg-grayDark-800 rounded-full transition-colors"
        >
          ←
        </button>
        <h2 className="text-2xl font-bold text-gray-100">Добавить вручную</h2>
      </div>

      <div className="bg-grayDark-[#363636] rounded-xl shadow-lg p-8 border border-grayDark-700">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Название продукта
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Помидоры"
              className="w-full px-4 py-3 bg-grayDark-700 border border-grayDark-600 rounded-xl text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-rose-500 outline-none transition-all shadow-inner"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-3">
              Категория
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                    category === cat.id
                      ? 'bg-rose-900/30 border-rose-500 text-rose-300 shadow-lg shadow-rose-900/20'
                      : 'bg-grayDark-700 border-grayDark-600 text-gray-400 hover:border-grayDark-500'
                  }`}
                >
                  <span className="text-xl mb-1">{cat.icon}</span>
                  <span className="text-[10px] font-bold text-center">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-3">
              Статус наличия
            </label>
            <div className="flex gap-3">
              {(['full', 'low', 'empty'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex-1 py-3 px-4 rounded-xl border font-bold text-xs uppercase tracking-widest transition-all ${
                    status === s
                      ? s === 'full' ? 'bg-rose-600 border-rose-500 text-white shadow-lg' :
                        s === 'low' ? 'bg-yellow-600 border-yellow-500 text-white shadow-lg' :
                        'bg-gray-600 border-gray-500 text-white shadow-lg'
                      : 'bg-grayDark-700 border-grayDark-600 text-gray-400'
                  }`}
                >
                  {s === 'full' ? 'Есть' : s === 'low' ? 'Мало' : 'Нет'}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-rose-600 text-white rounded-xl font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-xl shadow-rose-900/20 active:scale-[0.98] mt-4"
          >
            Добавить в инвентарь
          </button>
        </form>
      </div>
    </div>
  );
};

export default ManualInput;
