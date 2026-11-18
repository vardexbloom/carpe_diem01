import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getOrderByToken } from "../../../lib/orders";
import { serverConfigured } from "../../../lib/supabase";
import { SITE } from "../../data/site";
import OrderLive from "../../components/OrderLive";
import Footer from "../../components/Footer";

export const metadata = { title: "Your order | Carpe Diem", robots: { index: false, follow: false } };

const inr = (paise) => "\u20B9" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const HEADLINE = {
  pending_payment: ["Waiting for your payment", "We will confirm the moment Cashfree tells us it went through."],
  pending_cod_confirmation: ["Order placed", "Pay in cash when it arrives. We will confirm your order on WhatsApp before shipping."],
  confirmed: ["Order confirmed", "Payment received. We are getting your order ready."],
  packed: ["Packed", "Your order is packed and waiting for the courier."],
  shipped: ["On its way", "Your order has been shipped."],
  delivered: ["Delivered", "Enjoy your new clothes."],
  cancelled: ["Order cancelled", "This order was cancelled and no payment is pending."],
  refunded: ["Refunded", "This order was refunded."],
  payment_review: ["Payment under review", "We received your payment and are checking your order. We will contact you shortly."],
};

export default function Page({ params }) {
  return (
    <Suspense fallback={<div className="page" aria-busy="true" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }) {
  if (!serverConfigured()) notFound();
  const order = await getOrderByToken((await params).token);
  if (!order) notFound();
  const [h, sub] = HEADLINE[order.status] ?? ["Order", ""];
  return (
    <>
      <div className="page order">
        <p className="sub">Order CD-{order.order_no}</p>
        <h1>{h}</h1>
        <p>{sub}</p>
        <OrderLive token={order.public_token} status={order.status} method={order.payment_method} whatsapp={SITE.whatsapp} />
        {order.payment_method === "online" && order.payment_status === "failed" && order.status === "pending_payment" && (
          <p className="alert">A payment attempt did not go through. If you were charged it will be refunded by your bank. You can retry from the shop.</p>
        )}
        <div className="card">
          <ul className="lines-plain">
            {order.order_items.map((i) => (
              <li key={i.product_name + i.size} className="tot">
                <span>{i.product_name} ({i.size}) &times; {i.qty}</span>
                <span>{inr(i.line_total_paise)}</span>
              </li>
            ))}
          </ul>
          <div className="tot"><span>Shipping</span><span>{order.shipping_paise ? inr(order.shipping_paise) : "Free"}</span></div>
          {order.cod_fee_paise > 0 && <div className="tot"><span>COD fee</span><span>{inr(order.cod_fee_paise)}</span></div>}
          <div className="tot grand"><span>Total</span><span>{inr(order.total_paise)}</span></div>
          <p>
            <b>{order.payment_method === "cod" ? "Cash on Delivery" : order.payment_status === "paid" ? "Paid online" : "Online payment"}</b>
          </p>
        </div>
        <div className="card">
          <b>Delivering to</b>
          <p>
            {order.customer_name}, {order.phone}<br />
            {order.address_line1}{order.address_line2 ? ", " + order.address_line2 : ""}<br />
            {order.city}, {order.state} {order.pincode}
          </p>
          {order.tracking_no && <p>Tracking: {order.courier} {order.tracking_no}</p>}
        </div>
        {SITE.whatsapp && <a className="btn dark" href={"https://wa.me/" + SITE.whatsapp + "?text=" + encodeURIComponent("Hi, about my order CD-" + order.order_no)} target="_blank" rel="noreferrer">Questions? Chat on WhatsApp</a>}
      </div>
      <Footer />
    </>
  );
}
