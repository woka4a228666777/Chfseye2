import requests

url = 'http://127.0.0.1:7860/analyze'
files = {'image': open('Multimodal-OCR/examples/1.jpg', 'rb')}

print(f"Sending request to {url}...")
try:
    response = requests.post(url, files=files, timeout=300)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
