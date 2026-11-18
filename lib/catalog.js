import { cacheLife, cacheTag } from "next/cache";
import { anonClient, supabaseConfigured } from "./supabase";
import { DEMO_PRODUCTS } from "../app/data/products";

const typesOf = (products) => [...new Set(products.map((p) => p.type).filter(Boolean))];

/** Catalogue for the storefront. Cached; the admin app will call revalidateTag("catalog") after edits. */
export async function getCatalog() {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");

  if (!supabaseConfigured()) return { source: "demo", products: DEMO_PRODUCTS, types: typesOf(DEMO_PRODUCTS), settings: defaultSettings() };

  const sb = anonClient();
  const [prod, sett] = await Promise.all([
    sb
      .from("products")
      .select("slug,name,description,price_paise,mrp_paise,is_new,sort_order,categories(name),product_images(url,alt,position,is_demo),product_variants(size,color,stock)")
      .order("sort_order", { ascending: true }),
    sb.from("store_settings").select("key,value"),
  ]);
  if (prod.error) throw new Error("Catalogue query failed: " + prod.error.message);
  if (sett.error) throw new Error("Settings query failed: " + sett.error.message);

  const products = prod.data.map((r) => {
    const images = [...r.product_images].sort((a, b) => a.position - b.position).map((i) => ({ url: i.url, alt: i.alt || r.name, demo: i.is_demo }));
    const variants = r.product_variants.filter((v) => v.color === "").map((v) => ({ size: v.size, stock: v.stock }));
    return {
      id: r.slug,
      slug: r.slug,
      name: r.name,
      type: r.categories?.name ?? "",
      description: r.description,
      price: r.price_paise / 100,
      mrp: r.mrp_paise ? r.mrp_paise / 100 : null,
      stock: variants.reduce((s, v) => s + v.stock, 0),
      isNew: r.is_new,
      img: images[0]?.url ?? "",
      imgDemo: images[0]?.demo ?? true,
      images,
      variants: sortSizes(variants),
    };
  });
  const settings = { ...defaultSettings(), ...Object.fromEntries(sett.data.map((s) => [s.key, s.value])) };
  return { source: "db", products, types: typesOf(products), settings };
}

const ORDER = ["XS", "S", "M", "L", "XL", "XXL"];
const sortSizes = (v) => [...v].sort((a, b) => (ORDER.indexOf(a.size) + 100) % 100 - (ORDER.indexOf(b.size) + 100) % 100);

// Display-only defaults. The server always prices from the database.
function defaultSettings() {
  return { shipping: { flat_paise: 0, free_above_paise: null }, cod: { enabled: false, fee_paise: 0, max_total_paise: null }, online_payments: { enabled: false } };
}
