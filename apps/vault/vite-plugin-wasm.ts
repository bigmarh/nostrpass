import { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';

export function wasmPlugin(): Plugin {
  return {
    name: 'vite-plugin-wasm',
    
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.endsWith('.wasm')) {
          res.setHeader('Content-Type', 'application/wasm');
        }
        next();
      });
    },
    
    transformIndexHtml(html) {
      // Add WASM MIME type support
      return html.replace(
        '</head>',
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
      if (id.endsWith('.wasm')) {
        const wasmPath = id.replace('?url', '');
        const wasmBuffer = await fs.promises.readFile(wasmPath);
        const base64 = wasmBuffer.toString('base64');
        
        return `
          const wasmBase64 = "${base64}";
          const wasmBinary = Uint8Array.from(atob(wasmBase64), c => c.charCodeAt(0));
          export default wasmBinary;
        `;
      }
    },
  };
}