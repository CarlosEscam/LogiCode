import { Suspense } from "react";
import Intento from "./Intento";

export const metadata = { title: "Quiz · LogiCode" };

export default function PaginaIntento() {
  return (
    <Suspense fallback={null}>
      <Intento />
    </Suspense>
  );
}
