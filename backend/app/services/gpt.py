# import openai
# import os

# openai.api_key = os.getenv("OPENAI_API_KEY", "")

# def get_gpt_response(user_message, context=""):
#     if not openai.api_key:
#         return "GPT not configured. Please add OpenAI API key to environment."
#     try:
#         response = openai.ChatCompletion.create(
#             model="gpt-3.5-turbo",
#             messages=[{"role": "user", "content": f"{context}\nUser: {user_message}"}],
#             max_tokens=300
#         )
#         return response.choices[0].message.content
#     except Exception as e:
#         return f"Error: {str(e)}"