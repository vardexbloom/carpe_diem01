import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCatalog } from "../../../lib/catalog";
import ProductView from "../../components/ProductView";
import Footer from "../../components/Footer";

const find = async (slug) => (await getCatalog()).products.find((p) => p.slug === slug);

export async function generateStaticParams() {
  return (await getCatalog()).products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const p = await find((await params).slug);
  if (!p) return { title: "Not found | Carpe Diem" };
  return {
    title: `${p.name} | Carpe Diem`,
    description: `${p.name} at Carpe Diem. New stock every Monday.`,
    openGraph: p.img ? { title: p.name, images: [p.img] } : undefined,
  };
}

export default function Page({ params }) {
  return (
    <Suspense fallback={<div className="page" aria-busy="true" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }) {
  const p = await find((await params).slug);
  if (!p) notFound();
  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    image: p.images.map((i) => i.url),
    description: p.description || p.name,
    offers: { "@type": "Offer", priceCurrency: "INR", price: p.price, availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" },
  };
  return (
    <>
      <ProductView product={p} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <Footer />
    </>
  );
}
