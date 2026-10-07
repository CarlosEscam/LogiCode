import FormIngresar from "./FormIngresar";

export const metadata = { title: "Ingresar · LogiCode" };

// Ingreso con cédula y contraseña (RF-03).
export default function Ingresar() {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-semibold">Ingresar</h1>
      <FormIngresar />
    </div>
  );
}
