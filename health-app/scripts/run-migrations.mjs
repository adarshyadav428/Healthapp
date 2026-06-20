/**
 * Directly inserts migration 009 + 010 foods via Supabase REST API.
 * Run: node scripts/run-migrations.mjs
 */
import https from 'https'

const SUPABASE_HOST = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').hostname
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_HOST || !SERVICE_KEY) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local before running.')
  process.exit(1)
}

function upsert(foods) {
  const body = JSON.stringify(foods)
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: SUPABASE_HOST,
      path: '/rest/v1/foods',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'Prefer': 'resolution=ignore-duplicates',
        'Content-Length': Buffer.byteLength(body),
      }
    }, res => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => resolve({ status: res.statusCode, body: data.slice(0, 400) }))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

const k = (id, name, brand, sg, sd, cal, p, c, f, fi, portions) => ({
  source: 'ifct', source_id: id, name, brand: brand || null,
  serving_size_g: sg, serving_description: sd,
  kcal_per_100g: cal, protein_g_per_100g: p, carbs_g_per_100g: c,
  fat_g_per_100g: f, fiber_g_per_100g: fi, common_portions: portions,
})
const pl = (sg, label) => ({ unit: 'plate',   grams: sg, label })
const ka = (sg, label) => ({ unit: 'katori',  grams: sg, label })
const pi = (sg, label) => ({ unit: 'piece',   grams: sg, label })
const bo = (sg, label) => ({ unit: 'bowl',    grams: sg, label })
const gl = (sg, label) => ({ unit: 'glass',   grams: sg, label })
const cu = (sg, label) => ({ unit: 'cup',     grams: sg, label })
const ts = (sg, label) => ({ unit: 'tsp',     grams: sg, label })
const tb = (sg, label) => ({ unit: 'tbsp',    grams: sg, label })
const se = (sg, label) => ({ unit: 'serving', grams: sg, label })
const ha = (sg, label) => ({ unit: 'handful', grams: sg, label })
const G  = { unit: 'gram', grams: 100, label: '100g' }
const GM = { unit: 'gram', grams: 100, label: '100ml' }

const foods009 = [
  k('ifct_v2_poha_cooked','Poha (cooked)',null,200,'1 plate (200g)',130,2.5,27,1.5,0.8,[pl(150,'Small plate (150g)'),pl(200,'Medium plate (200g)'),pl(300,'Large plate (300g)'),G]),
  k('ifct_v2_upma','Upma',null,200,'1 plate (200g)',145,3.2,26,3.8,1.2,[pl(150,'Small plate (150g)'),pl(200,'Medium plate (200g)'),pl(300,'Large plate (300g)'),G]),
  k('ifct_v2_aloo_paratha','Aloo paratha',null,120,'1 piece (120g)',249,5.5,38,9,2.5,[pi(120,'1 piece (120g)'),pi(240,'2 pieces (240g)'),G]),
  k('ifct_v2_gobhi_paratha','Gobhi paratha',null,120,'1 piece (120g)',238,6,36,8.5,3,[pi(120,'1 piece (120g)'),pi(240,'2 pieces (240g)'),G]),
  k('ifct_v2_dosa_plain','Dosa (plain)',null,100,'1 piece (100g)',168,3.9,32,3.2,1,[pi(100,'1 piece (100g)'),pi(200,'2 pieces (200g)'),G]),
  k('ifct_v2_uttapam','Uttapam',null,120,'1 piece (120g)',178,4.5,32,4,1.5,[pi(120,'1 piece (120g)'),pi(240,'2 pieces (240g)'),G]),
  k('ifct_v2_medu_vada','Medu vada',null,80,'1 piece (80g)',322,9.5,38,15,2.5,[pi(80,'1 piece (80g)'),pi(160,'2 pieces (160g)'),G]),
  k('ifct_v2_dhokla','Dhokla',null,100,'4 pieces (100g)',160,5.5,28,3.2,1.8,[pi(100,'4 pieces (100g)'),pi(200,'8 pieces (200g)'),G]),
  k('ifct_v2_oats_cooked_with_water','Oats (cooked with water)',null,200,'1 bowl (200g)',71,2.5,12,1.4,1.7,[bo(150,'Small bowl (150g)'),bo(200,'Bowl (200g)'),G]),
  k('ifct_v2_cornflakes_with_milk','Cornflakes with milk',null,200,'1 bowl (200g)',148,5.2,28,2.2,0.5,[bo(150,'Small bowl (150g)'),bo(200,'Bowl (200g)'),G]),
  k('ifct_v2_toor_dal_cooked','Toor dal (cooked)',null,150,'1 katori (150g)',116,7.2,20,0.4,3.6,[ka(113,'Small katori (113g)'),ka(150,'Katori (150g)'),ka(225,'Large katori (225g)'),G]),
  k('ifct_v2_masoor_dal_cooked','Masoor dal (cooked)',null,150,'1 katori (150g)',102,7.6,17,0.4,3.5,[ka(113,'Small katori (113g)'),ka(150,'Katori (150g)'),ka(225,'Large katori (225g)'),G]),
  k('ifct_v2_urad_dal_cooked','Urad dal (cooked)',null,150,'1 katori (150g)',118,7.6,21,0.4,1.5,[ka(113,'Small katori (113g)'),ka(150,'Katori (150g)'),ka(225,'Large katori (225g)'),G]),
  k('ifct_v2_chana_dal_cooked','Chana dal (cooked)',null,150,'1 katori (150g)',164,8.9,27,2.7,8,[ka(113,'Small katori (113g)'),ka(150,'Katori (150g)'),ka(225,'Large katori (225g)'),G]),
  k('ifct_v2_dal_makhani','Dal makhani',null,150,'1 katori (150g)',145,7.5,18.5,4.8,4.2,[ka(113,'Small katori (113g)'),ka(150,'Katori (150g)'),ka(225,'Large katori (225g)'),G]),
  k('ifct_v2_dal_tadka','Dal tadka',null,150,'1 katori (150g)',120,6.8,17,3.2,3,[ka(113,'Small katori (113g)'),ka(150,'Katori (150g)'),ka(225,'Large katori (225g)'),G]),
  k('ifct_v2_dal_baati','Dal baati',null,200,'1 serving (200g)',412,10.5,58,16,3.8,[se(200,'1 serving (200g)'),se(400,'2 servings (400g)'),G]),
  k('ifct_v2_aloo_sabzi_dry','Aloo sabzi (dry)',null,150,'1 katori (150g)',148,2.5,24,5,2.5,[ka(113,'Small katori (113g)'),ka(150,'Katori (150g)'),ka(225,'Large katori (225g)'),G]),
  k('ifct_v2_palak_paneer','Palak paneer',null,150,'1 katori (150g)',178,8.5,8,13,3.2,[ka(113,'Small katori (113g)'),ka(150,'Katori (150g)'),ka(225,'Large katori (225g)'),G]),
  k('ifct_v2_matar_paneer','Matar paneer',null,150,'1 katori (150g)',195,9,12,13.5,3,[ka(113,'Small katori (113g)'),ka(150,'Katori (150g)'),ka(225,'Large katori (225g)'),G]),
  k('ifct_v2_bhindi_masala','Bhindi masala',null,150,'1 katori (150g)',98,2.8,10.5,5.2,3.5,[ka(113,'Small katori (113g)'),ka(150,'Katori (150g)'),ka(225,'Large katori (225g)'),G]),
  k('ifct_v2_baingan_bharta','Baingan bharta',null,150,'1 katori (150g)',82,2.2,9.5,4,3,[ka(113,'Small katori (113g)'),ka(150,'Katori (150g)'),ka(225,'Large katori (225g)'),G]),
  k('ifct_v2_aloo_gobi','Aloo gobi',null,150,'1 katori (150g)',112,2.8,16,4.5,3,[ka(113,'Small katori (113g)'),ka(150,'Katori (150g)'),ka(225,'Large katori (225g)'),G]),
  k('ifct_v2_saag_sarson_da_saag','Saag (sarson da saag)',null,150,'1 katori (150g)',95,3.8,8.5,4.8,4.5,[ka(113,'Small katori (113g)'),ka(150,'Katori (150g)'),ka(225,'Large katori (225g)'),G]),
  k('ifct_v2_shahi_paneer','Shahi paneer',null,150,'1 katori (150g)',248,10,12,18.5,1.5,[ka(113,'Small katori (113g)'),ka(150,'Katori (150g)'),ka(225,'Large katori (225g)'),G]),
  k('ifct_v2_chicken_curry_home_cooked','Chicken curry (home-cooked)',null,150,'1 katori (150g)',165,18.5,4.5,8.5,0.8,[ka(113,'Small katori (113g)'),ka(150,'Katori (150g)'),ka(225,'Large katori (225g)'),G]),
  k('ifct_v2_butter_chicken','Butter chicken',null,150,'1 katori (150g)',198,17,8,12,1,[ka(113,'Small katori (113g)'),ka(150,'Katori (150g)'),ka(225,'Large katori (225g)'),G]),
  k('ifct_v2_tandoori_chicken','Tandoori chicken',null,120,'1 piece (120g)',190,22,4,9.5,0.5,[pi(120,'1 piece (120g)'),pi(240,'2 pieces (240g)'),G]),
  k('ifct_v2_egg_bhurji_2_eggs','Egg bhurji (2 eggs)',null,120,'1 serving (120g)',218,14,4.5,16,0.5,[se(120,'1 serving (120g)'),se(240,'2 servings (240g)'),G]),
  k('ifct_v2_omelette_2_eggs','Omelette (2 eggs)',null,110,'1 piece (110g)',200,13.5,1.5,15.5,0,[pi(110,'1 omelette (110g)'),pi(220,'2 omelettes (220g)'),G]),
  k('ifct_v2_fish_curry','Fish curry',null,150,'1 katori (150g)',142,16.5,5,6.5,0.8,[ka(113,'Small katori (113g)'),ka(150,'Katori (150g)'),ka(225,'Large katori (225g)'),G]),
  k('ifct_v2_mutton_curry','Mutton curry',null,150,'1 katori (150g)',218,18,4.5,14.5,0.8,[ka(113,'Small katori (113g)'),ka(150,'Katori (150g)'),ka(225,'Large katori (225g)'),G]),
  k('ifct_v2_keema_minced_meat','Keema (minced meat)',null,150,'1 katori (150g)',245,22,5.5,15.5,1,[ka(113,'Small katori (113g)'),ka(150,'Katori (150g)'),ka(225,'Large katori (225g)'),G]),
  k('ifct_v2_sambhar','Sambhar',null,150,'1 katori (150g)',62,3.2,10,1.2,2.8,[ka(113,'Small katori (113g)'),ka(150,'Katori (150g)'),ka(225,'Large katori (225g)'),G]),
  k('ifct_v2_rasam','Rasam',null,150,'1 katori (150g)',28,1.2,5,0.4,1,[ka(113,'Small katori (113g)'),ka(150,'Katori (150g)'),G]),
  k('ifct_v2_coconut_chutney','Coconut chutney',null,30,'2 tbsp (30g)',198,2.5,8.5,18,4.5,[tb(15,'1 tbsp (15g)'),tb(30,'2 tbsp (30g)'),G]),
  k('ifct_v2_idli','Idli',null,50,'1 piece (50g)',116,4,24,0.8,1,[pi(50,'1 idli (50g)'),pi(100,'2 idlis (100g)'),pi(150,'3 idlis (150g)'),G]),
  k('ifct_v2_chai_with_milk_and_sugar','Chai with milk and sugar',null,150,'1 cup (150ml)',54,1.5,8.5,1.5,0,[cu(100,'Cutting chai (100ml)'),cu(150,'1 cup (150ml)'),cu(250,'Mug (250ml)'),GM]),
  k('ifct_v2_black_coffee_no_sugar','Black coffee (no sugar)',null,150,'1 cup (150ml)',5,0.3,0.7,0.1,0,[cu(150,'1 cup (150ml)'),cu(250,'Mug (250ml)'),GM]),
  k('ifct_v2_nimbu_pani_sweetened','Nimbu pani (sweetened)',null,250,'1 glass (250ml)',42,0.2,11,0.1,0.2,[gl(250,'1 glass (250ml)'),gl(500,'2 glasses (500ml)'),GM]),
  k('ifct_v2_coconut_water','Coconut water',null,250,'1 glass (250ml)',24,0.4,5.5,0.1,0.3,[gl(250,'1 glass (250ml)'),gl(500,'2 glasses (500ml)'),GM]),
  k('ifct_v2_mango_shake','Mango shake',null,300,'1 glass (300ml)',128,3.5,24,2.5,0.8,[gl(200,'Small glass (200ml)'),gl(300,'1 glass (300ml)'),GM]),
  k('ifct_v2_turmeric_milk_haldi_doodh','Turmeric milk (haldi doodh)',null,250,'1 glass (250ml)',85,4,9.5,3.5,0.2,[gl(200,'Small glass (200ml)'),gl(250,'1 glass (250ml)'),GM]),
  k('ifct_v2_ghee','Ghee',null,5,'1 tsp (5g)',900,0,0,99.7,0,[ts(5,'1 tsp (5g) ~45 kcal'),tb(15,'1 tbsp (15g) ~135 kcal'),G]),
  k('ifct_v2_mustard_oil','Mustard oil',null,5,'1 tsp (5g)',884,0,0,100,0,[ts(5,'1 tsp (5g) ~44 kcal'),tb(14,'1 tbsp (14g) ~124 kcal'),G]),
  k('ifct_v2_almonds_raw','Almonds (raw)',null,14,'10 pieces (14g)',579,21,22,50,12.5,[pi(7,'5 almonds (7g)'),pi(14,'10 almonds (14g)'),pi(21,'15 almonds (21g)'),G]),
  k('ifct_v2_cashews_raw','Cashews (raw)',null,14,'10 pieces (14g)',553,18,33,44,3.3,[pi(8,'5 cashews (8g)'),pi(16,'10 cashews (16g)'),ha(25,'Small handful (25g)'),G]),
  k('ifct_v2_peanuts_roasted','Peanuts (roasted)',null,30,'1 handful (30g)',587,26,21,50,8.5,[ha(20,'Small handful (20g)'),ha(30,'Medium handful (30g)'),G]),
  k('ifct_v2_sesame_seeds_til','Sesame seeds (til)',null,10,'1 tbsp (10g)',573,17.7,23.5,49.7,11.8,[tb(10,'1 tbsp (10g)'),tb(20,'2 tbsp (20g)'),G]),
  k('ifct_v2_banana_medium','Banana (medium)',null,120,'1 medium (120g)',89,1.1,22.8,0.3,2.6,[pi(80,'Small banana (80g)'),pi(120,'Medium banana (120g)'),pi(150,'Large banana (150g)'),G]),
  k('ifct_v2_mango_alphonso','Mango (Alphonso)',null,150,'1 katori (150g)',70,0.8,17,0.3,1.8,[ka(150,'1 katori (150g)'),pi(200,'1 medium mango (200g)'),G]),
  k('ifct_v2_papaya','Papaya',null,150,'1 katori (150g)',43,0.5,10.8,0.3,1.7,[ka(150,'1 katori (150g)'),ka(250,'Large bowl (250g)'),G]),
  k('ifct_v2_guava','Guava',null,100,'1 medium (100g)',68,2.6,14.3,1,5.4,[pi(75,'Small guava (75g)'),pi(100,'Medium guava (100g)'),pi(150,'Large guava (150g)'),G]),
  k('ifct_v2_chikoo_sapodilla','Chikoo / Sapodilla',null,100,'1 medium (100g)',94,0.4,20,1.1,5.3,[pi(75,'Small (75g)'),pi(100,'Medium (100g)'),pi(125,'Large (125g)'),G]),
  k('ifct_v2_watermelon','Watermelon',null,200,'1 katori (200g)',30,0.6,7.6,0.2,0.4,[ka(200,'1 katori (200g)'),pi(300,'1 slice (300g)'),G]),
  k('ifct_v2_mathri','Mathri',null,50,'4 pieces (50g)',462,8,58,22,2.5,[pi(50,'4 pieces (50g)'),pi(100,'8 pieces (100g)'),G]),
  k('ifct_v2_namkeen_mixed','Namkeen (mixed)',null,30,'1 handful (30g)',525,10,55,30,3,[ha(20,'Small handful (20g)'),ha(30,'Medium handful (30g)'),ha(50,'Large handful (50g)'),G]),
  k('ifct_v2_murukku','Murukku',null,40,'3 pieces (40g)',496,8.5,64,23,3.5,[pi(40,'3 pieces (40g)'),pi(80,'6 pieces (80g)'),G]),
  k('ifct_v2_chivda_poha_chivda','Chivda (poha chivda)',null,40,'1 handful (40g)',418,8,65,14,3,[ha(30,'Small handful (30g)'),ha(40,'Medium handful (40g)'),ha(60,'Large handful (60g)'),G]),
  k('ifct_v2_kheer_rice','Kheer (rice)',null,150,'1 katori (150g)',180,4.5,30,5.5,0.3,[ka(100,'Small katori (100g)'),ka(150,'Katori (150g)'),ka(200,'Large katori (200g)'),G]),
  k('ifct_v2_besan_barfi','Besan barfi',null,40,'1 piece (40g)',452,9.5,58,20,2,[pi(40,'1 piece (40g)'),pi(80,'2 pieces (80g)'),G]),
  k('ifct_v2_peda','Peda',null,35,'1 piece (35g)',420,8.5,62,16,0,[pi(35,'1 peda (35g)'),pi(70,'2 pedas (70g)'),G]),
  k('ifct_v2_gajar_halwa','Gajar halwa',null,100,'1 katori (100g)',268,4.2,40,10.5,2.8,[ka(80,'Small katori (80g)'),ka(100,'Katori (100g)'),ka(150,'Large katori (150g)'),G]),
  k('ifct_v2_mango_pickle_achaar','Mango pickle (achaar)',null,10,'1 tsp (10g)',142,1.2,12,9.5,2,[ts(5,'1 tsp (5g)'),ts(10,'2 tsp (10g)'),G]),
  k('ifct_v2_raita_plain','Raita (plain)',null,100,'1 katori (100g)',62,3,5.5,3,0.5,[ka(80,'Small katori (80g)'),ka(100,'Katori (100g)'),ka(150,'Large katori (150g)'),G]),
  k('ifct_v2_green_chutney','Green chutney',null,30,'2 tbsp (30g)',68,2.5,8,3,4,[tb(15,'1 tbsp (15g)'),tb(30,'2 tbsp (30g)'),G]),
]

const foods010 = [
  k('ifct_soya_chunks_dry','Soya chunks (raw)',null,30,'1 small handful (30g)',336,52.4,33,0.5,13,[ha(30,'Small handful (30g) ~100 kcal'),ha(50,'Large handful (50g) ~168 kcal'),ka(100,'1 katori dry (100g) ~336 kcal'),G]),
  k('ifct_soya_chunks_cooked','Soya chunks (cooked)',null,150,'1 katori (150g)',112,10.8,6.3,0.5,2.5,[ka(100,'Small katori (100g)'),ka(150,'Katori (150g)'),ka(200,'Large katori (200g)'),G]),
  k('ifct_amul_chaas','Chaas (Buttermilk)','Amul',200,'1 glass (200ml)',15,0.8,2,0.3,0,[gl(200,'1 glass (200ml)'),gl(400,'2 glasses (400ml)'),gl(100,'Half glass (100ml)'),GM]),
  k('ifct_amul_dahi_fullfat','Dahi / Curd (full fat)','Amul',150,'1 katori (150g)',98,3.1,4.7,7.5,0,[ka(100,'Small katori (100g)'),ka(150,'Katori (150g)'),ka(200,'Large katori (200g)'),G]),
  k('ifct_amul_butter_salted','Butter (salted)','Amul',5,'1 tsp (5g)',720,0.6,0.6,80,0,[ts(5,'1 tsp (5g) ~36 kcal'),tb(14,'1 tbsp (14g) ~101 kcal'),pi(10,'1 thin spread (10g) ~72 kcal'),G]),
]

const all = [...foods009, ...foods010]
console.log(`Inserting ${all.length} foods...`)
upsert(all).then(r => {
  if (r.status === 201 || r.status === 200) {
    console.log(`✅ SUCCESS — ${all.length} foods inserted (duplicates skipped)`)
  } else {
    console.log('Status:', r.status)
    console.log('Response:', r.body)
  }
}).catch(console.error)
