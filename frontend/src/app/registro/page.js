import FormRegistro from "./FormRegistro";

export const metadata = { title: "Crear cuenta · LogiCode" };

// Registro (RF-01, RF-02).
export default function Registro() {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-semibold">Crear cuenta</h1>
      <p className="text-sm opacity-80">
        Los estudiantes solo pueden registrarse si el docente ya agregó su cédula a la lista del curso.
        Las cuentas de docente quedan pendientes hasta que un administrador las apruebe.
      </p>
      <FormRegistro />
    </div>
  );
}
