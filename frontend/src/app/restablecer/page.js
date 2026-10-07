import { Suspense } from "react";
import FormRestablecer from "./FormRestablecer";

export const metadata = { title: "Nueva contraseña · LogiCode" };

// Página a la que lleva el enlace del correo de recuperación.
export default function Restablecer({ searchParams }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-semibold">Nueva contraseña</h1>
      <Suspense fallback={null}>
        <ConToken searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ConToken({ searchParams }) {
  const { token } = await searchParams;
  return <FormRestablecer token={typeof token === "string" ? token : ""} />;
}
