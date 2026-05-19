from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_NAME = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"

def load_model():
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME,
        torch_dtype="auto",
        device_map="auto"  # CPU if no GPU
    )
    return model, tokenizer

# Load once at module import
model, tokenizer = load_model()

def get_chat_response(user_message: str, context: str = "") -> str:
    messages = [
        {"role": "system", "content": f"You are a certified AI fitness coach. {context}"},
        {"role": "user", "content": user_message}
    ]
    prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    outputs = model.generate(
        **inputs,
        max_new_tokens=256,
        temperature=0.7,
        do_sample=True,
        top_p=0.9
    )
    response = tokenizer.decode(outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
    return response.strip()