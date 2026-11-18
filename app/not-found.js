export const metadata = { title: "Page not found | Carpe Diem" };

export default function NotFound() {
  return (
    <div className="nf">
      <div className="nf-arc" />
      <div className="nf-body">
        <a className="brand" href="/">
          CARPE DIEM
        </a>
        <div className="nf-404">404</div>
        <h1>This piece walked out of the store</h1>
        <p>We can&rsquo;t find that page. Let&rsquo;s get you back to the rail.</p>
        <a className="btn acc" href="/">
          Back to home
        </a>
      </div>
    </div>
  );
}
