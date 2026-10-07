import { Suspense } from "react";
import Tema from "./Tema";

export const metadata = { title: "Tema del foro · LogiCode" };

export default function PaginaTema() {
  return (
    <Suspense fallback={null}>
      <Tema />
    </Suspense>
  );
}
