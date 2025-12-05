import { Plugin } from 'vite';
import fs from 'fs/promises';
import path from 'path';
import { build } from 'vite';

export function serviceWorkerPlugin(): Plugin {
  let config: any;
  let buildWatcher: any;

  return {
    name: 'service-worker-plugin',

    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    async buildStart() {
      if (config.command === 'serve') {
        // Build service worker in dev mode
        await buildServiceWorker(config.root);
      }
    },

    configureServer(server) {
      // Watch for changes to service-worker.ts and rebuild
      server.watcher.add(path.resolve(config.root, 'src/service-worker.ts'));

      server.watcher.on('change', async (file) => {
        if (file.endsWith('service-worker.ts')) {
          console.log('[service-worker-plugin] Rebuilding service worker...');
          await buildServiceWorker(config.root);
          console.log('[service-worker-plugin] Service worker rebuilt');
        }
      });

      // Serve the built service worker file
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/service-worker.js' || req.url === '/service-worker.js.map') {
          const fileName = req.url.slice(1); // remove leading /
          const filePath = path.resolve(config.root, 'dist', fileName);

          try {
            const content = await fs.readFile(filePath);
            const contentType = fileName.endsWith('.map')
              ? 'application/json'
              : 'application/javascript';

            res.setHeader('Content-Type', contentType);
            res.setHeader('Service-Worker-Allowed', '/');
            res.end(content);
          } catch (error) {
            next();
          }
        } else {
          next();
        }
      });
    }
  };
}

async function buildServiceWorker(root: string) {
  await build({
    root,
    configFile: false,
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      sourcemap: true,
      lib: {
        entry: path.resolve(root, 'src/service-worker.ts'),
        formats: ['es'],
        fileName: () => 'service-worker.js'
      },
      rollupOptions: {
        output: {
          entryFileNames: 'service-worker.js'
        }
      }
    },
    logLevel: 'warn'
  });
}
