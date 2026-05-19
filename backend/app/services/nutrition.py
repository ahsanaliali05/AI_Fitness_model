def calculate_calories(profile):
    if profile.gender == "male":
        bmr = 10*profile.weight_kg + 6.25*profile.height_cm - 5*profile.age + 5
    else:
        bmr = 10*profile.weight_kg + 6.25*profile.height_cm - 5*profile.age - 161
    activity_map = {"sedentary":1.2, "light":1.375, "moderate":1.55, "active":1.725}
    return bmr * activity_map.get(profile.activity_level, 1.2)

def generate_meal_plan(calories, macros, restrictions):
    # Dummy implementation – replace with real logic
    return {
        "day1": {"breakfast": "Oatmeal with berries", "lunch": "Grilled chicken salad", "dinner": "Salmon with quinoa"},
        "day2": {"breakfast": "Greek yogurt", "lunch": "Turkey wrap", "dinner": "Beef stir-fry"}
    }