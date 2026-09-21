import path from 'node:path';
import type { Plugin } from 'vite';

export function deploymentAssets(deploymentId: string | undefined): Plugin {
  return {
    name: 'deployment-assets',
    apply: 'build',
    enforce: 'post',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        if (!deploymentId || !/^dpl_[a-zA-Z0-9]+$/.test(deploymentId)) return;
        const files = new Set(Object.keys(bundle).filter(name => name.startsWith('assets/')));
        const pin = (source: string, owner: string) => source.replace(/(["'])([^"'\\\r\n]+)\1/g, (original, quote: string, url: string) => {
          if (url.includes('?') || url.includes('#') || url.includes(':')) return original;
          const relative = path.posix.normalize(path.posix.join(path.posix.dirname(owner), url));
          const target = url.startsWith('/') ? url.slice(1) : files.has(url) ? url : relative;
          return files.has(target) ? `${quote}${url}?dpl=${deploymentId}${quote}` : original;
        });
        for (const output of Object.values(bundle)) {
          if (output.type === 'chunk') {
            output.code = pin(output.code, output.fileName);
            // Vite's preload helper must recognize CSS after the deployment query is appended.
            if (output.code.includes('vite:preloadError')) {
              output.code = output.code.replace(/\.endsWith\((["'])\.css\1\)/g,
                '.split(/[?#]/, 1)[0].endsWith(".css")');
            }
          }
          else if (output.fileName.endsWith('.html') && typeof output.source === 'string') {
            output.source = pin(output.source, output.fileName);
          }
        }
      },
    },
  };
}
