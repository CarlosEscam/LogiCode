import Link from "next/link";
import MenuSesion from "@/components/MenuSesion";
import Navegacion from "@/components/Navegacion";

export default function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-borde bg-background/75 backdrop-blur-md">
      <div className="h-0.5 bg-gradient-to-r from-marca via-menta to-naranja" />
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="group flex items-center gap-2.5 text-lg font-bold tracking-tight">
          <Logo />
          <span>
            Logi<span className="texto-gradiente">Code</span>
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-sm sm:gap-4">
          <Navegacion />
          <MenuSesion />
        </div>
      </nav>
    </header>
  );
}

export function Logo({ className = "h-9 w-9" }) {
  return (
    <span
      className={`${className} inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-marca to-marca-2 text-white shadow-lg shadow-marca/30 transition group-hover:rotate-6`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5">
        <path d="M8 7 3 12l5 5" />
        <path d="m16 7 5 5-5 5" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      </svg>
    </span>
  );
}
