import { Suspense } from "react";
import DetalleQuiz from "./DetalleQuiz";

export const metadata = { title: "Quiz · LogiCode" };

export default function PaginaDetalleQuiz() {
  return (
    <Suspense fallback={null}>
      <DetalleQuiz />
    </Suspense>
  );
}
