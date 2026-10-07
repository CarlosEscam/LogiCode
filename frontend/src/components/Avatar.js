import { urlFoto } from "@/lib/api";

const TAMANOS = {
  xs: "h-6 w-6 text-[0.6rem] rounded-full",
  sm: "h-8 w-8 text-xs rounded-full",
  md: "h-10 w-10 text-sm rounded-full",
  lg: "h-14 w-14 text-xl rounded-2xl",
  xl: "h-28 w-28 text-4xl rounded-3xl",
};

export function iniciales(nombre) {
  return String(nombre ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

// Foto de perfil, o las iniciales sobre el degradado de la marca si la persona no tiene foto.
export default function Avatar({ persona, tamano = "md", className = "" }) {
  const foto = urlFoto(persona);
  const base = `${TAMANOS[tamano]} inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`;
  if (foto) {
    // eslint-disable-next-line @next/next/no-img-element -- la foto viene de la API, no de la web
    return <img src={foto} alt="" className={`${base} bg-superficie-2 object-cover`} />;
  }
  return (
    <span aria-hidden="true" className={`${base} bg-gradient-to-br from-marca to-marca-2 font-bold text-white shadow-lg shadow-marca/30`}>
      {iniciales(persona?.fullName)}
    </span>
  );
}
