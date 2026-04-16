import os
import torch
import logging
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
import io
import time
import threading
from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor
from qwen_vl_utils import process_vision_info

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('robust_server')

app = Flask(__name__)
CORS(app)

# Увеличиваем лимит загрузки до 32MB
app.config['MAX_CONTENT_LENGTH'] = 32 * 1024 * 1024

# Конфигурация
MODEL_ID = "nanonets/Nanonets-OCR2-3B"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
PORT = 7860

# Глобальные переменные для модели
model = None
processor = None
model_status = "Not Started"
loading_error = None

def load_model():
    global model, processor, model_status, loading_error
    model_status = "Loading..."
    logger.info(f"--- STARTING MODEL LOAD: {MODEL_ID} on {DEVICE} ---")
    try:
        # Загружаем процессор
        processor = AutoProcessor.from_pretrained(MODEL_ID, trust_remote_code=True)
        logger.info("Processor loaded successfully.")
        
        # Параметры загрузки модели
        model_kwargs = {
            "trust_remote_code": True,
            "torch_dtype": torch.float16 if torch.cuda.is_available() else torch.float32,
            "device_map": "auto" if torch.cuda.is_available() else None
        }
        
        # Загружаем веса
        logger.info("Loading model weights (this may take a few minutes)...")
        model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
            MODEL_ID,
            **model_kwargs
        )
        
        if DEVICE == "cpu":
            model = model.to(torch.float32) # На CPU лучше использовать float32
            
        model.eval()
        model_status = "Ready"
        logger.info("--- !!! MODEL LOADED AND READY !!! ---")
    except Exception as e:
        loading_error = str(e)
        model_status = "Error"
        logger.error(f"FATAL ERROR DURING MODEL LOAD: {e}", exc_info=True)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok",
        "model_loaded": model is not None,
        "model_status": model_status,
        "error": loading_error,
        "device": DEVICE,
        "model_type": "Nanonets-OCR2-3B"
    })

@app.route('/analyze', methods=['POST'])
def analyze():
    logger.info("--- !!! RECEIVED ANALYZE REQUEST !!! ---")
    if model is None:
        logger.warning(f"Request rejected: model is in state {model_status}")
        return jsonify({
            "success": False, 
            "error": "Model not loaded yet", 
            "status": model_status,
            "details": loading_error
        }), 503
    
    try:
        if 'image' not in request.files:
            logger.error("No image file in request")
            return jsonify({"success": False, "error": "No image provided"}), 400
        
        image_file = request.files['image']
        logger.info(f"Processing image: {image_file.filename}")
        image = Image.open(image_file).convert("RGB")
        
        # Еще сильнее уменьшаем размер для ускорения на CPU
        image.thumbnail((600, 600))
        
        # Сохраняем временно для процессора
        temp_path = "temp_inference.jpg"
        image.save(temp_path)
        
        # Промпт
        user_prompt = "Identify all edible and drinkable items in this photo. List them as a simple comma-separated list. Example: apple, milk, bread. Do not include any other text."
        
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": temp_path},
                    {"type": "text", "text": user_prompt},
                ],
            }
        ]

        # Подготовка инпутов
        logger.info("Applying chat template and processing vision info...")
        text = processor.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        image_inputs, video_inputs = process_vision_info(messages)
        inputs = processor(
            text=[text],
            images=image_inputs,
            videos=video_inputs,
            padding=True,
            return_tensors="pt",
        )
        inputs = inputs.to(model.device)

        # Генерация
        logger.info(f"Generating AI response on {model.device}... (this may take a while)")
        start_time = time.time()
        with torch.no_grad():
            # Настраиваем генерацию для максимальной стабильности на CPU
            generated_ids = model.generate(
                **inputs, 
                max_new_tokens=32,       # Ещё меньше токенов, нам нужно только название
                repetition_penalty=1.5,  # Увеличиваем штраф за повторы
                no_repeat_ngram_size=2,  # Запрещаем повторение фраз
                temperature=0.1,         # Делаем модель максимально предсказуемой
                top_p=0.9,
                do_sample=False          # Жадное декодирование для исключения галлюцинаций
            )
            generated_ids_trimmed = [
                out_ids[len(in_ids) :] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
            ]
            caption = processor.batch_decode(
                generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
            )[0]
        
        # Глубокая очистка от технического мусора и кода
        caption = re.sub(r'[^\x00-\x7Fа-яА-ЯёЁ\s,.-]+', '', caption)
        # Убираем типичные слова-галлюцинации и технический код
        garbage_words = ['TOKEN', 'DllImport', 'fxml', ' Nesstown', ' Oswaldtre', ' EDITOR', ' buttonShape', ' torse_weak', ' getColumnWithValue']
        for word in garbage_words:
            caption = caption.replace(word, '')
        caption = caption.strip()
        
        duration = time.time() - start_time
        logger.info(f"--- GENERATION FINISHED in {duration:.2f}s ---")
        logger.info(f"Result: {caption}")
        
        # Парсинг результатов
        products = parse_ai_output(caption)
        
        return jsonify({
            "success": True,
            "products": products,
            "raw_caption": caption,
            "processing_time": duration,
            "model_used": "Nanonets-OCR2-3B-Local"
        })
        
    except Exception as e:
        logger.exception("Error during inference")
        return jsonify({"success": False, "error": str(e)}), 500

def parse_ai_output(caption):
    # Очистка от вводных фраз и мусора
    cleaned = caption.replace("Example:", "").replace("Example(", "").replace(")", "").strip()
    cleaned = re.sub(r'^(I see|This photo shows|Items:|Products:)\s*', '', cleaned, flags=re.IGNORECASE)
    
    # Разбиваем по запятым, точкам с запятой или новым строкам
    items = re.split(r'[,\n;]+', cleaned)
    
    result = []
    for i, item in enumerate(items):
        name = item.strip().strip(".-*").strip()
        if len(name) > 2:
            # Пытаемся определить категорию по названию
            category = "food"
            name_lower = name.lower()
            if any(word in name_lower for word in ['milk', 'water', 'juice', 'cola', 'soda', 'drink', 'beverage', 'beer', 'wine']):
                category = "beverage"
            elif any(word in name_lower for word in ['apple', 'banana', 'orange', 'fruit', 'lemon', 'berry', 'strawberry', 'grape']):
                category = "fruit"
            elif any(word in name_lower for word in ['bread', 'bun', 'croissant', 'cake', 'bakery']):
                category = "bakery"
            elif any(word in name_lower for word in ['meat', 'chicken', 'beef', 'pork', 'fish', 'egg']):
                category = "protein"
                
            result.append({
                "id": f"loc-{int(time.time())}-{i}",
                "name": name,
                "category": category,
                "confidence": 0.95
            })
    return result

if __name__ == '__main__':
    # Запуск загрузки модели в отдельном потоке
    threading.Thread(target=load_model, daemon=True).start()
    
    logger.info(f"Starting server on port {PORT}...")
    app.run(host='0.0.0.0', port=PORT, debug=False)
