import { getCatalog } from "../../lib/catalog";
import { cashfreeConfigured } from "../../lib/cashfree";
import { serverConfigured } from "../../lib/supabase";
import CheckoutForm from "../components/CheckoutForm";
import Footer from "../components/Footer";

export const metadata = { title: "Checkout | Carpe Diem", robots: { index: false } };

export default async function Page() {
  const { source, settings } = await getCatalog();
  const live = source === "db" && serverConfigured();
  const online = live && cashfreeConfigured() && Boolean(process.env.NEXT_PUBLIC_SITE_URL) && settings.online_payments?.enabled === true;
  const cod = live && settings.cod?.enabled === true;
  return (
    <>
      <CheckoutForm live={live} online={online} cod={cod} codFeePaise={settings.cod?.fee_paise ?? 0} />
      <Footer />
    </>
  );
}
