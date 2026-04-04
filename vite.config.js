import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/** Same-origin proxy so the browser never calls Azure directly (CORS). Used in dev and vite preview. */
function azureFoundryProxy(env) {
  const target = (env.VITE_AZURE_FOUNDRY_ENDPOINT || "").replace(/\/$/, "");
  if (!target) return undefined;
  return {
    "/api/azure-foundry": {
      target,
      changeOrigin: true,
      secure: true,
      rewrite: (path) => path.replace(/^\/api\/azure-foundry/, ""),
      configure: (proxy) => {
        proxy.on("proxyReq", (proxyReq) => {
          const key = env.AZURE_FOUNDRY_API_KEY || env.VITE_AZURE_FOUNDRY_API_KEY;
          if (key) proxyReq.setHeader("api-key", key);
        });
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxy = azureFoundryProxy(env);
  return {
    plugins: [react()],
    base: "/relman/",
    ...(proxy ? { server: { proxy }, preview: { proxy } } : {}),
  };
});
