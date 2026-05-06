export type Profile = {
  id: string
  email: string
  display_name: string | null
  height_cm: number
  current_weight_kg: number
  target_weight_kg: number
  age: number
  sex: 'male' | 'female' | 'other'
  activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
  goal: 'lose' | 'maintain' | 'gain'
  daily_calorie_target: number
  protein_g_target: number
  carbs_g_target: number
  fat_g_target: number
  unit_system: 'metric' | 'imperial'
  water_target_ml?: number
  created_at: string
  updated_at: string
}

export type Food = {
  id: string
  source: 'usda' | 'off' | 'user' | 'ifct' | 'estimate'
  source_id: string | null
  name: string
  brand: string | null
  serving_size_g: number
  serving_description: string
  kcal_per_100g: number
  protein_g_per_100g: number
  carbs_g_per_100g: number
  fat_g_per_100g: number
  fiber_g_per_100g: number | null
}

export type FoodLog = {
  id: string
  user_id: string
  food_id: string
  food: Food | null
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  servings: number
  grams: number
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  logged_at: string
}

export type ExerciseLog = {
  id: string
  user_id: string
  activity: string
  duration_min: number
  calories: number
  logged_at: string
  created_at: string
}

export type WeightLog = {
  id: string
  user_id: string
  weight_kg: number
  measured_at: string
}

export type DailyTotals = {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export type Subscription = {
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | null
  plan: 'monthly' | 'annual' | null
  current_period_end: string | null
}
