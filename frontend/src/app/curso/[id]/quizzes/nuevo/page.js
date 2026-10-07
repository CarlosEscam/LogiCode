import { Suspense } from "react";
import NuevoQuiz from "./NuevoQuiz";

export const metadata = { title: "Nuevo quiz · LogiCode" };

export default function PaginaNuevoQuiz() {
  return (
    <Suspense fallback={null}>
      <NuevoQuiz />
    </Suspense>
  );
}
