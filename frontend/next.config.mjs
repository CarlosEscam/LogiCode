/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  // En Vercel la web y la API comparten dirección (vercel.json de la raíz), así que la web
  // llama a /api sin dominio. En el PC la API sigue en http://localhost:4000.
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? (process.env.VERCEL ? "" : "http://localhost:4000"),
  },
  // Oculta el botón "N" de Next.js que aparece en desarrollo (npm run dev).
  // En producción no existe; los errores de desarrollo se siguen mostrando.
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
