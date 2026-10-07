import { Suspense } from "react";
import NuevaActividad from "./NuevaActividad";

export const metadata = { title: "Nueva actividad · LogiCode" };

export default function PaginaNuevaActividad() {
  return (
    <Suspense fallback={null}>
      <NuevaActividad />
    </Suspense>
  );
}
