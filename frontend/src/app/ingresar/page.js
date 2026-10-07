import { Logo } from "@/components/Header";
import FormIngresar from "./FormIngresar";

export const metadata = { title: "Ingresar · LogiCode" };

// Ingreso con cédula y contraseña (RF-03).
export default function Ingresar() {
  return (
    <div className="tarjeta aparecer mx-auto flex w-full max-w-md flex-col gap-5 p-6 sm:p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo className="h-12 w-12" />
        <h1 className="text-2xl font-bold tracking-tight">Ingresar</h1>
        <p className="text-sm text-foreground/65">Use su cédula y contraseña.</p>
      </div>
      <FormIngresar />
    </div>
  );
}
