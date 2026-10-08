/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
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
