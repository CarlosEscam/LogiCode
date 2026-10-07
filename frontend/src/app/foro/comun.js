import { NOMBRE_ROL } from "@/lib/api";
import Avatar from "@/components/Avatar";

// Piezas que comparten la lista de temas y la página de un tema.

const formato = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" });

export function fechaForo(valor) {
  return formato.format(new Date(valor));
}

// Nombre del autor; a docentes y administradores se les marca el rol.
// Con foto, se muestra su foto de perfil (o sus iniciales) antes del nombre.
export function NombreAutor({ autor, foto = false }) {
  return (
    <span className={foto ? "inline-flex items-center gap-2" : undefined}>
      {foto && <Avatar persona={autor} tamano="sm" />}
      {autor.fullName}
      {autor.role !== "STUDENT" && (
        <span className="ml-1 rounded-full bg-marca/20 px-1.5 py-px text-[0.7rem] font-semibold text-violet-200">{NOMBRE_ROL[autor.role]}</span>
      )}
    </span>
  );
}
