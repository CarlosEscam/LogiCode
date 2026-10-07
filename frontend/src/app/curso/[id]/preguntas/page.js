import { Suspense } from "react";
import Banco from "./Banco";

export const metadata = { title: "Banco de preguntas · LogiCode" };

export default function PaginaBanco() {
  return (
    <Suspense fallback={null}>
      <Banco />
    </Suspense>
  );
}
