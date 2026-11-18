// SAMPLE DATA. Replace with your real pieces. In a later step this moves into the database.
// Prices, old prices (mrp) and stock are sample numbers. Show an old price only if you really charged it,
// and "ONLY N LEFT" only from your real stock count.
export const SIZES = ["S", "M", "L", "XL"];
export const TYPES = ["Tees", "Jeans", "Shirts", "Long sleeves"];

export const PRODUCTS = [
  { id: 9, name: "Dream Glow Tee", type: "Tees", price: 150, mrp: 299, stock: 14, isNew: true, img: "/products/p9.jpg" },
  { id: 3, name: "Smoke Grey Wide Jeans", type: "Jeans", price: 500, mrp: 999, stock: 9, isNew: true, img: "/products/p3.jpg" },
  { id: 8, name: "LA Raglan Tee", type: "Tees", price: 150, mrp: 299, stock: 11, isNew: false, img: "/products/p8.jpg" },
  { id: 7, name: "Ice Blue Baggy Jeans", type: "Jeans", price: 500, mrp: 999, stock: 7, isNew: false, img: "/products/p7.jpg" },
  { id: 12, name: "Star Layer Long Sleeve", type: "Long sleeves", price: 200, mrp: 399, stock: 8, isNew: true, img: "/products/p12.jpg" },
  { id: 13, name: "Moss Wash Wide Jeans", type: "Jeans", price: 500, mrp: 999, stock: 2, isNew: false, img: "/products/p13.jpg" },
  { id: 5, name: "Olive Wash Tee", type: "Tees", price: 150, mrp: 299, stock: 16, isNew: false, img: "/products/p5.jpg" },
  { id: 1, name: "Sand Wash Baggy Jeans", type: "Jeans", price: 500, mrp: 999, stock: 6, isNew: false, img: "/products/p1.jpg" },
  { id: 10, name: "Rugby Stripe Polo", type: "Shirts", price: 150, mrp: 349, stock: 3, isNew: false, img: "/products/p10.jpg" },
  { id: 2, name: "Star Patch Jeans", type: "Jeans", price: 500, mrp: 999, stock: 5, isNew: false, img: "/products/p2.jpg" },
];

export const OUTFITS = [[9, 3], [8, 7], [12, 13], [5, 1], [10, 2]]; // [top id, bottom id]
export const RAIL = [8, 5, 10, 13, 2, 9]; // pieces on the hanging rail
export const RING = [9, 2, 8, 13, 12, 5]; // pieces on the hero ring

export const byId = (id) => PRODUCTS.find((p) => p.id === id);
export const off = (p) => Math.round((1 - p.price / p.mrp) * 100);
export const rupee = (n) => "\u20B9" + Number(n).toLocaleString("en-IN");
export const tagOf = (p) => (p.stock <= 3 ? `ONLY ${p.stock} LEFT` : p.isNew ? "NEW" : "");
