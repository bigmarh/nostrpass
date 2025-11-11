// vite.config.ts
import { defineConfig } from "file:///Users/marh/apps/nostrpass.com/node_modules/.pnpm/vite@5.4.19_@types+node@20.19.9_lightningcss@1.30.1/node_modules/vite/dist/node/index.js";
import solid from "file:///Users/marh/apps/nostrpass.com/node_modules/.pnpm/vite-plugin-solid@2.11.8_solid-js@1.9.7_vite@5.4.19_@types+node@20.19.9_lightningcss@1.30.1_/node_modules/vite-plugin-solid/dist/esm/index.mjs";
import tailwindcss from "file:///Users/marh/apps/nostrpass.com/node_modules/.pnpm/@tailwindcss+vite@4.1.11_vite@5.4.19_@types+node@20.19.9_lightningcss@1.30.1_/node_modules/@tailwindcss/vite/dist/index.mjs";
import path from "path";

// vite-plugin-wasm.ts
import fs from "fs";
function wasmPlugin() {
  return {
    name: "vite-plugin-wasm",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.endsWith(".wasm")) {
          res.setHeader("Content-Type", "application/wasm");
        }
        next();
      });
    },
    transformIndexHtml(html) {
      return html.replace(
        "</head>",
        `<script>
          // Ensure WASM MIME type is supported
          if (!WebAssembly.instantiateStreaming) {
            WebAssembly.instantiateStreaming = async (resp, importObject) => {
              const source = await (await resp).arrayBuffer();
              return await WebAssembly.instantiate(source, importObject);
            };
          }
        </script>
        </head>`
      );
    },
    async load(id) {
      if (id.endsWith(".wasm")) {
        const wasmPath = id.replace("?url", "");
        const wasmBuffer = await fs.promises.readFile(wasmPath);
        const base64 = wasmBuffer.toString("base64");
        return `
          const wasmBase64 = "${base64}";
          const wasmBinary = Uint8Array.from(atob(wasmBase64), c => c.charCodeAt(0));
          export default wasmBinary;
        `;
      }
    }
  };
}

// vite.config.ts
var __vite_injected_original_dirname = "/Users/marh/apps/nostrpass.com/apps/vault";
var vite_config_default = defineConfig({
  plugins: [
    tailwindcss(),
    solid(),
    wasmPlugin()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  server: {
    port: 3001,
    host: true
  },
  build: {
    outDir: "dist",
    sourcemap: true
  },
  worker: {
    format: "es",
    plugins: () => [wasmPlugin()]
  },
  optimizeDeps: {
    exclude: ["@nostrpass/worker-messenger"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAidml0ZS1wbHVnaW4td2FzbS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9Vc2Vycy9tYXJoL2FwcHMvbm9zdHJwYXNzLmNvbS9hcHBzL3ZhdWx0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvVXNlcnMvbWFyaC9hcHBzL25vc3RycGFzcy5jb20vYXBwcy92YXVsdC92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvbWFyaC9hcHBzL25vc3RycGFzcy5jb20vYXBwcy92YXVsdC92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IHNvbGlkIGZyb20gJ3ZpdGUtcGx1Z2luLXNvbGlkJztcbmltcG9ydCB0YWlsd2luZGNzcyBmcm9tICdAdGFpbHdpbmRjc3Mvdml0ZSc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IHdhc21QbHVnaW4gfSBmcm9tICcuL3ZpdGUtcGx1Z2luLXdhc20nO1xuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIHRhaWx3aW5kY3NzKCksXG4gICAgc29saWQoKSxcbiAgICB3YXNtUGx1Z2luKCksXG4gIF0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgJ0AnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMnKSxcbiAgICB9LFxuICB9LFxuICBzZXJ2ZXI6IHtcbiAgICBwb3J0OiAzMDAxLFxuICAgIGhvc3Q6IHRydWUsXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgb3V0RGlyOiAnZGlzdCcsXG4gICAgc291cmNlbWFwOiB0cnVlLFxuICB9LFxuICB3b3JrZXI6IHtcbiAgICBmb3JtYXQ6ICdlcycsXG4gICAgcGx1Z2luczogKCkgPT4gW3dhc21QbHVnaW4oKV0sXG4gIH0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGV4Y2x1ZGU6IFsnQG5vc3RycGFzcy93b3JrZXItbWVzc2VuZ2VyJ10sXG4gIH0sXG59KTsgIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvbWFyaC9hcHBzL25vc3RycGFzcy5jb20vYXBwcy92YXVsdFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL21hcmgvYXBwcy9ub3N0cnBhc3MuY29tL2FwcHMvdmF1bHQvdml0ZS1wbHVnaW4td2FzbS50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvbWFyaC9hcHBzL25vc3RycGFzcy5jb20vYXBwcy92YXVsdC92aXRlLXBsdWdpbi13YXNtLnRzXCI7aW1wb3J0IHsgUGx1Z2luIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5cbmV4cG9ydCBmdW5jdGlvbiB3YXNtUGx1Z2luKCk6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogJ3ZpdGUtcGx1Z2luLXdhc20nLFxuICAgIFxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgICAgIGlmIChyZXEudXJsPy5lbmRzV2l0aCgnLndhc20nKSkge1xuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi93YXNtJyk7XG4gICAgICAgIH1cbiAgICAgICAgbmV4dCgpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgICBcbiAgICB0cmFuc2Zvcm1JbmRleEh0bWwoaHRtbCkge1xuICAgICAgLy8gQWRkIFdBU00gTUlNRSB0eXBlIHN1cHBvcnRcbiAgICAgIHJldHVybiBodG1sLnJlcGxhY2UoXG4gICAgICAgICc8L2hlYWQ+JyxcbiAgICAgICAgYDxzY3JpcHQ+XG4gICAgICAgICAgLy8gRW5zdXJlIFdBU00gTUlNRSB0eXBlIGlzIHN1cHBvcnRlZFxuICAgICAgICAgIGlmICghV2ViQXNzZW1ibHkuaW5zdGFudGlhdGVTdHJlYW1pbmcpIHtcbiAgICAgICAgICAgIFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlU3RyZWFtaW5nID0gYXN5bmMgKHJlc3AsIGltcG9ydE9iamVjdCkgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBzb3VyY2UgPSBhd2FpdCAoYXdhaXQgcmVzcCkuYXJyYXlCdWZmZXIoKTtcbiAgICAgICAgICAgICAgcmV0dXJuIGF3YWl0IFdlYkFzc2VtYmx5Lmluc3RhbnRpYXRlKHNvdXJjZSwgaW1wb3J0T2JqZWN0KTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuICAgICAgICA8L3NjcmlwdD5cbiAgICAgICAgPC9oZWFkPmBcbiAgICAgICk7XG4gICAgfSxcbiAgICBcbiAgICBhc3luYyBsb2FkKGlkKSB7XG4gICAgICBpZiAoaWQuZW5kc1dpdGgoJy53YXNtJykpIHtcbiAgICAgICAgY29uc3Qgd2FzbVBhdGggPSBpZC5yZXBsYWNlKCc/dXJsJywgJycpO1xuICAgICAgICBjb25zdCB3YXNtQnVmZmVyID0gYXdhaXQgZnMucHJvbWlzZXMucmVhZEZpbGUod2FzbVBhdGgpO1xuICAgICAgICBjb25zdCBiYXNlNjQgPSB3YXNtQnVmZmVyLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgXG4gICAgICAgIHJldHVybiBgXG4gICAgICAgICAgY29uc3Qgd2FzbUJhc2U2NCA9IFwiJHtiYXNlNjR9XCI7XG4gICAgICAgICAgY29uc3Qgd2FzbUJpbmFyeSA9IFVpbnQ4QXJyYXkuZnJvbShhdG9iKHdhc21CYXNlNjQpLCBjID0+IGMuY2hhckNvZGVBdCgwKSk7XG4gICAgICAgICAgZXhwb3J0IGRlZmF1bHQgd2FzbUJpbmFyeTtcbiAgICAgICAgYDtcbiAgICAgIH1cbiAgICB9LFxuICB9O1xufSJdLAogICJtYXBwaW5ncyI6ICI7QUFBNlMsU0FBUyxvQkFBb0I7QUFDMVUsT0FBTyxXQUFXO0FBQ2xCLE9BQU8saUJBQWlCO0FBQ3hCLE9BQU8sVUFBVTs7O0FDRmpCLE9BQU8sUUFBUTtBQUdSLFNBQVMsYUFBcUI7QUFDbkMsU0FBTztBQUFBLElBQ0wsTUFBTTtBQUFBLElBRU4sZ0JBQWdCLFFBQVE7QUFDdEIsYUFBTyxZQUFZLElBQUksQ0FBQyxLQUFLLEtBQUssU0FBUztBQUN6QyxZQUFJLElBQUksS0FBSyxTQUFTLE9BQU8sR0FBRztBQUM5QixjQUFJLFVBQVUsZ0JBQWdCLGtCQUFrQjtBQUFBLFFBQ2xEO0FBQ0EsYUFBSztBQUFBLE1BQ1AsQ0FBQztBQUFBLElBQ0g7QUFBQSxJQUVBLG1CQUFtQixNQUFNO0FBRXZCLGFBQU8sS0FBSztBQUFBLFFBQ1Y7QUFBQSxRQUNBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFVRjtBQUFBLElBQ0Y7QUFBQSxJQUVBLE1BQU0sS0FBSyxJQUFJO0FBQ2IsVUFBSSxHQUFHLFNBQVMsT0FBTyxHQUFHO0FBQ3hCLGNBQU0sV0FBVyxHQUFHLFFBQVEsUUFBUSxFQUFFO0FBQ3RDLGNBQU0sYUFBYSxNQUFNLEdBQUcsU0FBUyxTQUFTLFFBQVE7QUFDdEQsY0FBTSxTQUFTLFdBQVcsU0FBUyxRQUFRO0FBRTNDLGVBQU87QUFBQSxnQ0FDaUIsTUFBTTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BSWhDO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRjs7O0FEaERBLElBQU0sbUNBQW1DO0FBT3pDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLFlBQVk7QUFBQSxJQUNaLE1BQU07QUFBQSxJQUNOLFdBQVc7QUFBQSxFQUNiO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsRUFDUjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsV0FBVztBQUFBLEVBQ2I7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLFFBQVE7QUFBQSxJQUNSLFNBQVMsTUFBTSxDQUFDLFdBQVcsQ0FBQztBQUFBLEVBQzlCO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsNkJBQTZCO0FBQUEsRUFDekM7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
