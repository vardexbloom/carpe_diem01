import "./globals.css";
import Providers from "./components/Providers";
import Header from "./components/Header";
import CartDrawer from "./components/CartDrawer";

export const metadata = {
  title: "Carpe Diem | Good clothes, very low prices",
  description: "We hunt good clothes from all over the world and sell them at very low prices. New drop every Monday.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>
          <Header />
          <main id="top">{children}</main>
          <CartDrawer />
        </Providers>
      </body>
    </html>
  );
}
