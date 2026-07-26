import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    // Only active while running the Vite dev server (`make frontend`, :5173).
    // Any request the browser makes to a path starting with /api (e.g.
    // axios calling "/api/simulations" in client.ts) gets silently forwarded
    // to the FastAPI backend at localhost:8000 instead of Vite trying to
    // serve it as a frontend file. This is why the browser only ever sees
    // one origin (5173) and no CORS setup is needed locally.
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
