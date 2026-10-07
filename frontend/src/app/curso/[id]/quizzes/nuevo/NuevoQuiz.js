"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, useUsuario } from "@/lib/api";
import { Aviso } from "@/components/Formulario";
import FormQuiz from "@/components/FormQuiz";

export default function NuevoQuiz() {
  const { id } = useParams();
  const router = useRouter();
  const usuario = useUsuario();
  const [temas, setTemas] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    api(`/courses/${id}/topics`)
      .then((d) => vivo && setTemas(d.topics))
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
    };
  }, [id, usuario]);

  if (usuario === null) return <p className="tarjeta p-6"><Link href="/ingresar" className="font-semibold text-violet-300 underline">Ingrese</Link> para crear quizzes.</p>;

  return (
    <div className="flex flex-col gap-6">
      <div className="aparecer flex flex-col gap-2">
        <Link href={`/curso/${id}/quizzes`} className="self-start text-sm text-foreground/60 transition hover:text-violet-300">← Quizzes</Link>
        <h1 className="titulo-pagina">Nuevo quiz</h1>
      </div>
      <Aviso>{error}</Aviso>
      {temas && <FormQuiz courseId={id} temas={temas} onGuardado={(quiz) => router.push(`/curso/${id}/quizzes/${quiz.id}`)} />}
    </div>
  );
}
