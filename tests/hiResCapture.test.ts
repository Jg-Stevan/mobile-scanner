// tests/hiResCapture.test.ts — rutas A/B/C con fakes (T5). Sin navegador:
// ImageCapture/decoder/canvas/now inyectados. El EXIF from-image real se
// verifica en Playwright (necesita decodificador JPEG).
import { describe, expect, it, vi } from 'vitest';

import type { CaptureDeps } from '../src/camera/hiResCapture';
import {
  ROUTE_B_JPEG_QUALITY,
  RouteUnsupportedError,
  captureFrame,
  capturePhoto,
  filesToBitmaps,
} from '../src/camera/hiResCapture';

const BITMAP = { width: 3000, height: 4000 } as ImageBitmap;

function baseDeps(over: Partial<CaptureDeps> = {}): CaptureDeps {
  return {
    decode: async () => BITMAP,
    createCanvas: () => {
      throw new Error('no usado');
    },
    now: (() => {
      let t = 1000;
      return () => (t += 10);
    })(),
    ...over,
  };
}

describe('ruta A (takePhoto)', () => {
  it('sin ImageCapture → RouteUnsupportedError (típico iOS)', async () => {
    await expect(
      capturePhoto({} as MediaStreamTrack, baseDeps({ ImageCaptureCtor: undefined })),
    ).rejects.toThrow(RouteUnsupportedError);
  });
  it('takePhoto → blob → bitmap con dims y latencia', async () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    const takePhoto = vi.fn(async () => blob);
    const decode = vi.fn(async () => BITMAP);
    const r = await capturePhoto(
      {} as MediaStreamTrack,
      baseDeps({
        ImageCaptureCtor: class {
          takePhoto = takePhoto;
        } as unknown as CaptureDeps['ImageCaptureCtor'],
        decode,
      }),
    );
    expect(takePhoto).toHaveBeenCalledTimes(1);
    expect(decode).toHaveBeenCalledWith(blob, { imageOrientation: 'from-image' });
    expect(r).toMatchObject({ route: 'A', w: 3000, h: 4000 });
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

describe('ruta B (drawImage)', () => {
  it('canvas nativo + JPEG q92 + dims del bitmap', async () => {
    const drawImage = vi.fn();
    const toBlobCalls: unknown[] = [];
    const fakeCanvas = {
      getContext: () => ({ drawImage }),
      toBlob: (cb: (b: Blob | null) => void, type?: string, quality?: number) => {
        toBlobCalls.push([type, quality]);
        cb(new Blob(['y'], { type: 'image/jpeg' }));
      },
    };
    const seenFactory: unknown[] = [];
    const r = await captureFrame(
      {} as HTMLVideoElement,
      2160,
      3840,
      baseDeps({
        createCanvas: ((w: number, h: number) => {
          seenFactory.push([w, h]);
          return fakeCanvas;
        }) as unknown as CaptureDeps['createCanvas'],
      }),
    );
    expect(seenFactory).toEqual([[2160, 3840]]);
    expect(drawImage).toHaveBeenCalledWith({}, 0, 0, 2160, 3840);
    expect(toBlobCalls).toEqual([['image/jpeg', ROUTE_B_JPEG_QUALITY]]);
    expect(ROUTE_B_JPEG_QUALITY).toBe(0.92);
    expect(r).toMatchObject({ route: 'B', w: 3000, h: 4000 });
  });
  it('contexto 2d null → throw', async () => {
    await expect(
      captureFrame(
        {} as HTMLVideoElement,
        10,
        10,
        baseDeps({
          createCanvas: (() => ({
            getContext: () => null,
            toBlob: () => {},
          })) as unknown as CaptureDeps['createCanvas'],
        }),
      ),
    ).rejects.toThrow(/2d null/);
  });
  it('usa document.createElement cuando no se inyecta factory', async () => {
    const drawImage = vi.fn();
    const fakeCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toBlob: (cb: (b: Blob | null) => void) => {
        cb(new Blob(['y'], { type: 'image/jpeg' }));
      },
    };
    vi.stubGlobal('document', { createElement: vi.fn(() => fakeCanvas) });
    const r = await captureFrame({} as HTMLVideoElement, 640, 480, {
      decode: async () => BITMAP,
      now: () => 0,
    });
    expect(document.createElement).toHaveBeenCalledWith('canvas');
    expect(fakeCanvas.width).toBe(640);
    expect(r.route).toBe('B');
    vi.unstubAllGlobals();
  });
});

describe('ruta C (files → bitmaps)', () => {
  it('cada file se decodifica from-image con su latencia', async () => {
    const decode = vi.fn(async () => BITMAP);
    const files = [new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg')];
    const res = await filesToBitmaps(files, baseDeps({ decode }));
    expect(res).toHaveLength(2);
    expect(decode).toHaveBeenCalledTimes(2);
    expect(decode.mock.calls[0]).toEqual([files[0], { imageOrientation: 'from-image' }]);
    expect(res[0]).toMatchObject({ route: 'C', w: 3000, h: 4000 });
  });
  it('decoder sin soporte from-image → fallback sin opción', async () => {
    let calls = 0;
    const decode = async (blob: Blob, options?: ImageBitmapOptions): Promise<ImageBitmap> => {
      calls++;
      if (options !== undefined) throw new TypeError('opción no soportada');
      void blob;
      return BITMAP;
    };
    const res = await filesToBitmaps([new File(['a'], 'a.jpg')], baseDeps({ decode }));
    expect(calls).toBe(2);
    expect(res[0]!.bitmap).toBe(BITMAP);
  });
});
