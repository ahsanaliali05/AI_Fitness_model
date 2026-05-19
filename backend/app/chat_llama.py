from llama_cpp import Llama
import os

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf")

llm = None

def get_llm():
    global llm
    if llm is None:
        llm = Llama(model_path=MODEL_PATH, n_ctx=2048, n_threads=4, verbose=False)
    return llm

def get_chat_response(user_message: str, context: str = "") -> str:
    llm = get_llm()
    prompt = f"""<|system|>
I am a certified AI fitness coach. {context}
<|user|>
{user_message}
<|assistant|>
"""
    output = llm(prompt, max_tokens=300, temperature=0.7, stop=["<|user|>", "<|system|>"])
    return output["choices"][0]["text"].strip()