import React, { useState, useEffect } from 'react';
import { ShoppingListItem } from '../types';
import { storage } from '../utils/storage';
import AIVisionService from '../services/aiVisionService';

interface ShoppingListProps {
  onBack: () => void;
}

const ShoppingList: React.FC<ShoppingListProps> = ({ onBack }) => {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    const data = await storage.getShoppingList();
    setItems(data.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime()));
    setIsLoading(false);
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const newItem: ShoppingListItem = {
      id: Date.now().toString(),
      name: newItemName.trim(),
      category: AIVisionService.categorizeProduct(newItemName) as any,
      quantity: '1 шт',
      completed: false,
      addedAt: new Date()
    };

    await storage.addToShoppingList(newItem);
    setItems([newItem, ...items]);
    setNewItemName('');
  };

  const toggleItem = async (id: string) => {
    const updated = items.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    );
    setItems(updated);
    await storage.updateShoppingListItem(id, { completed: !items.find(i => i.id === id)?.completed });
  };

  const removeItem = async (id: string) => {
    await storage.removeFromShoppingList(id);
    setItems(items.filter(item => item.id !== id));
  };

  const clearCompleted = async () => {
    const completedIds = items.filter(i => i.completed).map(i => i.id);
    for (const id of completedIds) {
      await storage.removeFromShoppingList(id);
    }
    setItems(items.filter(item => !item.completed));
  };

  const exportToText = () => {
    const text = items
      .map(item => `${item.completed ? '[x]' : '[ ]'} ${item.name} (${item.quantity})`)
      .join('\n');
    
    navigator.clipboard.writeText(text);
  };

  const completedCount = items.filter(i => i.completed).length;
  const totalCount = items.length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="mr-4 p-2 text-rose-400 hover:bg-grayDark-800 rounded-full transition-colors"
          >
            ←
          </button>
          <h2 className="text-2xl font-bold text-gray-100">Список покупок</h2>
        </div>
        {completedCount > 0 && (
          <button
            onClick={clearCompleted}
            className="text-xs font-black uppercase tracking-widest text-rose-400 hover:text-rose-300 transition-colors"
          >
            Очистить купленное
          </button>
        )}
      </div>

      <div className="bg-grayDark-[#363636] rounded-xl shadow-lg p-6 border border-grayDark-700">
        <form onSubmit={addItem} className="flex gap-3">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="Что нужно купить?"
            className="flex-1 px-4 py-3 bg-grayDark-700 border border-grayDark-600 rounded-xl text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-rose-500 focus:border-transparent outline-none transition-all"
          />
          <button
            type="submit"
            disabled={!newItemName.trim()}
            className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 disabled:opacity-50 transition-all shadow-lg active:scale-95"
          >
            Добавить
          </button>
        </form>
      </div>

      <div className="bg-grayDark-[#363636] rounded-xl shadow-lg border border-grayDark-700 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500 mx-auto"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-5xl mb-4 opacity-30">📝</div>
            <p className="text-gray-500 font-medium">Ваш список покупок пуст</p>
          </div>
        ) : (
          <div className="divide-y divide-grayDark-700">
            {items.map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between p-4 transition-all hover:bg-grayDark-700/50 ${
                  item.completed ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-center flex-1 mr-4">
                  <button
                    onClick={() => toggleItem(item.id)}
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                      item.completed
                        ? 'bg-rose-600 border-rose-600 text-white'
                        : 'border-grayDark-600 hover:border-rose-500/50'
                    }`}
                  >
                    {item.completed && '✓'}
                  </button>
                  <div className="ml-4">
                    <span className={`text-gray-100 font-medium ${item.completed ? 'line-through text-gray-500' : ''}`}>
                      {item.name}
                    </span>
                    <div className="text-[10px] uppercase font-black tracking-widest text-gray-500 mt-0.5">
                      {item.category}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => removeItem(item.id)}
                  className="p-2 text-gray-600 hover:text-rose-500 transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-2 gap-4">
        <button
          onClick={onBack}
          className="px-6 py-3 bg-grayDark-700 text-gray-300 rounded-xl font-bold hover:bg-grayDark-600 transition-all active:scale-95 border border-grayDark-600"
        >
          ← Назад
        </button>
        
        <button
          onClick={exportToText}
          disabled={items.length === 0}
          className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 disabled:opacity-50 transition-all shadow-lg active:scale-95"
        >
          📋 Экспорт
        </button>
      </div>

      {/* Statistics */}
      {items.length > 0 && (
        <div className="mt-8 bg-grayDark-[#363636] rounded-2xl border border-grayDark-700 overflow-hidden shadow-xl">
          <div className="bg-grayDark-900/50 px-6 py-3 border-b border-grayDark-700">
            <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Статистика списка</h4>
          </div>
          <div className="grid grid-cols-3 divide-x divide-grayDark-700">
            <div className="p-6 text-center">
              <div className="text-3xl font-black text-gray-100 mb-1">{totalCount}</div>
              <div className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Всего</div>
            </div>
            <div className="p-6 text-center bg-rose-900/10">
              <div className="text-3xl font-black text-rose-400 mb-1">{totalCount - completedCount}</div>
              <div className="text-[10px] uppercase font-black text-rose-500 tracking-widest">Нужно</div>
            </div>
            <div className="p-6 text-center">
              <div className="text-3xl font-black text-gray-400 mb-1">{completedCount}</div>
              <div className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Куплено</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShoppingList;
