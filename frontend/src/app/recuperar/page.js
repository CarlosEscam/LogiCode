import { Logo } from "@/components/Header";
import FormRecuperar from "./FormRecuperar";

export const metadata = { title: "Recuperar contraseña · LogiCode" };

// Recuperación de contraseña (RF-04): pide el enlace por correo.
export default function Recuperar() {
  return (
    <div className="tarjeta aparecer mx-auto flex w-full max-w-md flex-col gap-5 p-6 sm:p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo className="h-12 w-12" />
        <h1 className="text-2xl font-bold tracking-tight">Recuperar contraseña</h1>
        <p className="text-sm text-foreground/65">Le enviaremos un enlace a su correo.</p>
      </div>
      <FormRecuperar />
    </div>
  );
}
