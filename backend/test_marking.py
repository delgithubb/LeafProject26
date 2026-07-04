import base64
import os
import requests

# Finds the absolute folder path where test_marking.py lives
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGE_PATH = os.path.join(BASE_DIR, "studentwork.png")
with open(IMAGE_PATH, "rb") as image_file:
    encoded_string = base64.b64encode(image_file.read()).decode("utf-8")

# 2. Build the data URL payload
image_payload = f"data:image/png;base64,{encoded_string}"

# 3. Construct the payload matching your MarkRequest Pydantic model
payload = {
    "question_text": "$$f(x) = 3x^3 + 2ax^2 - 4x + 5a$$Given that $(x + 3)$ is a factor of $f(x)$, find the value of the constant $a$.",
    "image_base64": image_payload,
    "marks": 3,
    "model": "gemini-2.5-flash" # Uses your default, or you can change it
}

# 4. Send the POST request to your running FastAPI server
URL = "http://127.0.0.1:8000/api/mark"
print("Sending request to backend...")
response = requests.post(URL, json=payload)

# 5. Print the structured result
if response.status_code == 200:
    print("Success! Response JSON:")
    print(response.json())
else:
    print(f"Error {response.status_code}:")
    print(response.text)