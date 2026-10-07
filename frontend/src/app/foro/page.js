import { Suspense } from "react";
import Foro from "./Foro";

export const metadata = { title: "Foro · LogiCode" };

// Foro (RF-21 a RF-23): lectura pública, escritura con sesión iniciada.
export default function PaginaForo() {
  return (
    <Suspense fallback={null}>
      <Foro />
    </Suspense>
  );
}
