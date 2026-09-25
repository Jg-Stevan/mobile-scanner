// tests/pageStore.test.ts — almacén multipágina (§5-F5) con un FAKE IDB
// in-memory (IndexedDB no existe en Node): add/reorder/remove/export/cuota.
// El DOM real (openPageDB) se cubre en el E2E del harness con IDB de verdad.

import { describe, expect, it } from 'vitest';
import { PDF_SIZE_LIMIT_BYTES, PageStore } from '../src/export/pageStore';

// --- fake IDB mínimo (API usada por PageStore: txDone/reqAs) ---

interface Rec {
  id: string;
  order: number;
}

class FakeReq<T> {
  private _result: T;
  private _onsuccess: (() => void) | null = null;
  private _onerror: (() => void) | null = null;
  constructor(exec: () => T) {
    this._result = exec();
  }
  get result(): T {
    return this._result;
  }
  set onsuccess(f: (() => void) | null) {
    this._onsuccess = f;
    if (f !== null) queueMicrotask(f);
  }
  get onsuccess(): (() => void) | null {
    return this._onsuccess;
  }
  set onerror(f: (() => void) | null) {
    this._onerror = f;
  }
  get onerror(): (() => void) | null {
    return this._onerror;
  }
}

class FakeStore {
  private map = new Map<string, Rec>();
  get(id: string): FakeReq<Rec | undefined> {
    return new FakeReq(() => this.map.get(id));
  }
  getAll(): FakeReq<Rec[]> {
    return new FakeReq(() => [...this.map.values()]);
  }
  count(): FakeReq<number> {
    return new FakeReq(() => this.map.size);
  }
  put(rec: Rec): FakeReq<undefined> {
    return new FakeReq(() => {
      this.map.set(rec.id, rec);
      return undefined;
    });
  }
  delete(id: string): FakeReq<undefined> {
    return new FakeReq(() => {
      this.map.delete(id);
      return undefined;
    });
  }
  clear(): FakeReq<undefined> {
    return new FakeReq(() => {
      this.map.clear();
      return undefined;
    });
  }
}

class FakeTx {
  private store: FakeStore;
  private _oncomplete: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  constructor(store: FakeStore) {
    this.store = store;
  }
  // Real IDB: oncomplete se dispara cuando TODAS las peticiones de la tx
  // terminaron — como el fake las ejecuta síncronamente, dispararlo al
  // asignar el handler equivale a "completó". Con microtask para no resolver
  // dentro del attach.
  set oncomplete(f: (() => void) | null) {
    this._oncomplete = f;
    if (f !== null) queueMicrotask(f);
  }
  get oncomplete(): (() => void) | null {
    return this._oncomplete;
  }
  objectStore(): FakeStore {
    return this.store;
  }
}

class FakeIDB {
  constructor(private readonly store: FakeStore) {}
  transaction(): FakeTx {
    return new FakeTx(this.store);
  }
}

function setup(opts: { estimate?: () => Promise<{ usage: number; quota: number } | null> } = {}) {
  const store = new FakeStore();
  const idb = new FakeIDB(store) as unknown as IDBDatabase;
  const ps = new PageStore(idb, {
    makeId: (() => {
      let i = 0;
      return () => `id-${i++}`;
    })(),
    encode: async (pages) => new Blob([`pdf:${pages.length}`], { type: 'application/pdf' }),
    estimate: opts.estimate ?? (async () => null),
  });
  return { ps, store };
}

describe('PageStore (fake IDB)', () => {
  it('addPage encola al final (order = max+1)', async () => {
    const { ps } = setup();
    await ps.addPage(new Blob([]), 'color', 1);
    await ps.addPage(new Blob([]), 'bw', 2);
    const pages = await ps.pages();
    expect(pages.map((p) => p.order)).toEqual([0, 1]);
    expect(pages[0]!.mode).toBe('color');
    expect(pages[1]!.mode).toBe('bw');
    expect(await ps.count()).toBe(2);
  });

  it('reorder mueve (0→2) y persiste los índices', async () => {
    const { ps } = setup();
    await ps.addPage(new Blob([]), 'color', 1); // id-0
    await ps.addPage(new Blob([]), 'color', 2); // id-1
    await ps.addPage(new Blob([]), 'color', 3); // id-2
    await ps.reorder('id-0', 2);
    const pages = await ps.pages();
    expect(pages.map((p) => p.id)).toEqual(['id-1', 'id-2', 'id-0']);
    expect(pages.map((p) => p.order)).toEqual([0, 1, 2]);
    // idempotente: mismo destino → sin cambios
    await ps.reorder('id-0', 2);
    expect((await ps.pages()).map((p) => p.id)).toEqual(['id-1', 'id-2', 'id-0']);
  });

  it('reorder con id desconocido o índice fuera de rango no rompe', async () => {
    const { ps } = setup();
    await ps.addPage(new Blob([]), 'color', 1);
    await ps.addPage(new Blob([]), 'color', 2);
    await ps.reorder('no-existe', 0);
    await ps.reorder('id-0', 99); // clamp al final
    const pages = await ps.pages();
    expect(pages.map((p) => p.id)).toEqual(['id-1', 'id-0']);
  });

  it('remove elimina (el drag/applyOrder normaliza índices después)', async () => {
    const { ps } = setup();
    await ps.addPage(new Blob([]), 'color', 1);
    await ps.addPage(new Blob([]), 'bw', 2);
    await ps.addPage(new Blob([]), 'gray', 3);
    await ps.remove('id-1');
    const pages = await ps.pages();
    // El ORDEN de ids es el invariante; addPage sigue con max+1.
    expect(pages.map((p) => p.id)).toEqual(['id-0', 'id-2']);
    expect(pages.map((p) => p.order)).toEqual([0, 2]);
  });

  it('exportPdf: null sin páginas, blob con páginas (encode inyectado)', async () => {
    const { ps } = setup();
    expect(await ps.exportPdf()).toBeNull();
    const stored = await ps.addPage(new Blob([]), 'color', 1);
    const pdf = await ps.exportPdf({ a4: true });
    expect(pdf).not.toBeNull();
    expect(pdf!.type).toBe('application/pdf');
    expect(await pdf!.text()).toBe('pdf:1');

    const override = { ...stored, blob: new Blob(['processed']), mode: 'bw' as const };
    expect(await (await ps.exportPdf({ pages: [override] }))!.text()).toBe('pdf:1');
  });

  it('quota: >70% → warn (reutiliza quotaReport 0.7 del core)', async () => {
    const { ps } = setup({
      estimate: async () => ({ usage: 80, quota: 100 }),
    });
    const q = await ps.quota();
    expect(q.warn).toBe(true);
    expect(q.pct).toBe(0.8); // quotaReport devuelve fracción (80/100)
  });

  it('quota: sin estimador → pct null, sin warn', async () => {
    const { ps } = setup();
    const q = await ps.quota();
    expect(q).toEqual({ pct: null, warn: false });
  });

  it('techo de PDF = 8MB (meta física del plan)', () => {
    expect(PDF_SIZE_LIMIT_BYTES).toBe(8 * 1024 * 1024);
  });
});