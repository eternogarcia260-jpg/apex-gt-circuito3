/**
 * uiAssetPreloader.ts
 * High-performance background preloader and GPU texture pre-warmer for UI assets.
 * Preloads, caches, and decodes all menu images asynchronously to prevent any
 * rendering latency, pop-in, or frame drops across game screens.
 */

export const CRITICAL_UI_IMAGES = [
  // Screen 2 (Root 2x2 Modes View)
  '/images/dashboard_bg.webp',
  '/images/cards/card_career.webp',
  '/images/cards/card_free.webp',
  '/images/cards/card_multiplayer.webp',
  '/images/cards/card_grandprix.webp',

  // Screen 3 (Paddock Operations View)
  '/images/screen3_bg.webp',
  '/images/cards/btn_circuit.webp',
  '/images/cards/btn_tire.webp',
  '/images/cards/btn_laps.webp',
  '/images/cards/btn_livery.webp',
  '/images/cards/btn_helmet.webp',
  '/images/cards/btn_number.webp',
  '/images/cards/btn_sponsors.webp',
  '/images/cards/btn_suit.webp',
];

// In-memory HTMLImageElement cache to keep images decoded in memory
const imageMemoryCache = new Map<string, HTMLImageElement>();
let preloadPromise: Promise<void> | null = null;
let isFullyLoaded = false;
let currentProgress = 0; // 0 to 100

export type PreloadProgressCallback = (percent: number, loadedCount: number, totalCount: number) => void;
const listeners = new Set<PreloadProgressCallback>();

export function getUiPreloadProgress(): number {
  return currentProgress;
}

export function isUiPreloaded(): boolean {
  return isFullyLoaded;
}

export function onUiPreloadProgress(cb: PreloadProgressCallback): () => void {
  listeners.add(cb);
  cb(currentProgress, Math.round((currentProgress / 100) * CRITICAL_UI_IMAGES.length), CRITICAL_UI_IMAGES.length);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Preloads and decodes a single image into memory.
 */
function preloadSingleImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    if (imageMemoryCache.has(url)) {
      resolve();
      return;
    }

    const img = new Image();
    img.src = url;

    if (typeof img.decode === 'function') {
      img
        .decode()
        .then(() => {
          imageMemoryCache.set(url, img);
          resolve();
        })
        .catch(() => {
          imageMemoryCache.set(url, img);
          resolve();
        });
    } else {
      (img as HTMLImageElement).onload = () => {
        imageMemoryCache.set(url, img);
        resolve();
      };
      (img as HTMLImageElement).onerror = () => resolve();
    }
  });
}

/**
 * Initiates the parallel preload and decoding of all critical UI images.
 */
export function preloadUiAssets(): Promise<void> {
  if (preloadPromise) {
    return preloadPromise;
  }

  const total = CRITICAL_UI_IMAGES.length;
  let loaded = 0;

  preloadPromise = Promise.all(
    CRITICAL_UI_IMAGES.map((url) =>
      preloadSingleImage(url).then(() => {
        loaded++;
        currentProgress = Math.round((loaded / total) * 100);
        listeners.forEach((fn) => fn(currentProgress, loaded, total));
      })
    )
  ).then(() => {
    isFullyLoaded = true;
    currentProgress = 100;
    listeners.forEach((fn) => fn(100, total, total));
  });

  return preloadPromise;
}
