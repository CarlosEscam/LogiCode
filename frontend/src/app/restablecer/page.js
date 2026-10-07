import { Suspense } from "react";
import { Logo } from "@/components/Header";
import FormRestablecer from "./FormRestablecer";

export const metadata = { title: "Nueva contraseña · LogiCode" };

// Página a la que lleva el enlace del correo de recuperación.
export default function Restablecer({ searchParams }) {
  return (
    <div className="tarjeta aparecer mx-auto flex w-full max-w-md flex-col gap-5 p-6 sm:p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo className="h-12 w-12" />
        <h1 className="text-2xl font-bold tracking-tight">Nueva contraseña</h1>
      </div>
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
