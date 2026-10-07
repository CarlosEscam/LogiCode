// Datos de un material que se envían al navegador (sin la ruta interna del archivo).
export function publicMaterial(m) {
  return {
    id: m.id,
    courseId: m.courseId,
    topicId: m.topicId,
    title: m.title,
    description: m.description,
    kind: m.kind,
    url: m.url,
    tool: m.tool,
    visibility: m.visibility,
    fileName: m.fileName,
    fileSize: m.fileSize,
    uploadedById: m.uploadedById,
    uploadedBy: m.uploadedBy?.fullName,
    createdAt: m.createdAt,
  };
}

export const TOOLS = ['PSEINT', 'DFD', 'SCRATCH', 'ARDUINO', 'GENERAL'];
