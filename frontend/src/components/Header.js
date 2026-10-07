import Link from "next/link";

const enlaces = [
  { href: "/", texto: "Inicio" },
  { href: "/biblioteca", texto: "Biblioteca" },
  { href: "/foro", texto: "Foro" },
];

export default function Header() {
  return (
    <header className="border-b border-black/10 dark:border-white/15">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-semibold">
          LogiCode
        </Link>
        <ul className="flex items-center gap-4 text-sm">
          {enlaces.map((e) => (
            <li key={e.href}>
              <Link href={e.href} className="hover:underline">
                {e.texto}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/ingresar"
              className="rounded-md bg-foreground px-3 py-1.5 text-background"
            >
              Ingresar
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
