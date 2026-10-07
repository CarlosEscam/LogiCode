import { Logo } from "@/components/Header";
import FormRegistro from "./FormRegistro";

export const metadata = { title: "Crear cuenta · LogiCode" };

// Registro (RF-01, RF-02).
export default function Registro() {
  return (
    <div className="tarjeta aparecer mx-auto flex w-full max-w-md flex-col gap-5 p-6 sm:p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo className="h-12 w-12" />
        <h1 className="text-2xl font-bold tracking-tight">Crear cuenta</h1>
      </div>
      <p className="rounded-xl border border-marca/25 bg-marca/10 px-3 py-2 text-sm text-foreground/80">
        Los estudiantes solo pueden registrarse si el docente ya agregó su cédula a la lista del curso.
        Las cuentas de docente quedan pendientes hasta que un administrador las apruebe.
      </p>
      <FormRegistro />
    </div>
  );
}
