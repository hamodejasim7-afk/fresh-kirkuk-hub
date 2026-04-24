export type Category = "خضار وفواكه" | "لحوم" | "أسماك" | "دجاج";

export interface Product {
  id: string;
  name: string;
  category: Category;
  price: number;
  unit: string;
  emoji: string;
}

export const PRODUCTS: Product[] = [
  { id: "p1", name: "طماطم طازجة", category: "خضار وفواكه", price: 1500, unit: "كغم", emoji: "🍅" },
  { id: "p2", name: "خيار", category: "خضار وفواكه", price: 1250, unit: "كغم", emoji: "🥒" },
  { id: "p3", name: "بطاطا", category: "خضار وفواكه", price: 1000, unit: "كغم", emoji: "🥔" },
  { id: "p4", name: "بصل أحمر", category: "خضار وفواكه", price: 1250, unit: "كغم", emoji: "🧅" },
  { id: "p5", name: "تفاح أحمر", category: "خضار وفواكه", price: 3000, unit: "كغم", emoji: "🍎" },
  { id: "p6", name: "موز", category: "خضار وفواكه", price: 2500, unit: "كغم", emoji: "🍌" },
  { id: "p7", name: "لحم غنم طازج", category: "لحوم", price: 22000, unit: "كغم", emoji: "🥩" },
  { id: "p8", name: "لحم بقر مفروم", category: "لحوم", price: 18000, unit: "كغم", emoji: "🥩" },
  { id: "p9", name: "كباب جاهز", category: "لحوم", price: 20000, unit: "كغم", emoji: "🍢" },
  { id: "p10", name: "سمك كارب طازج", category: "أسماك", price: 9000, unit: "كغم", emoji: "🐟" },
  { id: "p11", name: "سمك زبيدي", category: "أسماك", price: 14000, unit: "كغم", emoji: "🐠" },
  { id: "p12", name: "روبيان", category: "أسماك", price: 25000, unit: "كغم", emoji: "🦐" },
  { id: "p13", name: "دجاج كامل طازج", category: "دجاج", price: 6500, unit: "حبة", emoji: "🍗" },
  { id: "p14", name: "صدور دجاج", category: "دجاج", price: 8500, unit: "كغم", emoji: "🍗" },
  { id: "p15", name: "أفخاذ دجاج", category: "دجاج", price: 7000, unit: "كغم", emoji: "🍗" },
];
