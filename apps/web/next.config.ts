import type { NextConfig } from "next";

// O navegador só fala com a própria web: /api/* é reescrito para a API, então o cookie de
// sessão é first-party (HttpOnly) e não há CORS nem bloqueio de cookies de terceiros.
const API_URL = process.env.API_URL ?? "http://localhost:3001";

const config: NextConfig = {
  transpilePackages: ["@data-track/shared"],
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/:path*` }];
  },
};
export default config;
