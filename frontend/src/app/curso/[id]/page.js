import { Suspense } from "react";
import Curso from "./Curso";

export const metadata = { title: "Curso · LogiCode" };

export default function PaginaCurso() {
  return (
    <Suspense fallback={null}>
      <Curso />
    </Suspense>
  );
}
