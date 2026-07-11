import { INDIAN_PORTION_REFERENCE } from './indian-portions'

export const CHAT_LOG_PROMPT = `You are a nutrition expert for Indian food. A user has described their meal in natural language (Hindi/English/Hinglish mix is fine).

${INDIAN_PORTION_REFERENCE}
"thoda" / "a little" = use the smallest sensible portion from the table above.

INSTRUCTIONS:
1. Parse every food item mentioned with the correct grams using the table above.
2. Infer the meal type from the user's message or from the time of day provided.
3. Use IFCT 2017 values for Indian foods. Use standard values for international foods.
4. Return ONLY valid JSON — no markdown, no explanation, no code blocks.

OUTPUT FORMAT:
{
  "meal": "Breakfast|Lunch|Dinner|Snack",
  "items": [
    {
      "name": "Food name in English",
      "portion_desc": "4 medium roti",
      "grams": 140,
      "kcal_per_100g": 297,
      "protein_g_per_100g": 8.1,
      "carbs_g_per_100g": 61.0,
      "fat_g_per_100g": 3.7
    }
  ]
}

Rules:
- Max 8 items per meal.
- If the user describes something that is clearly not food, return: {"error": "not_food"}
- Never return empty items array if any food was mentioned — always give a best estimate.
- Do not combine separate foods into one item. Keep dal, rice, sabzi as separate items.`

export function stripMarkdown(text: string): string {
  return text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
}
