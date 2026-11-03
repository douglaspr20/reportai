import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs y el canvas nativo no deben pasar por el bundler del servidor.
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
};

export default nextConfig;
