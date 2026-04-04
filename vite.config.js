import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Dev proxy: browser calls same-origin `/api/azure-foundry/...`; Vite forwards to Azure with api-key
// (avoids CORS on cognitiveservices.azure.com). Production builds still need a backend or edge proxy
// if you host the SPA on a different origin than Azure.

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const azure = (env.VITE_AZURE_FOUNDRY_ENDPOINT || "").replace(/\/$/, "");
  const server = {};
  if (azure) {
    server.proxy = {
      "/api/azure-foundry": {
        target: azure,
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/azure-foundry/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            const key = env.VITE_AZURE_FOUNDRY_API_KEY;
            if (key) proxyReq.setHeader("api-key", key);
          });
        },
      },
    };
  }
  return {
    plugins: [react()],
    base: "/relman/",
    server,
  };
});
