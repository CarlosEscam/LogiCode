import FormRecuperar from "./FormRecuperar";

export const metadata = { title: "Recuperar contraseña · LogiCode" };

// Recuperación de contraseña (RF-04): pide el enlace por correo.
export default function Recuperar() {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-semibold">Recuperar contraseña</h1>
      <FormRecuperar />
    </div>
  );
}
