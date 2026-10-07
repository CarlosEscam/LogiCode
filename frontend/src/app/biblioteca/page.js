export const metadata = { title: "Biblioteca · LogiCode" };

// Biblioteca pública de la materia (RF-20). Se conectará a la API en la fase 3.
export default function Biblioteca() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold">Biblioteca</h1>
      <p className="opacity-80">Aquí aparecerá el material público, organizado por tema y herramienta.</p>
    </div>
  );
}
