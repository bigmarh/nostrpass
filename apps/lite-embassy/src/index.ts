import {
  NostrPassLiteEmbassy,
  type LiteEmbassyConfig,
} from './liteEmbassy';

let singletonEmbassy: NostrPassLiteEmbassy | null = null;

export async function initNostrPassLite(
  config: LiteEmbassyConfig = {},
  options: { forceNewInstance?: boolean } = {}
): Promise<NostrPassLiteEmbassy> {
  if (!options.forceNewInstance && singletonEmbassy) {
    return singletonEmbassy;
  }

  const embassy = new NostrPassLiteEmbassy(config);
  await embassy.initialize();
  singletonEmbassy = embassy;

  if (typeof window !== 'undefined') {
    window.nostrPassLite = embassy;
  }

  return embassy;
}

export * from './liteEmbassy';

declare global {
  interface Window {
    initNostrPassLite: (
      config?: LiteEmbassyConfig,
      options?: { forceNewInstance?: boolean }
    ) => Promise<NostrPassLiteEmbassy>;
    nostrPassLite?: NostrPassLiteEmbassy;
  }
}

if (typeof window !== 'undefined') {
  window.initNostrPassLite = initNostrPassLite;
}
