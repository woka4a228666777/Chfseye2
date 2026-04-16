import os
import logging
import io
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import requests

# Загружаем переменные окружения
load_dotenv()

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('ai_proxy')

app = Flask(__name__)
CORS(app)

# Конфигурация OCR.space (Бесплатный ключ на 250 запросов/день)
OCR_API_KEY = 'K88937697488957'
OCR_URL = 'https://api.ocr.space/parse/image'

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok",
        "engine": "OCR.space (No HuggingFace)",
        "has_key": bool(OCR_API_KEY)
    })

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        if 'image' not in request.files:
            return jsonify({"error": "No image provided"}), 400
        
        image_file = request.files['image']
        
        # Подготовка данных для OCR.space
        payload = {
            'apikey': OCR_API_KEY,
            'language': 'rus', # Пробуем русский, так как продукты могут быть на русском
            'isOverlayRequired': False,
            'OCREngine': 2 # Engine 2 лучше для мелкого текста и этикеток
        }
        
        files = {
            'file': (image_file.filename, image_file.read(), image_file.content_type)
        }
        
        logger.info(f"Sending request to OCR.space...")
        response = requests.post(OCR_URL, data=payload, files=files, timeout=30)
        
        if response.status_code != 200:
            return jsonify({"error": f"OCR API Error: {response.status_code}", "details": response.text}), response.status_code

        result = response.json()
        
        if result.get('IsErroredOnProcessing'):
            return jsonify({"error": "OCR Processing Error", "details": result.get('ErrorMessage')}), 500

        # Извлекаем текст
        parsed_results = result.get('ParsedResults', [])
        all_text = ""
        for res in parsed_results:
            all_text += res.get('ParsedText', '') + " "
            
        logger.info(f"OCR Extracted Text: {all_text[:200]}...")

        # Парсим продукты из текста
        products = parse_text_to_products(all_text)
        
        return jsonify({
            "success": True,
            "products": products,
            "raw_caption": all_text.strip(),
            "model_used": "OCR.space Engine 2"
        })

    except Exception as e:
        logger.exception("Proxy error")
        return jsonify({"error": str(e)}), 500

def parse_text_to_products(text):
    # Очистка текста
    import re
    
    # Список стоп-слов, которые часто встречаются на упаковках, но не являются продуктами
    stop_words = {'цена', 'вес', 'состав', 'годен', 'дата', 'изготовитель', 'адрес', 'ккал', 'белки', 'жиры', 'углеводы'}
    
    # Разбиваем текст на слова и фразы
    # Ищем слова длиннее 3 символов, состоящие из букв
    words = re.findall(r'[а-яА-ЯёЁa-zA-Z]{3,}', text)
    
    products = []
    seen = set()
    
    for word in words:
        word_lower = word.lower()
        if word_lower not in stop_words and word_lower not in seen and len(word_lower) > 3:
            # Пытаемся определить категорию по ключевым словам
            category = "other"
            if any(k in word_lower for k in ['молок', 'сыр', 'йогурт', 'творог', 'масл']): category = "dairy"
            elif any(k in word_lower for k in ['яблок', 'банан', 'апельсин', 'лимон', 'фрукт']): category = "fruits"
            elif any(k in word_lower for k in ['помидор', 'огурец', 'картоф', 'морков', 'лук']): category = "vegetables"
            elif any(k in word_lower for k in ['мясо', 'куриц', 'говяд', 'свин', 'рыб', 'яйц']): category = "protein"
            elif any(k in word_lower for k in ['сок', 'вод', 'кола', 'пиво', 'вино', 'напит']): category = "beverages"
            elif any(k in word_lower for k in ['хлеб', 'булоч', 'торт', 'печенье']): category = "bakery"
            
            products.append({
                "name": word.capitalize(),
                "category": category,
                "confidence": 0.8
            })
            seen.add(word_lower)
            
        # Ограничиваем количество найденных продуктов, чтобы не перегружать интерфейс
        if len(products) >= 15:
            break
            
    return products

if __name__ == '__main__':
    logger.info(f"Starting OCR-based Proxy on port 7860...")
    app.run(host='0.0.0.0', port=7860, debug=False)
