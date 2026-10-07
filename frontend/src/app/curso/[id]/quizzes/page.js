import { Suspense } from "react";
import Quizzes from "./Quizzes";

export const metadata = { title: "Quizzes · LogiCode" };

export default function PaginaQuizzes() {
  return (
    <Suspense fallback={null}>
      <Quizzes />
    </Suspense>
  );
}
