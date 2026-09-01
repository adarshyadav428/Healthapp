// Indian food database based on IFCT 2017 (Indian Food Composition Tables)
// Published by National Institute of Nutrition (NIN), Hyderabad
// Nutrition values are per 100g unless noted. Serving descriptions use Indian units.

export type FoodSeed = {
  source: string
  source_id: string
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

export const INDIAN_FOODS: FoodSeed[] = [
  // ─── GRAINS & BREADS ───────────────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-rice-cooked', name: 'Cooked Rice (Chawal)',
    brand: null, serving_size_g: 180, serving_description: '1 katori (180g)',
    kcal_per_100g: 130, protein_g_per_100g: 2.7, carbs_g_per_100g: 28.1, fat_g_per_100g: 0.3, fiber_g_per_100g: 0.2,
  },
  {
    source: 'ifct', source_id: 'ifct-rice-raw', name: 'Raw Rice (Chawal)',
    brand: null, serving_size_g: 100, serving_description: '100g (uncooked)',
    kcal_per_100g: 345, protein_g_per_100g: 6.8, carbs_g_per_100g: 78.2, fat_g_per_100g: 0.5, fiber_g_per_100g: 0.6,
  },
  {
    source: 'ifct', source_id: 'ifct-rice-basmati-cooked', name: 'Cooked Basmati Rice',
    brand: null, serving_size_g: 180, serving_description: '1 katori (180g)',
    kcal_per_100g: 121, protein_g_per_100g: 2.5, carbs_g_per_100g: 26.8, fat_g_per_100g: 0.2, fiber_g_per_100g: 0.3,
  },
  {
    source: 'ifct', source_id: 'ifct-roti-wheat', name: 'Roti / Chapati (Wheat)',
    brand: null, serving_size_g: 40, serving_description: '1 roti (40g)',
    kcal_per_100g: 297, protein_g_per_100g: 7.8, carbs_g_per_100g: 63.7, fat_g_per_100g: 3.7, fiber_g_per_100g: 2.0,
  },
  {
    source: 'ifct', source_id: 'ifct-paratha-plain', name: 'Plain Paratha',
    brand: null, serving_size_g: 70, serving_description: '1 paratha (70g)',
    kcal_per_100g: 326, protein_g_per_100g: 8.1, carbs_g_per_100g: 56.0, fat_g_per_100g: 8.6, fiber_g_per_100g: 2.1,
  },
  {
    source: 'ifct', source_id: 'ifct-paratha-aloo', name: 'Aloo Paratha',
    brand: null, serving_size_g: 100, serving_description: '1 paratha (100g)',
    kcal_per_100g: 208, protein_g_per_100g: 4.7, carbs_g_per_100g: 32.4, fat_g_per_100g: 7.1, fiber_g_per_100g: 1.8,
  },
  {
    source: 'ifct', source_id: 'ifct-paratha-gobi', name: 'Gobi Paratha',
    brand: null, serving_size_g: 100, serving_description: '1 paratha (100g)',
    kcal_per_100g: 196, protein_g_per_100g: 5.2, carbs_g_per_100g: 29.8, fat_g_per_100g: 7.0, fiber_g_per_100g: 2.2,
  },
  {
    source: 'ifct', source_id: 'ifct-puri', name: 'Puri',
    brand: null, serving_size_g: 30, serving_description: '1 puri (30g)',
    kcal_per_100g: 368, protein_g_per_100g: 7.2, carbs_g_per_100g: 52.3, fat_g_per_100g: 14.7, fiber_g_per_100g: 1.8,
  },
  {
    source: 'ifct', source_id: 'ifct-naan', name: 'Naan',
    brand: null, serving_size_g: 90, serving_description: '1 naan (90g)',
    kcal_per_100g: 317, protein_g_per_100g: 10.3, carbs_g_per_100g: 58.6, fat_g_per_100g: 5.0, fiber_g_per_100g: 1.5,
  },
  {
    source: 'ifct', source_id: 'ifct-bhatura', name: 'Bhatura',
    brand: null, serving_size_g: 80, serving_description: '1 bhatura (80g)',
    kcal_per_100g: 348, protein_g_per_100g: 8.1, carbs_g_per_100g: 50.9, fat_g_per_100g: 13.0, fiber_g_per_100g: 1.4,
  },
  {
    source: 'ifct', source_id: 'ifct-atta', name: 'Wheat Flour (Atta)',
    brand: null, serving_size_g: 30, serving_description: '2 tbsp (30g)',
    kcal_per_100g: 341, protein_g_per_100g: 12.1, carbs_g_per_100g: 69.4, fat_g_per_100g: 1.7, fiber_g_per_100g: 2.7,
  },
  {
    source: 'ifct', source_id: 'ifct-thepla', name: 'Thepla (Gujarati)',
    brand: null, serving_size_g: 50, serving_description: '1 thepla (50g)',
    kcal_per_100g: 285, protein_g_per_100g: 8.9, carbs_g_per_100g: 45.0, fat_g_per_100g: 8.2, fiber_g_per_100g: 3.1,
  },
  {
    source: 'ifct', source_id: 'ifct-makki-roti', name: 'Makki ki Roti',
    brand: null, serving_size_g: 50, serving_description: '1 roti (50g)',
    kcal_per_100g: 310, protein_g_per_100g: 7.4, carbs_g_per_100g: 67.5, fat_g_per_100g: 2.5, fiber_g_per_100g: 1.9,
  },

  // ─── RICE DISHES ─────────────────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-biryani-chicken', name: 'Chicken Biryani',
    brand: null, serving_size_g: 300, serving_description: '1 plate (300g)',
    kcal_per_100g: 185, protein_g_per_100g: 10.2, carbs_g_per_100g: 25.0, fat_g_per_100g: 5.8, fiber_g_per_100g: 0.8,
  },
  {
    source: 'ifct', source_id: 'ifct-biryani-veg', name: 'Veg Biryani',
    brand: null, serving_size_g: 250, serving_description: '1 plate (250g)',
    kcal_per_100g: 155, protein_g_per_100g: 4.2, carbs_g_per_100g: 28.4, fat_g_per_100g: 3.8, fiber_g_per_100g: 1.5,
  },
  {
    source: 'ifct', source_id: 'ifct-pulao-veg', name: 'Veg Pulao',
    brand: null, serving_size_g: 200, serving_description: '1 katori (200g)',
    kcal_per_100g: 148, protein_g_per_100g: 3.9, carbs_g_per_100g: 27.0, fat_g_per_100g: 3.0, fiber_g_per_100g: 1.2,
  },
  {
    source: 'ifct', source_id: 'ifct-khichdi', name: 'Dal Khichdi',
    brand: null, serving_size_g: 250, serving_description: '1 katori (250g)',
    kcal_per_100g: 118, protein_g_per_100g: 5.2, carbs_g_per_100g: 20.8, fat_g_per_100g: 2.1, fiber_g_per_100g: 1.4,
  },
  {
    source: 'ifct', source_id: 'ifct-curd-rice', name: 'Curd Rice (Thayir Sadam)',
    brand: null, serving_size_g: 200, serving_description: '1 katori (200g)',
    kcal_per_100g: 108, protein_g_per_100g: 3.8, carbs_g_per_100g: 19.2, fat_g_per_100g: 2.2, fiber_g_per_100g: 0.3,
  },
  {
    source: 'ifct', source_id: 'ifct-lemon-rice', name: 'Lemon Rice (Chitranna)',
    brand: null, serving_size_g: 200, serving_description: '1 katori (200g)',
    kcal_per_100g: 153, protein_g_per_100g: 2.9, carbs_g_per_100g: 27.6, fat_g_per_100g: 3.8, fiber_g_per_100g: 0.6,
  },

  // ─── SOUTH INDIAN ────────────────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-idli', name: 'Idli',
    brand: null, serving_size_g: 120, serving_description: '2 idlis (120g)',
    kcal_per_100g: 86, protein_g_per_100g: 3.9, carbs_g_per_100g: 18.1, fat_g_per_100g: 0.1, fiber_g_per_100g: 0.9,
  },
  {
    source: 'ifct', source_id: 'ifct-dosa-plain', name: 'Plain Dosa',
    brand: null, serving_size_g: 85, serving_description: '1 dosa (85g)',
    kcal_per_100g: 133, protein_g_per_100g: 3.7, carbs_g_per_100g: 23.5, fat_g_per_100g: 2.7, fiber_g_per_100g: 0.8,
  },
  {
    source: 'ifct', source_id: 'ifct-dosa-masala', name: 'Masala Dosa',
    brand: null, serving_size_g: 150, serving_description: '1 dosa (150g)',
    kcal_per_100g: 153, protein_g_per_100g: 4.1, carbs_g_per_100g: 25.7, fat_g_per_100g: 4.6, fiber_g_per_100g: 1.1,
  },
  {
    source: 'ifct', source_id: 'ifct-uttapam', name: 'Uttapam',
    brand: null, serving_size_g: 100, serving_description: '1 uttapam (100g)',
    kcal_per_100g: 107, protein_g_per_100g: 3.5, carbs_g_per_100g: 18.9, fat_g_per_100g: 2.3, fiber_g_per_100g: 1.2,
  },
  {
    source: 'ifct', source_id: 'ifct-sambhar', name: 'Sambar (South Indian Dal)',
    brand: null, serving_size_g: 200, serving_description: '1 katori (200g)',
    kcal_per_100g: 55, protein_g_per_100g: 3.1, carbs_g_per_100g: 8.2, fat_g_per_100g: 1.2, fiber_g_per_100g: 1.8,
  },
  {
    source: 'ifct', source_id: 'ifct-rasam', name: 'Rasam',
    brand: null, serving_size_g: 150, serving_description: '1 cup (150ml)',
    kcal_per_100g: 30, protein_g_per_100g: 1.5, carbs_g_per_100g: 4.8, fat_g_per_100g: 0.8, fiber_g_per_100g: 0.5,
  },
  {
    source: 'ifct', source_id: 'ifct-vada-medu', name: 'Medu Vada',
    brand: null, serving_size_g: 50, serving_description: '1 vada (50g)',
    kcal_per_100g: 271, protein_g_per_100g: 9.8, carbs_g_per_100g: 28.7, fat_g_per_100g: 13.2, fiber_g_per_100g: 1.9,
  },
  {
    source: 'ifct', source_id: 'ifct-appam', name: 'Appam',
    brand: null, serving_size_g: 60, serving_description: '1 appam (60g)',
    kcal_per_100g: 153, protein_g_per_100g: 3.2, carbs_g_per_100g: 29.8, fat_g_per_100g: 2.5, fiber_g_per_100g: 0.7,
  },
  {
    source: 'ifct', source_id: 'ifct-puttu', name: 'Puttu (Kerala)',
    brand: null, serving_size_g: 100, serving_description: '1 serving (100g)',
    kcal_per_100g: 351, protein_g_per_100g: 5.9, carbs_g_per_100g: 74.8, fat_g_per_100g: 2.8, fiber_g_per_100g: 1.1,
  },

  // ─── SNACKS & BREAKFAST ──────────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-poha', name: 'Poha (Kanda Poha)',
    brand: null, serving_size_g: 200, serving_description: '1 plate (200g)',
    kcal_per_100g: 120, protein_g_per_100g: 2.8, carbs_g_per_100g: 23.4, fat_g_per_100g: 2.1, fiber_g_per_100g: 1.2,
  },
  {
    source: 'ifct', source_id: 'ifct-upma', name: 'Upma (Sooji)',
    brand: null, serving_size_g: 200, serving_description: '1 plate (200g)',
    kcal_per_100g: 122, protein_g_per_100g: 3.4, carbs_g_per_100g: 20.8, fat_g_per_100g: 3.1, fiber_g_per_100g: 1.5,
  },
  {
    source: 'ifct', source_id: 'ifct-dhokla', name: 'Dhokla (Gujarati)',
    brand: null, serving_size_g: 100, serving_description: '2 pieces (100g)',
    kcal_per_100g: 160, protein_g_per_100g: 7.5, carbs_g_per_100g: 28.2, fat_g_per_100g: 2.4, fiber_g_per_100g: 1.8,
  },
  {
    source: 'ifct', source_id: 'ifct-khandvi', name: 'Khandvi',
    brand: null, serving_size_g: 100, serving_description: '1 serving (100g)',
    kcal_per_100g: 162, protein_g_per_100g: 6.8, carbs_g_per_100g: 22.4, fat_g_per_100g: 5.2, fiber_g_per_100g: 1.5,
  },
  {
    source: 'ifct', source_id: 'ifct-handvo', name: 'Handvo',
    brand: null, serving_size_g: 100, serving_description: '1 slice (100g)',
    kcal_per_100g: 192, protein_g_per_100g: 7.2, carbs_g_per_100g: 28.1, fat_g_per_100g: 6.0, fiber_g_per_100g: 2.1,
  },
  {
    source: 'ifct', source_id: 'ifct-besan-chilla', name: 'Besan Chilla (Gram Flour Pancake)',
    brand: null, serving_size_g: 80, serving_description: '1 chilla (80g)',
    kcal_per_100g: 175, protein_g_per_100g: 8.9, carbs_g_per_100g: 24.5, fat_g_per_100g: 4.8, fiber_g_per_100g: 3.2,
  },
  {
    source: 'ifct', source_id: 'ifct-moong-chilla', name: 'Moong Dal Chilla',
    brand: null, serving_size_g: 80, serving_description: '1 chilla (80g)',
    kcal_per_100g: 165, protein_g_per_100g: 9.8, carbs_g_per_100g: 22.1, fat_g_per_100g: 4.2, fiber_g_per_100g: 2.8,
  },

  // ─── DALS & LEGUMES (COOKED) ─────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-dal-toor-cooked', name: 'Toor Dal (Arhar Dal)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 102, protein_g_per_100g: 6.8, carbs_g_per_100g: 17.1, fat_g_per_100g: 0.4, fiber_g_per_100g: 3.0,
  },
  {
    source: 'ifct', source_id: 'ifct-dal-moong-cooked', name: 'Moong Dal (Yellow)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 104, protein_g_per_100g: 7.6, carbs_g_per_100g: 16.9, fat_g_per_100g: 0.4, fiber_g_per_100g: 2.8,
  },
  {
    source: 'ifct', source_id: 'ifct-dal-masoor-cooked', name: 'Masoor Dal (Red Lentil)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 101, protein_g_per_100g: 7.2, carbs_g_per_100g: 16.4, fat_g_per_100g: 0.3, fiber_g_per_100g: 3.2,
  },
  {
    source: 'ifct', source_id: 'ifct-dal-chana', name: 'Chana Dal',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 107, protein_g_per_100g: 7.1, carbs_g_per_100g: 18.2, fat_g_per_100g: 0.5, fiber_g_per_100g: 4.1,
  },
  {
    source: 'ifct', source_id: 'ifct-dal-urad', name: 'Urad Dal (Black)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 105, protein_g_per_100g: 8.0, carbs_g_per_100g: 15.9, fat_g_per_100g: 0.7, fiber_g_per_100g: 3.5,
  },
  {
    source: 'ifct', source_id: 'ifct-dal-tadka', name: 'Dal Tadka',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 98, protein_g_per_100g: 5.8, carbs_g_per_100g: 14.2, fat_g_per_100g: 2.8, fiber_g_per_100g: 2.5,
  },
  {
    source: 'ifct', source_id: 'ifct-dal-makhani', name: 'Dal Makhani',
    brand: null, serving_size_g: 200, serving_description: '1 katori (200g)',
    kcal_per_100g: 108, protein_g_per_100g: 5.5, carbs_g_per_100g: 12.8, fat_g_per_100g: 4.5, fiber_g_per_100g: 2.8,
  },
  {
    source: 'ifct', source_id: 'ifct-rajma-cooked', name: 'Rajma (Kidney Beans)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 144, protein_g_per_100g: 8.7, carbs_g_per_100g: 25.1, fat_g_per_100g: 0.8, fiber_g_per_100g: 6.4,
  },
  {
    source: 'ifct', source_id: 'ifct-chole-cooked', name: 'Chole / Chana Masala',
    brand: null, serving_size_g: 200, serving_description: '1 katori (200g)',
    kcal_per_100g: 164, protein_g_per_100g: 8.9, carbs_g_per_100g: 27.4, fat_g_per_100g: 2.6, fiber_g_per_100g: 7.6,
  },
  {
    source: 'ifct', source_id: 'ifct-lobiya-cooked', name: 'Lobiya / Chawli (Black-eyed peas)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 130, protein_g_per_100g: 8.0, carbs_g_per_100g: 22.1, fat_g_per_100g: 0.7, fiber_g_per_100g: 5.2,
  },
  {
    source: 'ifct', source_id: 'ifct-moong-sprouts', name: 'Moong Sprouts',
    brand: null, serving_size_g: 100, serving_description: '1 katori (100g)',
    kcal_per_100g: 30, protein_g_per_100g: 3.0, carbs_g_per_100g: 4.1, fat_g_per_100g: 0.2, fiber_g_per_100g: 1.8,
  },
  {
    source: 'ifct', source_id: 'ifct-besan', name: 'Besan (Gram Flour)',
    brand: null, serving_size_g: 30, serving_description: '2 tbsp (30g)',
    kcal_per_100g: 353, protein_g_per_100g: 22.5, carbs_g_per_100g: 57.8, fat_g_per_100g: 5.6, fiber_g_per_100g: 3.9,
  },
  {
    source: 'ifct', source_id: 'ifct-moth-beans', name: 'Matki / Moth Beans (Sprouted)',
    brand: null, serving_size_g: 100, serving_description: '1 katori (100g)',
    kcal_per_100g: 46, protein_g_per_100g: 4.5, carbs_g_per_100g: 6.1, fat_g_per_100g: 0.3, fiber_g_per_100g: 2.2,
  },

  // ─── VEGETABLES (SABZI) ──────────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-aloo-sabzi', name: 'Aloo Sabzi (Potato Curry)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 90, protein_g_per_100g: 1.9, carbs_g_per_100g: 15.8, fat_g_per_100g: 2.5, fiber_g_per_100g: 1.2,
  },
  {
    source: 'ifct', source_id: 'ifct-aloo-raw', name: 'Potato (Aloo)',
    brand: null, serving_size_g: 100, serving_description: '1 medium (100g)',
    kcal_per_100g: 97, protein_g_per_100g: 1.6, carbs_g_per_100g: 22.6, fat_g_per_100g: 0.1, fiber_g_per_100g: 1.6,
  },
  {
    source: 'ifct', source_id: 'ifct-palak-sabzi', name: 'Palak Sabzi (Spinach)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 55, protein_g_per_100g: 3.5, carbs_g_per_100g: 6.8, fat_g_per_100g: 1.8, fiber_g_per_100g: 2.2,
  },
  {
    source: 'ifct', source_id: 'ifct-palak-paneer', name: 'Palak Paneer',
    brand: null, serving_size_g: 200, serving_description: '1 katori (200g)',
    kcal_per_100g: 126, protein_g_per_100g: 7.0, carbs_g_per_100g: 7.4, fat_g_per_100g: 8.5, fiber_g_per_100g: 1.8,
  },
  {
    source: 'ifct', source_id: 'ifct-bhindi-sabzi', name: 'Bhindi Masala (Okra)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 70, protein_g_per_100g: 2.1, carbs_g_per_100g: 8.5, fat_g_per_100g: 3.2, fiber_g_per_100g: 2.8,
  },
  {
    source: 'ifct', source_id: 'ifct-baingan-sabzi', name: 'Baingan Bharta (Brinjal)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 72, protein_g_per_100g: 1.8, carbs_g_per_100g: 8.2, fat_g_per_100g: 3.8, fiber_g_per_100g: 2.1,
  },
  {
    source: 'ifct', source_id: 'ifct-gobi-sabzi', name: 'Gobi Sabzi (Cauliflower)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 62, protein_g_per_100g: 2.1, carbs_g_per_100g: 7.1, fat_g_per_100g: 2.8, fiber_g_per_100g: 2.0,
  },
  {
    source: 'ifct', source_id: 'ifct-aloo-gobi', name: 'Aloo Gobi',
    brand: null, serving_size_g: 200, serving_description: '1 katori (200g)',
    kcal_per_100g: 80, protein_g_per_100g: 2.0, carbs_g_per_100g: 11.8, fat_g_per_100g: 3.0, fiber_g_per_100g: 1.9,
  },
  {
    source: 'ifct', source_id: 'ifct-matar-sabzi', name: 'Matar Paneer (Peas & Paneer)',
    brand: null, serving_size_g: 200, serving_description: '1 katori (200g)',
    kcal_per_100g: 140, protein_g_per_100g: 7.2, carbs_g_per_100g: 10.8, fat_g_per_100g: 8.2, fiber_g_per_100g: 2.5,
  },
  {
    source: 'ifct', source_id: 'ifct-karela-sabzi', name: 'Karela Sabzi (Bitter Gourd)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 65, protein_g_per_100g: 1.8, carbs_g_per_100g: 7.5, fat_g_per_100g: 3.2, fiber_g_per_100g: 2.9,
  },
  {
    source: 'ifct', source_id: 'ifct-lauki-sabzi', name: 'Lauki Sabzi (Bottle Gourd)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 50, protein_g_per_100g: 1.2, carbs_g_per_100g: 7.8, fat_g_per_100g: 1.5, fiber_g_per_100g: 1.5,
  },
  {
    source: 'ifct', source_id: 'ifct-tinda-sabzi', name: 'Tinda Sabzi (Apple Gourd)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 48, protein_g_per_100g: 1.4, carbs_g_per_100g: 7.5, fat_g_per_100g: 1.3, fiber_g_per_100g: 1.8,
  },
  {
    source: 'ifct', source_id: 'ifct-sarson-saag', name: 'Sarson ka Saag',
    brand: null, serving_size_g: 200, serving_description: '1 katori (200g)',
    kcal_per_100g: 88, protein_g_per_100g: 3.8, carbs_g_per_100g: 8.2, fat_g_per_100g: 4.5, fiber_g_per_100g: 3.5,
  },
  {
    source: 'ifct', source_id: 'ifct-methi-sabzi', name: 'Methi Sabzi (Fenugreek)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 68, protein_g_per_100g: 3.2, carbs_g_per_100g: 8.1, fat_g_per_100g: 2.5, fiber_g_per_100g: 3.8,
  },
  {
    source: 'ifct', source_id: 'ifct-shimla-mirch-sabzi', name: 'Shimla Mirch Sabzi (Capsicum)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 62, protein_g_per_100g: 1.5, carbs_g_per_100g: 7.8, fat_g_per_100g: 3.0, fiber_g_per_100g: 1.8,
  },
  {
    source: 'ifct', source_id: 'ifct-mix-veg', name: 'Mix Veg Sabzi',
    brand: null, serving_size_g: 200, serving_description: '1 katori (200g)',
    kcal_per_100g: 72, protein_g_per_100g: 2.2, carbs_g_per_100g: 9.5, fat_g_per_100g: 3.0, fiber_g_per_100g: 2.2,
  },

  // ─── PANEER DISHES ───────────────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-paneer-raw', name: 'Paneer (Cottage Cheese)',
    brand: null, serving_size_g: 50, serving_description: '1 piece / 2 cubes (50g)',
    kcal_per_100g: 265, protein_g_per_100g: 18.3, carbs_g_per_100g: 2.6, fat_g_per_100g: 20.8, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-paneer-butter-masala', name: 'Paneer Butter Masala',
    brand: null, serving_size_g: 200, serving_description: '1 katori (200g)',
    kcal_per_100g: 148, protein_g_per_100g: 7.2, carbs_g_per_100g: 8.4, fat_g_per_100g: 10.2, fiber_g_per_100g: 1.5,
  },
  {
    source: 'ifct', source_id: 'ifct-shahi-paneer', name: 'Shahi Paneer',
    brand: null, serving_size_g: 200, serving_description: '1 katori (200g)',
    kcal_per_100g: 168, protein_g_per_100g: 7.8, carbs_g_per_100g: 7.9, fat_g_per_100g: 12.1, fiber_g_per_100g: 0.8,
  },
  {
    source: 'ifct', source_id: 'ifct-kadai-paneer', name: 'Kadai Paneer',
    brand: null, serving_size_g: 200, serving_description: '1 katori (200g)',
    kcal_per_100g: 145, protein_g_per_100g: 7.5, carbs_g_per_100g: 8.2, fat_g_per_100g: 9.8, fiber_g_per_100g: 1.9,
  },
  {
    source: 'ifct', source_id: 'ifct-paneer-tikka', name: 'Paneer Tikka',
    brand: null, serving_size_g: 150, serving_description: '4 pieces (150g)',
    kcal_per_100g: 211, protein_g_per_100g: 13.5, carbs_g_per_100g: 8.2, fat_g_per_100g: 14.2, fiber_g_per_100g: 1.1,
  },

  // ─── CHICKEN & EGG ───────────────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-chicken-curry', name: 'Chicken Curry',
    brand: null, serving_size_g: 200, serving_description: '1 katori (200g)',
    kcal_per_100g: 148, protein_g_per_100g: 16.2, carbs_g_per_100g: 4.8, fat_g_per_100g: 7.5, fiber_g_per_100g: 0.5,
  },
  {
    source: 'ifct', source_id: 'ifct-butter-chicken', name: 'Butter Chicken (Murgh Makhani)',
    brand: null, serving_size_g: 200, serving_description: '1 katori (200g)',
    kcal_per_100g: 150, protein_g_per_100g: 14.8, carbs_g_per_100g: 6.5, fat_g_per_100g: 8.4, fiber_g_per_100g: 0.8,
  },
  {
    source: 'ifct', source_id: 'ifct-chicken-tikka-masala', name: 'Chicken Tikka Masala',
    brand: null, serving_size_g: 200, serving_description: '1 katori (200g)',
    kcal_per_100g: 155, protein_g_per_100g: 15.5, carbs_g_per_100g: 7.2, fat_g_per_100g: 7.8, fiber_g_per_100g: 1.0,
  },
  {
    source: 'ifct', source_id: 'ifct-chicken-boiled', name: 'Boiled Chicken',
    brand: null, serving_size_g: 100, serving_description: '100g',
    kcal_per_100g: 189, protein_g_per_100g: 28.2, carbs_g_per_100g: 0, fat_g_per_100g: 7.9, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-chicken-tandoori', name: 'Tandoori Chicken',
    brand: null, serving_size_g: 150, serving_description: '1 piece (150g)',
    kcal_per_100g: 165, protein_g_per_100g: 25.8, carbs_g_per_100g: 2.5, fat_g_per_100g: 6.2, fiber_g_per_100g: 0.3,
  },
  {
    // Corrected 2026-09-01 (see supabase/migrations/043 for the retroactive
    // fix and full provenance). The row had shipped with fat copied from
    // protein (13.3 both) and kcal derived from that wrong fat via Atwater —
    // self-consistent, so no consistency check could have caught it; only
    // checking the source did. Real IFCT 2017 (nodef/ifct2017, code M004,
    // "Egg, poultry, whole, boiled"): 618 kJ ≈ 148 kcal, protein 13.43 g
    // (kept: this one was already right), fat 10.54 g.
    source: 'ifct', source_id: 'ifct-egg-boiled', name: 'Boiled Egg (Anda)',
    brand: null, serving_size_g: 55, serving_description: '1 whole egg (55g)',
    kcal_per_100g: 148, protein_g_per_100g: 13.4, carbs_g_per_100g: 0, fat_g_per_100g: 10.5, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-egg-omelette', name: 'Omelette (2 Eggs)',
    brand: null, serving_size_g: 120, serving_description: '2-egg omelette (120g)',
    kcal_per_100g: 185, protein_g_per_100g: 12.5, carbs_g_per_100g: 1.2, fat_g_per_100g: 14.8, fiber_g_per_100g: 0.2,
  },
  {
    source: 'ifct', source_id: 'ifct-egg-bhurji', name: 'Egg Bhurji (Scrambled)',
    brand: null, serving_size_g: 150, serving_description: '1 plate (150g)',
    kcal_per_100g: 178, protein_g_per_100g: 11.8, carbs_g_per_100g: 3.5, fat_g_per_100g: 13.2, fiber_g_per_100g: 0.5,
  },

  // ─── MUTTON & FISH ───────────────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-mutton-curry', name: 'Mutton Curry (Gosht)',
    brand: null, serving_size_g: 200, serving_description: '1 katori (200g)',
    kcal_per_100g: 196, protein_g_per_100g: 18.2, carbs_g_per_100g: 3.8, fat_g_per_100g: 12.5, fiber_g_per_100g: 0.3,
  },
  {
    source: 'ifct', source_id: 'ifct-fish-curry', name: 'Fish Curry (Machli)',
    brand: null, serving_size_g: 200, serving_description: '1 katori (200g)',
    kcal_per_100g: 115, protein_g_per_100g: 14.8, carbs_g_per_100g: 4.2, fat_g_per_100g: 4.5, fiber_g_per_100g: 0.5,
  },
  {
    source: 'ifct', source_id: 'ifct-rohu-fish', name: 'Rohu Fish (Cooked)',
    brand: null, serving_size_g: 100, serving_description: '1 piece (100g)',
    kcal_per_100g: 97, protein_g_per_100g: 16.7, carbs_g_per_100g: 0, fat_g_per_100g: 3.4, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-prawn', name: 'Prawn / Shrimp Curry (Jhinga)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 112, protein_g_per_100g: 16.5, carbs_g_per_100g: 3.2, fat_g_per_100g: 3.8, fiber_g_per_100g: 0.2,
  },

  // ─── DAIRY ───────────────────────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-milk-full-fat', name: 'Full Fat Milk (Cow)',
    brand: null, serving_size_g: 250, serving_description: '1 glass (250ml)',
    kcal_per_100g: 67, protein_g_per_100g: 3.2, carbs_g_per_100g: 4.4, fat_g_per_100g: 4.1, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-milk-toned', name: 'Toned Milk',
    brand: null, serving_size_g: 250, serving_description: '1 glass (250ml)',
    kcal_per_100g: 58, protein_g_per_100g: 3.1, carbs_g_per_100g: 4.5, fat_g_per_100g: 3.0, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-dahi', name: 'Dahi / Curd (Full Fat)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 60, protein_g_per_100g: 3.1, carbs_g_per_100g: 3.0, fat_g_per_100g: 4.0, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-dahi-low-fat', name: 'Low Fat Curd / Dahi',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 43, protein_g_per_100g: 3.3, carbs_g_per_100g: 4.8, fat_g_per_100g: 1.5, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-ghee', name: 'Ghee (Clarified Butter)',
    brand: null, serving_size_g: 10, serving_description: '1 tsp (10g)',
    kcal_per_100g: 900, protein_g_per_100g: 0, carbs_g_per_100g: 0, fat_g_per_100g: 99.5, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-butter', name: 'Butter (Amul)',
    brand: 'Amul', serving_size_g: 10, serving_description: '1 tsp (10g)',
    kcal_per_100g: 720, protein_g_per_100g: 0.5, carbs_g_per_100g: 0.5, fat_g_per_100g: 80.0, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-lassi-sweet', name: 'Sweet Lassi',
    brand: null, serving_size_g: 300, serving_description: '1 glass (300ml)',
    kcal_per_100g: 82, protein_g_per_100g: 2.8, carbs_g_per_100g: 13.5, fat_g_per_100g: 2.5, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-lassi-salted', name: 'Salted Lassi / Chaas',
    brand: null, serving_size_g: 300, serving_description: '1 glass (300ml)',
    kcal_per_100g: 35, protein_g_per_100g: 2.5, carbs_g_per_100g: 3.8, fat_g_per_100g: 1.0, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-khoa', name: 'Khoa / Mawa',
    brand: null, serving_size_g: 50, serving_description: '50g',
    kcal_per_100g: 421, protein_g_per_100g: 20.2, carbs_g_per_100g: 33.0, fat_g_per_100g: 24.9, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-amul-gold-milk', name: 'Amul Gold Milk',
    brand: 'Amul', serving_size_g: 250, serving_description: '1 glass (250ml)',
    kcal_per_100g: 72, protein_g_per_100g: 3.5, carbs_g_per_100g: 4.9, fat_g_per_100g: 4.5, fiber_g_per_100g: 0,
  },

  // ─── STREET FOOD ─────────────────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-samosa', name: 'Samosa (Aloo)',
    brand: null, serving_size_g: 80, serving_description: '1 samosa (80g)',
    kcal_per_100g: 262, protein_g_per_100g: 5.2, carbs_g_per_100g: 33.8, fat_g_per_100g: 12.1, fiber_g_per_100g: 2.5,
  },
  {
    source: 'ifct', source_id: 'ifct-vada-pav', name: 'Vada Pav',
    brand: null, serving_size_g: 140, serving_description: '1 piece (140g)',
    kcal_per_100g: 253, protein_g_per_100g: 7.2, carbs_g_per_100g: 38.4, fat_g_per_100g: 8.5, fiber_g_per_100g: 2.8,
  },
  {
    source: 'ifct', source_id: 'ifct-pav-bhaji', name: 'Pav Bhaji',
    brand: null, serving_size_g: 350, serving_description: '1 plate (350g, 2 pav + bhaji)',
    kcal_per_100g: 156, protein_g_per_100g: 5.2, carbs_g_per_100g: 26.5, fat_g_per_100g: 4.3, fiber_g_per_100g: 2.8,
  },
  {
    source: 'ifct', source_id: 'ifct-chole-bhature', name: 'Chole Bhature (1 plate)',
    brand: null, serving_size_g: 380, serving_description: '1 plate (380g)',
    kcal_per_100g: 218, protein_g_per_100g: 7.8, carbs_g_per_100g: 34.2, fat_g_per_100g: 6.5, fiber_g_per_100g: 3.5,
  },
  {
    source: 'ifct', source_id: 'ifct-kachori', name: 'Kachori',
    brand: null, serving_size_g: 60, serving_description: '1 kachori (60g)',
    kcal_per_100g: 340, protein_g_per_100g: 7.5, carbs_g_per_100g: 41.2, fat_g_per_100g: 16.5, fiber_g_per_100g: 3.2,
  },
  {
    source: 'ifct', source_id: 'ifct-pani-puri', name: 'Pani Puri / Gol Gappa (6 pcs)',
    brand: null, serving_size_g: 100, serving_description: '6 puris with water (100g)',
    kcal_per_100g: 172, protein_g_per_100g: 3.8, carbs_g_per_100g: 28.5, fat_g_per_100g: 4.8, fiber_g_per_100g: 2.1,
  },
  {
    source: 'ifct', source_id: 'ifct-bhel-puri', name: 'Bhel Puri',
    brand: null, serving_size_g: 150, serving_description: '1 plate (150g)',
    kcal_per_100g: 180, protein_g_per_100g: 4.5, carbs_g_per_100g: 31.2, fat_g_per_100g: 4.8, fiber_g_per_100g: 2.5,
  },
  {
    source: 'ifct', source_id: 'ifct-sev-puri', name: 'Sev Puri',
    brand: null, serving_size_g: 120, serving_description: '1 plate (120g)',
    kcal_per_100g: 195, protein_g_per_100g: 4.8, carbs_g_per_100g: 28.5, fat_g_per_100g: 7.2, fiber_g_per_100g: 2.2,
  },
  {
    source: 'ifct', source_id: 'ifct-dahi-puri', name: 'Dahi Puri',
    brand: null, serving_size_g: 150, serving_description: '1 plate (150g)',
    kcal_per_100g: 160, protein_g_per_100g: 4.2, carbs_g_per_100g: 26.8, fat_g_per_100g: 4.5, fiber_g_per_100g: 1.8,
  },
  {
    source: 'ifct', source_id: 'ifct-aloo-tikki', name: 'Aloo Tikki',
    brand: null, serving_size_g: 75, serving_description: '1 tikki (75g)',
    kcal_per_100g: 185, protein_g_per_100g: 3.5, carbs_g_per_100g: 27.5, fat_g_per_100g: 7.2, fiber_g_per_100g: 2.0,
  },
  {
    source: 'ifct', source_id: 'ifct-dahi-vada', name: 'Dahi Vada / Dahi Bhalla',
    brand: null, serving_size_g: 150, serving_description: '2 vadas with dahi (150g)',
    kcal_per_100g: 145, protein_g_per_100g: 5.8, carbs_g_per_100g: 20.2, fat_g_per_100g: 5.0, fiber_g_per_100g: 1.5,
  },
  {
    source: 'ifct', source_id: 'ifct-momos-veg', name: 'Veg Momos (6 pcs)',
    brand: null, serving_size_g: 120, serving_description: '6 pieces (120g)',
    kcal_per_100g: 140, protein_g_per_100g: 5.2, carbs_g_per_100g: 22.8, fat_g_per_100g: 3.2, fiber_g_per_100g: 1.5,
  },
  {
    source: 'ifct', source_id: 'ifct-momos-chicken', name: 'Chicken Momos (6 pcs)',
    brand: null, serving_size_g: 120, serving_description: '6 pieces (120g)',
    kcal_per_100g: 158, protein_g_per_100g: 9.5, carbs_g_per_100g: 18.5, fat_g_per_100g: 5.2, fiber_g_per_100g: 0.8,
  },
  {
    source: 'ifct', source_id: 'ifct-misal-pav', name: 'Misal Pav',
    brand: null, serving_size_g: 300, serving_description: '1 plate (300g)',
    kcal_per_100g: 168, protein_g_per_100g: 7.2, carbs_g_per_100g: 28.5, fat_g_per_100g: 4.2, fiber_g_per_100g: 3.8,
  },
  {
    source: 'ifct', source_id: 'ifct-maggi-noodles', name: 'Maggi Noodles (cooked)',
    brand: 'Maggi', serving_size_g: 95, serving_description: '1 packet cooked (95g dry)',
    kcal_per_100g: 385, protein_g_per_100g: 9.0, carbs_g_per_100g: 58.2, fat_g_per_100g: 13.0, fiber_g_per_100g: 1.5,
  },

  // ─── SWEETS & DESSERTS ───────────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-gulab-jamun', name: 'Gulab Jamun',
    brand: null, serving_size_g: 70, serving_description: '2 pieces (70g)',
    kcal_per_100g: 387, protein_g_per_100g: 5.2, carbs_g_per_100g: 64.5, fat_g_per_100g: 13.0, fiber_g_per_100g: 0.3,
  },
  {
    source: 'ifct', source_id: 'ifct-rasgulla', name: 'Rasgulla',
    brand: null, serving_size_g: 100, serving_description: '2 pieces (100g)',
    kcal_per_100g: 186, protein_g_per_100g: 4.5, carbs_g_per_100g: 40.2, fat_g_per_100g: 1.5, fiber_g_per_100g: 0.1,
  },
  {
    source: 'ifct', source_id: 'ifct-jalebi', name: 'Jalebi',
    brand: null, serving_size_g: 80, serving_description: '2 jalebis (80g)',
    kcal_per_100g: 449, protein_g_per_100g: 1.8, carbs_g_per_100g: 68.5, fat_g_per_100g: 19.2, fiber_g_per_100g: 0.3,
  },
  {
    source: 'ifct', source_id: 'ifct-ladoo-besan', name: 'Besan Ladoo',
    brand: null, serving_size_g: 50, serving_description: '1 ladoo (50g)',
    kcal_per_100g: 472, protein_g_per_100g: 9.2, carbs_g_per_100g: 57.5, fat_g_per_100g: 24.0, fiber_g_per_100g: 2.5,
  },
  {
    source: 'ifct', source_id: 'ifct-ladoo-boondi', name: 'Boondi Ladoo',
    brand: null, serving_size_g: 50, serving_description: '1 ladoo (50g)',
    kcal_per_100g: 425, protein_g_per_100g: 6.5, carbs_g_per_100g: 60.2, fat_g_per_100g: 18.5, fiber_g_per_100g: 1.2,
  },
  {
    source: 'ifct', source_id: 'ifct-barfi-milk', name: 'Milk Barfi (Burfi)',
    brand: null, serving_size_g: 40, serving_description: '1 piece (40g)',
    kcal_per_100g: 418, protein_g_per_100g: 10.5, carbs_g_per_100g: 60.2, fat_g_per_100g: 16.2, fiber_g_per_100g: 0.2,
  },
  {
    source: 'ifct', source_id: 'ifct-kaju-barfi', name: 'Kaju Barfi (Cashew)',
    brand: null, serving_size_g: 40, serving_description: '1 piece (40g)',
    kcal_per_100g: 450, protein_g_per_100g: 9.8, carbs_g_per_100g: 58.5, fat_g_per_100g: 22.5, fiber_g_per_100g: 0.8,
  },
  {
    source: 'ifct', source_id: 'ifct-halwa-suji', name: 'Suji / Sooji Halwa',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 285, protein_g_per_100g: 4.5, carbs_g_per_100g: 42.8, fat_g_per_100g: 11.2, fiber_g_per_100g: 0.8,
  },
  {
    source: 'ifct', source_id: 'ifct-halwa-gajar', name: 'Gajar Halwa (Carrot)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 208, protein_g_per_100g: 4.2, carbs_g_per_100g: 30.5, fat_g_per_100g: 8.8, fiber_g_per_100g: 1.5,
  },
  {
    source: 'ifct', source_id: 'ifct-kheer', name: 'Kheer / Rice Pudding',
    brand: null, serving_size_g: 200, serving_description: '1 katori (200g)',
    kcal_per_100g: 105, protein_g_per_100g: 3.2, carbs_g_per_100g: 16.8, fat_g_per_100g: 3.5, fiber_g_per_100g: 0.2,
  },
  {
    source: 'ifct', source_id: 'ifct-payasam', name: 'Payasam (South Indian)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 145, protein_g_per_100g: 3.8, carbs_g_per_100g: 24.5, fat_g_per_100g: 4.2, fiber_g_per_100g: 0.5,
  },
  {
    source: 'ifct', source_id: 'ifct-rabri', name: 'Rabri',
    brand: null, serving_size_g: 100, serving_description: '1 serving (100g)',
    kcal_per_100g: 186, protein_g_per_100g: 5.8, carbs_g_per_100g: 20.5, fat_g_per_100g: 9.5, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-imarti', name: 'Imarti',
    brand: null, serving_size_g: 70, serving_description: '1 piece (70g)',
    kcal_per_100g: 430, protein_g_per_100g: 3.8, carbs_g_per_100g: 65.0, fat_g_per_100g: 18.5, fiber_g_per_100g: 0.5,
  },

  // ─── BEVERAGES ───────────────────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-chai-milk-sugar', name: 'Masala Chai (with milk & sugar)',
    brand: null, serving_size_g: 150, serving_description: '1 cup (150ml)',
    kcal_per_100g: 48, protein_g_per_100g: 1.8, carbs_g_per_100g: 7.2, fat_g_per_100g: 1.5, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-chai-black', name: 'Black Tea / Kadha Chai',
    brand: null, serving_size_g: 150, serving_description: '1 cup (150ml)',
    kcal_per_100g: 2, protein_g_per_100g: 0, carbs_g_per_100g: 0.4, fat_g_per_100g: 0, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-filter-coffee', name: 'Filter Coffee (South Indian)',
    brand: null, serving_size_g: 150, serving_description: '1 cup (150ml)',
    kcal_per_100g: 52, protein_g_per_100g: 2.0, carbs_g_per_100g: 6.8, fat_g_per_100g: 2.0, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-nimbu-pani', name: 'Nimbu Pani / Shikanji',
    brand: null, serving_size_g: 250, serving_description: '1 glass (250ml)',
    kcal_per_100g: 28, protein_g_per_100g: 0.2, carbs_g_per_100g: 6.8, fat_g_per_100g: 0, fiber_g_per_100g: 0.1,
  },
  {
    source: 'ifct', source_id: 'ifct-aam-panna', name: 'Aam Panna (Raw Mango)',
    brand: null, serving_size_g: 250, serving_description: '1 glass (250ml)',
    kcal_per_100g: 60, protein_g_per_100g: 0.5, carbs_g_per_100g: 14.8, fat_g_per_100g: 0.1, fiber_g_per_100g: 0.5,
  },
  {
    source: 'ifct', source_id: 'ifct-coconut-water', name: 'Coconut Water (Nariyal Pani)',
    brand: null, serving_size_g: 250, serving_description: '1 glass (250ml)',
    kcal_per_100g: 19, protein_g_per_100g: 0.7, carbs_g_per_100g: 3.7, fat_g_per_100g: 0.2, fiber_g_per_100g: 1.1,
  },
  {
    source: 'ifct', source_id: 'ifct-thandai', name: 'Thandai',
    brand: null, serving_size_g: 250, serving_description: '1 glass (250ml)',
    kcal_per_100g: 115, protein_g_per_100g: 3.8, carbs_g_per_100g: 14.5, fat_g_per_100g: 5.2, fiber_g_per_100g: 0.5,
  },
  {
    source: 'ifct', source_id: 'ifct-sugarcane-juice', name: 'Sugarcane Juice (Ganne ka Ras)',
    brand: null, serving_size_g: 250, serving_description: '1 glass (250ml)',
    kcal_per_100g: 55, protein_g_per_100g: 0.2, carbs_g_per_100g: 13.8, fat_g_per_100g: 0.1, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-mango-lassi', name: 'Mango Lassi',
    brand: null, serving_size_g: 300, serving_description: '1 glass (300ml)',
    kcal_per_100g: 92, protein_g_per_100g: 2.5, carbs_g_per_100g: 16.8, fat_g_per_100g: 2.2, fiber_g_per_100g: 0.5,
  },

  // ─── FRUITS ──────────────────────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-mango', name: 'Mango (Aam) - Alphonso',
    brand: null, serving_size_g: 200, serving_description: '1 medium mango (200g)',
    kcal_per_100g: 74, protein_g_per_100g: 0.5, carbs_g_per_100g: 17.0, fat_g_per_100g: 0.3, fiber_g_per_100g: 1.8,
  },
  {
    source: 'ifct', source_id: 'ifct-banana', name: 'Banana (Kela)',
    brand: null, serving_size_g: 120, serving_description: '1 medium banana (120g)',
    kcal_per_100g: 89, protein_g_per_100g: 1.1, carbs_g_per_100g: 22.8, fat_g_per_100g: 0.3, fiber_g_per_100g: 2.6,
  },
  {
    source: 'ifct', source_id: 'ifct-guava', name: 'Guava (Amrood)',
    brand: null, serving_size_g: 100, serving_description: '1 medium guava (100g)',
    kcal_per_100g: 68, protein_g_per_100g: 2.5, carbs_g_per_100g: 14.3, fat_g_per_100g: 0.9, fiber_g_per_100g: 5.4,
  },
  {
    source: 'ifct', source_id: 'ifct-papaya', name: 'Papaya (Papita)',
    brand: null, serving_size_g: 200, serving_description: '1 cup chunks (200g)',
    kcal_per_100g: 43, protein_g_per_100g: 0.5, carbs_g_per_100g: 10.8, fat_g_per_100g: 0.1, fiber_g_per_100g: 1.7,
  },
  {
    source: 'ifct', source_id: 'ifct-watermelon', name: 'Watermelon (Tarbooz)',
    brand: null, serving_size_g: 300, serving_description: '2 slices (300g)',
    kcal_per_100g: 30, protein_g_per_100g: 0.6, carbs_g_per_100g: 7.6, fat_g_per_100g: 0.2, fiber_g_per_100g: 0.4,
  },
  {
    source: 'ifct', source_id: 'ifct-pomegranate', name: 'Pomegranate (Anar)',
    brand: null, serving_size_g: 100, serving_description: '½ pomegranate (100g)',
    kcal_per_100g: 83, protein_g_per_100g: 1.7, carbs_g_per_100g: 18.7, fat_g_per_100g: 1.2, fiber_g_per_100g: 4.0,
  },
  {
    source: 'ifct', source_id: 'ifct-chickoo', name: 'Chickoo / Sapota',
    brand: null, serving_size_g: 100, serving_description: '1 chickoo (100g)',
    kcal_per_100g: 83, protein_g_per_100g: 0.4, carbs_g_per_100g: 20.0, fat_g_per_100g: 1.1, fiber_g_per_100g: 5.3,
  },
  {
    source: 'ifct', source_id: 'ifct-jamun', name: 'Jamun (Indian Blackberry)',
    brand: null, serving_size_g: 100, serving_description: '1 cup (100g)',
    kcal_per_100g: 60, protein_g_per_100g: 0.7, carbs_g_per_100g: 14.0, fat_g_per_100g: 0.2, fiber_g_per_100g: 0.6,
  },
  {
    source: 'ifct', source_id: 'ifct-litchi', name: 'Litchi (Lychee)',
    brand: null, serving_size_g: 100, serving_description: '8-10 litchis (100g)',
    kcal_per_100g: 66, protein_g_per_100g: 0.8, carbs_g_per_100g: 16.5, fat_g_per_100g: 0.4, fiber_g_per_100g: 1.3,
  },
  {
    source: 'ifct', source_id: 'ifct-coconut-fresh', name: 'Fresh Coconut (Nariyal)',
    brand: null, serving_size_g: 50, serving_description: '¼ cup grated (50g)',
    kcal_per_100g: 354, protein_g_per_100g: 3.3, carbs_g_per_100g: 15.2, fat_g_per_100g: 33.5, fiber_g_per_100g: 9.0,
  },
  {
    source: 'ifct', source_id: 'ifct-amla', name: 'Amla (Indian Gooseberry)',
    brand: null, serving_size_g: 50, serving_description: '2 amlas (50g)',
    kcal_per_100g: 58, protein_g_per_100g: 0.5, carbs_g_per_100g: 13.7, fat_g_per_100g: 0.1, fiber_g_per_100g: 3.4,
  },

  // ─── NUTS & SEEDS ────────────────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-peanuts-roasted', name: 'Roasted Peanuts (Moongfali)',
    brand: null, serving_size_g: 30, serving_description: '1 small handful (30g)',
    kcal_per_100g: 585, protein_g_per_100g: 25.3, carbs_g_per_100g: 21.1, fat_g_per_100g: 46.6, fiber_g_per_100g: 8.5,
  },
  {
    source: 'ifct', source_id: 'ifct-cashew', name: 'Cashew (Kaju)',
    brand: null, serving_size_g: 30, serving_description: '1 small handful (30g)',
    kcal_per_100g: 553, protein_g_per_100g: 17.2, carbs_g_per_100g: 32.7, fat_g_per_100g: 43.4, fiber_g_per_100g: 3.3,
  },
  {
    source: 'ifct', source_id: 'ifct-almonds', name: 'Almonds (Badam)',
    brand: null, serving_size_g: 28, serving_description: '10-12 almonds (28g)',
    kcal_per_100g: 578, protein_g_per_100g: 21.0, carbs_g_per_100g: 19.7, fat_g_per_100g: 49.4, fiber_g_per_100g: 12.5,
  },
  {
    source: 'ifct', source_id: 'ifct-walnuts', name: 'Walnuts (Akhrot)',
    brand: null, serving_size_g: 28, serving_description: '4 halves (28g)',
    kcal_per_100g: 654, protein_g_per_100g: 15.2, carbs_g_per_100g: 13.7, fat_g_per_100g: 63.8, fiber_g_per_100g: 6.7,
  },
  {
    source: 'ifct', source_id: 'ifct-flaxseeds', name: 'Flaxseeds (Alsi)',
    brand: null, serving_size_g: 15, serving_description: '1 tbsp (15g)',
    kcal_per_100g: 534, protein_g_per_100g: 18.3, carbs_g_per_100g: 28.9, fat_g_per_100g: 42.2, fiber_g_per_100g: 27.3,
  },
  {
    source: 'ifct', source_id: 'ifct-til-sesame', name: 'Sesame Seeds (Til)',
    brand: null, serving_size_g: 15, serving_description: '1 tbsp (15g)',
    kcal_per_100g: 573, protein_g_per_100g: 17.7, carbs_g_per_100g: 23.4, fat_g_per_100g: 49.7, fiber_g_per_100g: 11.8,
  },
  {
    source: 'ifct', source_id: 'ifct-chikki-peanut', name: 'Peanut Chikki',
    brand: null, serving_size_g: 40, serving_description: '1 piece (40g)',
    kcal_per_100g: 438, protein_g_per_100g: 11.5, carbs_g_per_100g: 55.2, fat_g_per_100g: 21.0, fiber_g_per_100g: 3.5,
  },

  // ─── OILS & CONDIMENTS ───────────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-mustard-oil', name: 'Mustard Oil (Sarson ka Tel)',
    brand: null, serving_size_g: 10, serving_description: '1 tsp (10g)',
    kcal_per_100g: 884, protein_g_per_100g: 0, carbs_g_per_100g: 0, fat_g_per_100g: 100, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-coconut-oil', name: 'Coconut Oil',
    brand: null, serving_size_g: 10, serving_description: '1 tsp (10g)',
    kcal_per_100g: 862, protein_g_per_100g: 0, carbs_g_per_100g: 0, fat_g_per_100g: 95.4, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-sugar', name: 'Sugar (Chini)',
    brand: null, serving_size_g: 10, serving_description: '1 tsp (10g)',
    kcal_per_100g: 387, protein_g_per_100g: 0, carbs_g_per_100g: 99.9, fat_g_per_100g: 0, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-jaggery', name: 'Jaggery / Gur',
    brand: null, serving_size_g: 20, serving_description: '1 small piece (20g)',
    kcal_per_100g: 383, protein_g_per_100g: 0.4, carbs_g_per_100g: 95.0, fat_g_per_100g: 0.1, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-honey', name: 'Honey (Shahad)',
    brand: null, serving_size_g: 15, serving_description: '1 tbsp (15g)',
    kcal_per_100g: 304, protein_g_per_100g: 0.3, carbs_g_per_100g: 82.4, fat_g_per_100g: 0, fiber_g_per_100g: 0.2,
  },
  {
    source: 'ifct', source_id: 'ifct-tamarind-chutney', name: 'Imli / Tamarind Chutney',
    brand: null, serving_size_g: 20, serving_description: '1 tbsp (20g)',
    kcal_per_100g: 98, protein_g_per_100g: 0.8, carbs_g_per_100g: 23.5, fat_g_per_100g: 0.2, fiber_g_per_100g: 1.5,
  },
  {
    source: 'ifct', source_id: 'ifct-green-chutney', name: 'Green Chutney (Pudina-Dhania)',
    brand: null, serving_size_g: 20, serving_description: '1 tbsp (20g)',
    kcal_per_100g: 40, protein_g_per_100g: 1.8, carbs_g_per_100g: 6.0, fat_g_per_100g: 0.8, fiber_g_per_100g: 2.5,
  },

  // ─── PACKAGED & BRANDED ──────────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-haldirams-bhujia', name: 'Haldiram\'s Bhujia Sev',
    brand: 'Haldiram\'s', serving_size_g: 30, serving_description: '1 small pack (30g)',
    kcal_per_100g: 524, protein_g_per_100g: 14.2, carbs_g_per_100g: 46.5, fat_g_per_100g: 31.5, fiber_g_per_100g: 4.2,
  },
  {
    source: 'ifct', source_id: 'ifct-haldirams-mixnuts', name: 'Haldiram\'s Aloo Bhujia',
    brand: 'Haldiram\'s', serving_size_g: 30, serving_description: '1 small pack (30g)',
    kcal_per_100g: 520, protein_g_per_100g: 8.5, carbs_g_per_100g: 55.2, fat_g_per_100g: 30.0, fiber_g_per_100g: 3.5,
  },
  {
    source: 'ifct', source_id: 'ifct-parle-g', name: 'Parle-G Biscuits',
    brand: 'Parle', serving_size_g: 25, serving_description: '4 biscuits (25g)',
    kcal_per_100g: 450, protein_g_per_100g: 6.7, carbs_g_per_100g: 76.8, fat_g_per_100g: 14.2, fiber_g_per_100g: 0.5,
  },
  {
    source: 'ifct', source_id: 'ifct-britannia-50-50', name: 'Britannia 50-50 Biscuits',
    brand: 'Britannia', serving_size_g: 25, serving_description: '4 biscuits (25g)',
    kcal_per_100g: 458, protein_g_per_100g: 8.2, carbs_g_per_100g: 68.5, fat_g_per_100g: 16.8, fiber_g_per_100g: 1.2,
  },
  {
    source: 'ifct', source_id: 'ifct-amul-cheese-slice', name: 'Amul Cheese Slice',
    brand: 'Amul', serving_size_g: 25, serving_description: '1 slice (25g)',
    kcal_per_100g: 330, protein_g_per_100g: 20.0, carbs_g_per_100g: 2.4, fat_g_per_100g: 26.8, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-amul-ice-cream', name: 'Amul Vanilla Ice Cream',
    brand: 'Amul', serving_size_g: 100, serving_description: '1 scoop (100g)',
    kcal_per_100g: 206, protein_g_per_100g: 3.9, carbs_g_per_100g: 22.8, fat_g_per_100g: 11.8, fiber_g_per_100g: 0,
  },
  {
    source: 'ifct', source_id: 'ifct-mtr-dal-mix', name: 'MTR Dal Mix (cooked)',
    brand: 'MTR', serving_size_g: 200, serving_description: '1 katori cooked (200g)',
    kcal_per_100g: 89, protein_g_per_100g: 5.2, carbs_g_per_100g: 13.8, fat_g_per_100g: 2.0, fiber_g_per_100g: 2.5,
  },
  {
    source: 'ifct', source_id: 'ifct-poha-raw', name: 'Poha / Flattened Rice (raw)',
    brand: null, serving_size_g: 50, serving_description: '½ cup raw (50g)',
    kcal_per_100g: 333, protein_g_per_100g: 6.4, carbs_g_per_100g: 76.9, fat_g_per_100g: 0.5, fiber_g_per_100g: 1.2,
  },
  {
    source: 'ifct', source_id: 'ifct-chana-roasted', name: 'Roasted Chana (Bhuna Chana)',
    brand: null, serving_size_g: 30, serving_description: '1 small handful (30g)',
    kcal_per_100g: 364, protein_g_per_100g: 22.5, carbs_g_per_100g: 56.2, fat_g_per_100g: 5.2, fiber_g_per_100g: 8.5,
  },
  {
    source: 'ifct', source_id: 'ifct-murmura', name: 'Murmura / Puffed Rice',
    brand: null, serving_size_g: 30, serving_description: '1 cup (30g)',
    kcal_per_100g: 325, protein_g_per_100g: 6.3, carbs_g_per_100g: 73.5, fat_g_per_100g: 0.5, fiber_g_per_100g: 0.8,
  },

  // ─── FESTIVE & SPECIAL ───────────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-pongal', name: 'Ven Pongal (South Indian)',
    brand: null, serving_size_g: 200, serving_description: '1 katori (200g)',
    kcal_per_100g: 138, protein_g_per_100g: 4.5, carbs_g_per_100g: 22.8, fat_g_per_100g: 4.2, fiber_g_per_100g: 1.0,
  },
  {
    source: 'ifct', source_id: 'ifct-peda', name: 'Peda',
    brand: null, serving_size_g: 40, serving_description: '1 piece (40g)',
    kcal_per_100g: 398, protein_g_per_100g: 8.5, carbs_g_per_100g: 65.2, fat_g_per_100g: 13.2, fiber_g_per_100g: 0.2,
  },
  {
    source: 'ifct', source_id: 'ifct-modak', name: 'Modak (Ukadiche)',
    brand: null, serving_size_g: 50, serving_description: '1 modak (50g)',
    kcal_per_100g: 228, protein_g_per_100g: 3.8, carbs_g_per_100g: 42.5, fat_g_per_100g: 5.8, fiber_g_per_100g: 2.5,
  },
  {
    source: 'ifct', source_id: 'ifct-shakarpara', name: 'Shakarpara',
    brand: null, serving_size_g: 50, serving_description: '1 handful (50g)',
    kcal_per_100g: 445, protein_g_per_100g: 6.5, carbs_g_per_100g: 65.8, fat_g_per_100g: 18.0, fiber_g_per_100g: 1.2,
  },
  {
    source: 'ifct', source_id: 'ifct-mathri', name: 'Mathri',
    brand: null, serving_size_g: 40, serving_description: '2 pieces (40g)',
    kcal_per_100g: 452, protein_g_per_100g: 8.2, carbs_g_per_100g: 60.5, fat_g_per_100g: 21.0, fiber_g_per_100g: 2.5,
  },
  {
    source: 'ifct', source_id: 'ifct-namak-para', name: 'Namak Para',
    brand: null, serving_size_g: 30, serving_description: '1 handful (30g)',
    kcal_per_100g: 462, protein_g_per_100g: 8.5, carbs_g_per_100g: 58.2, fat_g_per_100g: 22.5, fiber_g_per_100g: 2.2,
  },

  // ─── RAW VEGETABLES ───────────────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-tomato', name: 'Tomato (Tamatar)',
    brand: null, serving_size_g: 120, serving_description: '1 medium tomato (120g)',
    kcal_per_100g: 20, protein_g_per_100g: 0.9, carbs_g_per_100g: 3.9, fat_g_per_100g: 0.2, fiber_g_per_100g: 1.2,
  },
  {
    source: 'ifct', source_id: 'ifct-onion', name: 'Onion (Pyaaz)',
    brand: null, serving_size_g: 100, serving_description: '1 medium onion (100g)',
    kcal_per_100g: 40, protein_g_per_100g: 1.1, carbs_g_per_100g: 8.6, fat_g_per_100g: 0.1, fiber_g_per_100g: 1.7,
  },
  {
    source: 'ifct', source_id: 'ifct-garlic', name: 'Garlic (Lahsun)',
    brand: null, serving_size_g: 10, serving_description: '3-4 cloves (10g)',
    kcal_per_100g: 149, protein_g_per_100g: 6.4, carbs_g_per_100g: 33.1, fat_g_per_100g: 0.5, fiber_g_per_100g: 2.1,
  },
  {
    source: 'ifct', source_id: 'ifct-ginger', name: 'Ginger (Adrak)',
    brand: null, serving_size_g: 10, serving_description: '1 inch piece (10g)',
    kcal_per_100g: 80, protein_g_per_100g: 1.8, carbs_g_per_100g: 17.8, fat_g_per_100g: 0.8, fiber_g_per_100g: 2.0,
  },
  {
    source: 'ifct', source_id: 'ifct-carrot', name: 'Carrot (Gajar)',
    brand: null, serving_size_g: 80, serving_description: '1 medium carrot (80g)',
    kcal_per_100g: 48, protein_g_per_100g: 0.9, carbs_g_per_100g: 10.6, fat_g_per_100g: 0.2, fiber_g_per_100g: 2.8,
  },
  {
    source: 'ifct', source_id: 'ifct-cucumber', name: 'Cucumber (Kheera)',
    brand: null, serving_size_g: 150, serving_description: '½ cucumber (150g)',
    kcal_per_100g: 16, protein_g_per_100g: 0.7, carbs_g_per_100g: 2.5, fat_g_per_100g: 0.1, fiber_g_per_100g: 0.7,
  },
  {
    source: 'ifct', source_id: 'ifct-cabbage', name: 'Cabbage (Patta Gobi)',
    brand: null, serving_size_g: 100, serving_description: '1 katori chopped (100g)',
    kcal_per_100g: 25, protein_g_per_100g: 1.3, carbs_g_per_100g: 4.7, fat_g_per_100g: 0.1, fiber_g_per_100g: 2.5,
  },
  {
    source: 'ifct', source_id: 'ifct-beetroot', name: 'Beetroot (Chukandar)',
    brand: null, serving_size_g: 80, serving_description: '½ medium beet (80g)',
    kcal_per_100g: 43, protein_g_per_100g: 1.6, carbs_g_per_100g: 9.6, fat_g_per_100g: 0.1, fiber_g_per_100g: 2.8,
  },
  {
    source: 'ifct', source_id: 'ifct-radish', name: 'Radish (Mooli)',
    brand: null, serving_size_g: 100, serving_description: '1 medium mooli (100g)',
    kcal_per_100g: 17, protein_g_per_100g: 0.7, carbs_g_per_100g: 3.4, fat_g_per_100g: 0.1, fiber_g_per_100g: 1.6,
  },
  {
    source: 'ifct', source_id: 'ifct-sweet-potato', name: 'Sweet Potato (Shakarkand)',
    brand: null, serving_size_g: 130, serving_description: '1 medium (130g)',
    kcal_per_100g: 86, protein_g_per_100g: 1.6, carbs_g_per_100g: 20.1, fat_g_per_100g: 0.1, fiber_g_per_100g: 3.0,
  },
  {
    source: 'ifct', source_id: 'ifct-corn', name: 'Sweet Corn (Makkai)',
    brand: null, serving_size_g: 100, serving_description: '½ cup kernels (100g)',
    kcal_per_100g: 86, protein_g_per_100g: 3.3, carbs_g_per_100g: 19.0, fat_g_per_100g: 1.4, fiber_g_per_100g: 2.4,
  },
  {
    source: 'ifct', source_id: 'ifct-spinach-raw', name: 'Spinach Raw (Palak)',
    brand: null, serving_size_g: 100, serving_description: '1 katori leaves (100g)',
    kcal_per_100g: 23, protein_g_per_100g: 2.9, carbs_g_per_100g: 3.6, fat_g_per_100g: 0.4, fiber_g_per_100g: 2.2,
  },
  {
    source: 'ifct', source_id: 'ifct-drumstick', name: 'Drumstick / Moringa (Sahjan)',
    brand: null, serving_size_g: 100, serving_description: '2-3 pieces (100g)',
    kcal_per_100g: 37, protein_g_per_100g: 2.1, carbs_g_per_100g: 8.5, fat_g_per_100g: 0.2, fiber_g_per_100g: 3.2,
  },

  // ─── FRUITS ───────────────────────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-apple', name: 'Apple (Seb)',
    brand: null, serving_size_g: 150, serving_description: '1 medium apple (150g)',
    kcal_per_100g: 59, protein_g_per_100g: 0.3, carbs_g_per_100g: 14.0, fat_g_per_100g: 0.4, fiber_g_per_100g: 2.4,
  },
  {
    source: 'ifct', source_id: 'ifct-orange', name: 'Orange (Santra / Narangi)',
    brand: null, serving_size_g: 130, serving_description: '1 medium orange (130g)',
    kcal_per_100g: 48, protein_g_per_100g: 0.9, carbs_g_per_100g: 11.2, fat_g_per_100g: 0.1, fiber_g_per_100g: 2.4,
  },
  {
    source: 'ifct', source_id: 'ifct-grapes', name: 'Grapes (Angoor)',
    brand: null, serving_size_g: 100, serving_description: '1 small bunch (100g)',
    kcal_per_100g: 71, protein_g_per_100g: 0.6, carbs_g_per_100g: 17.2, fat_g_per_100g: 0.4, fiber_g_per_100g: 0.9,
  },
  {
    source: 'ifct', source_id: 'ifct-pear', name: 'Pear (Nashpati)',
    brand: null, serving_size_g: 150, serving_description: '1 medium pear (150g)',
    kcal_per_100g: 57, protein_g_per_100g: 0.4, carbs_g_per_100g: 13.9, fat_g_per_100g: 0.1, fiber_g_per_100g: 3.1,
  },
  {
    source: 'ifct', source_id: 'ifct-strawberry', name: 'Strawberry',
    brand: null, serving_size_g: 100, serving_description: '6-8 strawberries (100g)',
    kcal_per_100g: 32, protein_g_per_100g: 0.7, carbs_g_per_100g: 7.7, fat_g_per_100g: 0.3, fiber_g_per_100g: 2.0,
  },

  // ─── GRAINS & CEREALS ─────────────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-oats-rolled', name: 'Rolled Oats (Raw)',
    brand: null, serving_size_g: 40, serving_description: '½ cup dry oats (40g)',
    kcal_per_100g: 380, protein_g_per_100g: 13.2, carbs_g_per_100g: 66.3, fat_g_per_100g: 6.9, fiber_g_per_100g: 10.1,
  },
  {
    source: 'ifct', source_id: 'ifct-oats-cooked', name: 'Cooked Oatmeal / Daliya Oats',
    brand: null, serving_size_g: 240, serving_description: '1 bowl cooked (240g)',
    kcal_per_100g: 71, protein_g_per_100g: 2.5, carbs_g_per_100g: 12.0, fat_g_per_100g: 1.5, fiber_g_per_100g: 1.7,
  },
  {
    source: 'ifct', source_id: 'ifct-daliya', name: 'Daliya / Broken Wheat Porridge (Cooked)',
    brand: null, serving_size_g: 200, serving_description: '1 bowl cooked (200g)',
    kcal_per_100g: 75, protein_g_per_100g: 2.8, carbs_g_per_100g: 15.5, fat_g_per_100g: 0.5, fiber_g_per_100g: 2.2,
  },
  {
    source: 'ifct', source_id: 'ifct-bread-white', name: 'White Bread (Slice)',
    brand: null, serving_size_g: 25, serving_description: '1 slice (25g)',
    kcal_per_100g: 265, protein_g_per_100g: 9.0, carbs_g_per_100g: 50.6, fat_g_per_100g: 3.2, fiber_g_per_100g: 2.7,
  },
  {
    source: 'ifct', source_id: 'ifct-bread-brown', name: 'Brown / Whole Wheat Bread (Slice)',
    brand: null, serving_size_g: 25, serving_description: '1 slice (25g)',
    kcal_per_100g: 243, protein_g_per_100g: 8.5, carbs_g_per_100g: 45.0, fat_g_per_100g: 3.5, fiber_g_per_100g: 6.0,
  },
  {
    source: 'ifct', source_id: 'ifct-cornflakes', name: 'Cornflakes',
    brand: null, serving_size_g: 30, serving_description: '1 bowl (30g)',
    kcal_per_100g: 357, protein_g_per_100g: 7.5, carbs_g_per_100g: 84.0, fat_g_per_100g: 0.5, fiber_g_per_100g: 1.2,
  },
  {
    source: 'ifct', source_id: 'ifct-suji-raw', name: 'Suji / Semolina (Rava) — Raw',
    brand: null, serving_size_g: 30, serving_description: '2 tbsp (30g)',
    kcal_per_100g: 349, protein_g_per_100g: 10.4, carbs_g_per_100g: 73.0, fat_g_per_100g: 0.8, fiber_g_per_100g: 1.5,
  },
  {
    source: 'ifct', source_id: 'ifct-sattu', name: 'Sattu (Roasted Gram Flour)',
    brand: null, serving_size_g: 30, serving_description: '2 tbsp (30g)',
    kcal_per_100g: 406, protein_g_per_100g: 20.6, carbs_g_per_100g: 65.2, fat_g_per_100g: 6.9, fiber_g_per_100g: 4.5,
  },

  // ─── PROTEINS ─────────────────────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-egg-white', name: 'Egg White (Anda Safeda)',
    brand: null, serving_size_g: 33, serving_description: '1 egg white (33g)',
    kcal_per_100g: 52, protein_g_per_100g: 10.9, carbs_g_per_100g: 0.7, fat_g_per_100g: 0.2, fiber_g_per_100g: null,
  },
  {
    source: 'ifct', source_id: 'ifct-chicken-breast-raw', name: 'Chicken Breast (Raw)',
    brand: null, serving_size_g: 150, serving_description: '1 piece raw (150g)',
    kcal_per_100g: 120, protein_g_per_100g: 22.5, carbs_g_per_100g: 0.0, fat_g_per_100g: 2.6, fiber_g_per_100g: null,
  },
  {
    source: 'ifct', source_id: 'ifct-chicken-breast-cooked', name: 'Chicken Breast Cooked (Grilled/Boiled)',
    brand: null, serving_size_g: 120, serving_description: '1 piece cooked (120g)',
    kcal_per_100g: 165, protein_g_per_100g: 31.0, carbs_g_per_100g: 0.0, fat_g_per_100g: 3.6, fiber_g_per_100g: null,
  },
  {
    source: 'ifct', source_id: 'ifct-tuna-canned', name: 'Tuna (Canned in Water)',
    brand: null, serving_size_g: 85, serving_description: '½ can (85g)',
    kcal_per_100g: 116, protein_g_per_100g: 25.5, carbs_g_per_100g: 0.0, fat_g_per_100g: 1.0, fiber_g_per_100g: null,
  },

  // ─── DAIRY & FATS ─────────────────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-milk-skimmed', name: 'Skimmed Milk (Toned Milk)',
    brand: null, serving_size_g: 200, serving_description: '1 glass (200ml)',
    kcal_per_100g: 35, protein_g_per_100g: 3.4, carbs_g_per_100g: 5.0, fat_g_per_100g: 0.1, fiber_g_per_100g: null,
  },
  {
    source: 'ifct', source_id: 'ifct-soya-milk', name: 'Soya Milk (Unsweetened)',
    brand: null, serving_size_g: 200, serving_description: '1 glass (200ml)',
    kcal_per_100g: 43, protein_g_per_100g: 3.5, carbs_g_per_100g: 2.5, fat_g_per_100g: 2.2, fiber_g_per_100g: 0.6,
  },
  {
    source: 'ifct', source_id: 'ifct-sunflower-oil', name: 'Sunflower Oil (Refined)',
    brand: null, serving_size_g: 10, serving_description: '1 tsp (10ml)',
    kcal_per_100g: 900, protein_g_per_100g: 0.0, carbs_g_per_100g: 0.0, fat_g_per_100g: 100.0, fiber_g_per_100g: null,
  },
  {
    source: 'ifct', source_id: 'ifct-groundnut-oil', name: 'Groundnut Oil / Peanut Oil',
    brand: null, serving_size_g: 10, serving_description: '1 tsp (10ml)',
    kcal_per_100g: 900, protein_g_per_100g: 0.0, carbs_g_per_100g: 0.0, fat_g_per_100g: 100.0, fiber_g_per_100g: null,
  },
  {
    source: 'ifct', source_id: 'ifct-peanut-butter', name: 'Peanut Butter',
    brand: null, serving_size_g: 32, serving_description: '2 tbsp (32g)',
    kcal_per_100g: 598, protein_g_per_100g: 25.1, carbs_g_per_100g: 20.0, fat_g_per_100g: 50.4, fiber_g_per_100g: 6.0,
  },

  // ─── PACKAGED HEALTH FOODS ────────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-whey-protein', name: 'Whey Protein Powder (Generic)',
    brand: null, serving_size_g: 30, serving_description: '1 scoop (30g)',
    kcal_per_100g: 380, protein_g_per_100g: 80.0, carbs_g_per_100g: 8.0, fat_g_per_100g: 5.0, fiber_g_per_100g: null,
  },
  {
    source: 'ifct', source_id: 'ifct-pappadum', name: 'Pappadum / Papad (Raw)',
    brand: null, serving_size_g: 10, serving_description: '1 piece raw (10g)',
    kcal_per_100g: 347, protein_g_per_100g: 26.0, carbs_g_per_100g: 59.0, fat_g_per_100g: 1.0, fiber_g_per_100g: 5.8,
  },
  {
    source: 'ifct', source_id: 'ifct-mixed-pickle', name: 'Mixed Pickle / Achar',
    brand: null, serving_size_g: 20, serving_description: '1 tbsp (20g)',
    kcal_per_100g: 110, protein_g_per_100g: 1.5, carbs_g_per_100g: 5.0, fat_g_per_100g: 9.5, fiber_g_per_100g: 2.0,
  },
  {
    source: 'ifct', source_id: 'ifct-horlicks', name: 'Horlicks (Original)',
    brand: 'GSK', serving_size_g: 27, serving_description: '3 tsp / 1 serving (27g)',
    kcal_per_100g: 379, protein_g_per_100g: 12.0, carbs_g_per_100g: 74.0, fat_g_per_100g: 5.0, fiber_g_per_100g: 1.5,
  },
  {
    source: 'ifct', source_id: 'ifct-bournvita', name: 'Bournvita',
    brand: 'Cadbury', serving_size_g: 20, serving_description: '2 tsp (20g)',
    kcal_per_100g: 389, protein_g_per_100g: 7.5, carbs_g_per_100g: 85.0, fat_g_per_100g: 2.5, fiber_g_per_100g: 1.0,
  },

  // ─── ADDITIONAL COMMON DISHES ──────────────────────────────────────────────
  {
    source: 'ifct', source_id: 'ifct-aloo-choka', name: 'Aloo Choka / Chokha (Spiced Mashed Potato)',
    brand: null, serving_size_g: 100, serving_description: '1 bowl (100g)',
    kcal_per_100g: 118, protein_g_per_100g: 2.0, carbs_g_per_100g: 19.0, fat_g_per_100g: 4.0, fiber_g_per_100g: 2.0,
  },
  {
    source: 'ifct', source_id: 'ifct-kadhi-pakora', name: 'Kadhi Pakora',
    brand: null, serving_size_g: 200, serving_description: '1 katori with pakoras (200g)',
    kcal_per_100g: 97, protein_g_per_100g: 3.8, carbs_g_per_100g: 8.8, fat_g_per_100g: 5.4, fiber_g_per_100g: 0.8,
  },
  {
    source: 'ifct', source_id: 'ifct-egg-curry', name: 'Egg Curry (Anda Curry)',
    brand: null, serving_size_g: 150, serving_description: '2 eggs with gravy (150g)',
    kcal_per_100g: 125, protein_g_per_100g: 8.5, carbs_g_per_100g: 5.2, fat_g_per_100g: 8.8, fiber_g_per_100g: 0.5,
  },
  {
    source: 'ifct', source_id: 'ifct-jeera-rice', name: 'Jeera Rice (Cumin Rice)',
    brand: null, serving_size_g: 180, serving_description: '1 katori (180g)',
    kcal_per_100g: 148, protein_g_per_100g: 2.8, carbs_g_per_100g: 29.2, fat_g_per_100g: 3.0, fiber_g_per_100g: 0.4,
  },
  {
    source: 'ifct', source_id: 'ifct-chicken-tikka', name: 'Chicken Tikka (Grilled)',
    brand: null, serving_size_g: 100, serving_description: '4-5 pieces (100g)',
    kcal_per_100g: 172, protein_g_per_100g: 23.0, carbs_g_per_100g: 4.5, fat_g_per_100g: 7.0, fiber_g_per_100g: 0.5,
  },
  {
    source: 'ifct', source_id: 'ifct-seekh-kebab-chicken', name: 'Chicken Seekh Kebab',
    brand: null, serving_size_g: 80, serving_description: '2 kebabs (80g)',
    kcal_per_100g: 192, protein_g_per_100g: 19.0, carbs_g_per_100g: 6.5, fat_g_per_100g: 11.0, fiber_g_per_100g: 0.8,
  },
  {
    source: 'ifct', source_id: 'ifct-dum-aloo', name: 'Dum Aloo (Aloo Dum)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 138, protein_g_per_100g: 2.5, carbs_g_per_100g: 16.0, fat_g_per_100g: 7.5, fiber_g_per_100g: 2.2,
  },
  {
    source: 'ifct', source_id: 'ifct-keema-matar', name: 'Keema Matar (Minced Meat with Peas)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 188, protein_g_per_100g: 18.0, carbs_g_per_100g: 6.0, fat_g_per_100g: 10.5, fiber_g_per_100g: 1.5,
  },
  {
    source: 'ifct', source_id: 'ifct-mixed-veg-curry', name: 'Mixed Vegetable Curry (Sabzi)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 72, protein_g_per_100g: 2.2, carbs_g_per_100g: 8.0, fat_g_per_100g: 3.8, fiber_g_per_100g: 2.2,
  },
  {
    source: 'ifct', source_id: 'ifct-veg-fried-rice', name: 'Veg Fried Rice (Indian Chinese)',
    brand: null, serving_size_g: 200, serving_description: '1 plate (200g)',
    kcal_per_100g: 168, protein_g_per_100g: 3.8, carbs_g_per_100g: 30.0, fat_g_per_100g: 4.2, fiber_g_per_100g: 1.2,
  },
  {
    source: 'ifct', source_id: 'ifct-mutton-seekh-kebab', name: 'Mutton Seekh Kebab',
    brand: null, serving_size_g: 80, serving_description: '2 kebabs (80g)',
    kcal_per_100g: 225, protein_g_per_100g: 18.5, carbs_g_per_100g: 5.0, fat_g_per_100g: 15.0, fiber_g_per_100g: 0.5,
  },
  {
    source: 'ifct', source_id: 'ifct-sambar-rice', name: 'Sambar Rice (Combo)',
    brand: null, serving_size_g: 300, serving_description: '1 plate rice + sambar (300g)',
    kcal_per_100g: 110, protein_g_per_100g: 3.5, carbs_g_per_100g: 22.0, fat_g_per_100g: 1.2, fiber_g_per_100g: 1.0,
  },
  {
    source: 'ifct', source_id: 'ifct-idli-sambar', name: 'Idli Sambar (2 idlis + sambar)',
    brand: null, serving_size_g: 280, serving_description: '2 idlis + 1 bowl sambar (280g)',
    kcal_per_100g: 85, protein_g_per_100g: 3.2, carbs_g_per_100g: 16.0, fat_g_per_100g: 1.0, fiber_g_per_100g: 1.2,
  },
  {
    source: 'ifct', source_id: 'ifct-aloo-matar', name: 'Aloo Matar (Potato & Peas Curry)',
    brand: null, serving_size_g: 150, serving_description: '1 katori (150g)',
    kcal_per_100g: 105, protein_g_per_100g: 3.5, carbs_g_per_100g: 14.5, fat_g_per_100g: 4.0, fiber_g_per_100g: 2.5,
  },
  {
    source: 'ifct', source_id: 'ifct-rajma-chawal', name: 'Rajma Chawal (Kidney Beans & Rice)',
    brand: null, serving_size_g: 350, serving_description: '1 plate (350g)',
    kcal_per_100g: 142, protein_g_per_100g: 6.5, carbs_g_per_100g: 25.5, fat_g_per_100g: 2.2, fiber_g_per_100g: 3.0,
  },
]
