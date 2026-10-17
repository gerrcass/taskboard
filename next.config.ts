import type { NextConfig } from "next";

// The app is fully client-side, so it builds to static files and deploys to
// GitHub Pages. The pages workflow sets PAGES_BASE_PATH so asset URLs resolve
// under https://<owner>.github.io/<repo>/.
const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.PAGES_BASE_PATH ?? "",
  images: { unoptimized: true },
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
