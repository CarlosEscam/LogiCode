import { Suspense } from "react";
import Notas from "./Notas";

export const metadata = { title: "Notas · LogiCode" };

export default function PaginaNotas() {
  return (
    <Suspense fallback={null}>
      <Notas />
    </Suspense>
  );
}
