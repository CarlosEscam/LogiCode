// Foto de perfil. Se guarda en la carpeta de subidas con un nombre aleatorio que cambia
// en cada subida, así el navegador no se queda con la foto anterior en caché.

export const MAX_FOTO_KB = 1024;

// Ruta de la API para ver la foto, o null si no tiene.
export function urlFoto(user) {
  if (!user?.avatarPath) return null;
  return `/api/users/${user.id}/avatar?v=${user.avatarPath.slice(7, 15)}`;
}

// Autor que se muestra en el foro y otras listas: sin el nombre del archivo.
export function autorPublico(autor) {
  if (!autor) return autor;
  const { avatarPath, ...resto } = autor;
  return { ...resto, avatarUrl: urlFoto({ id: autor.id, avatarPath }) };
}

// Revisa los primeros bytes para aceptar solo JPEG, PNG o WebP de verdad,
// sin importar el nombre o el tipo que diga el navegador.
export function extensionDeImagen(buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return '.webp';
  return null;
}
