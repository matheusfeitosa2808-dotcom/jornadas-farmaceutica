import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="empty page">
      <h1>Página não encontrada</h1>
      <p>Continue sua jornada pela página inicial.</p>
      <Link className="button" href="/">
        Voltar ao início
      </Link>
    </main>
  );
}
