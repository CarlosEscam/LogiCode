import { Suspense } from "react";
import Revision from "./Revision";

export const metadata = { title: "Por revisar · LogiCode" };

export default function PaginaRevision() {
  return (
    <Suspense fallback={null}>
      <Revision />
    </Suspense>
  );
}
