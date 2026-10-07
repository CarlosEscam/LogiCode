import { Suspense } from "react";
import Actividad from "./Actividad";

export const metadata = { title: "Actividad · LogiCode" };

export default function PaginaActividad() {
  return (
    <Suspense fallback={null}>
      <Actividad />
    </Suspense>
  );
}
