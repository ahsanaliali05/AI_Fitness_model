import os
from groq import Groq

# Initialize Groq client
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    print("Warning: GROQ_API_KEY not set. Chatbot will use fallback.")

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

def get_chat_response(user_message: str, context: str = "") -> str:
    """Get a response from Groq's LLM (fast, cloud-based)."""
    if not client:
        return "Groq API key not configured. Please set GROQ_API_KEY environment variable."

    system_prompt = f"""You are a certified AI fitness coach. You give concise, evidence-based advice.
{context}
Keep responses friendly and motivational. Limit to 3-4 sentences unless asked for details.
"""

    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            model="llama3-70b-8192",  # fast, smart, free tier
            temperature=0.7,
            max_tokens=300,
        )
        reply = chat_completion.choices[0].message.content
        return reply.strip()
    except Exception as e:
        print(f"Groq API error: {e}")
        return f"Sorry, I'm having trouble right now. Please try again later. (Error: {str(e)})"
