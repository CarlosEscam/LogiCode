export const metadata = { title: "Foro · LogiCode" };

const categorias = ["PSeInt", "DFD", "Scratch", "Arduino", "General"];

// Foro (RF-21 a RF-23): lectura pública, escritura con sesión iniciada. Se conectará en la fase 3.
export default function Foro() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Foro</h1>
      <ul className="grid gap-3 sm:grid-cols-2">
        {categorias.map((c) => (
          <li key={c} className="rounded-lg border border-black/10 p-4 dark:border-white/15">
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}
