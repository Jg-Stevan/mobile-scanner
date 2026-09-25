// tests/cameraErrors.test.ts — F6.4: clasificación de errores de cámara para
// la UI (título + pista accionable + código). PURE: sin DOM.
import { describe, expect, it } from 'vitest';

import { classifyCameraError } from '../src/camera/cameraErrors';

describe('classifyCameraError — por err.name', () => {
  it('NotAllowedError → permission, con pista de ajustes y reintentable', () => {
    const info = classifyCameraError(new DOMException('denied', 'NotAllowedError'));
    expect(info.code).toBe('permission');
    expect(info.title).toMatch(/Permiso/);
    expect(info.hint).toMatch(/ajustes|navegador/i);
    expect(info.retryable).toBe(true);
  });
  it('alias PermissionDeniedError y SecurityError → permission', () => {
    expect(classifyCameraError(new DOMException('x', 'PermissionDeniedError')).code).toBe('permission');
    expect(classifyCameraError(new DOMException('x', 'SecurityError')).code).toBe('permission');
  });
  it('NotFoundError y DevicesNotFoundError → no-device, NO reintentable', () => {
    expect(classifyCameraError(new DOMException('x', 'NotFoundError')).code).toBe('no-device');
    expect(classifyCameraError(new DOMException('x', 'DevicesNotFoundError')).code).toBe('no-device');
    expect(classifyCameraError(new DOMException('x', 'NotFoundError')).retryable).toBe(false);
  });
  it('NotReadableError y TrackStartError → busy (cámara ocupada)', () => {
    expect(classifyCameraError(new DOMException('in use', 'NotReadableError')).code).toBe('busy');
    expect(classifyCameraError(new DOMException('x', 'TrackStartError')).code).toBe('busy');
    expect(classifyCameraError(new DOMException('x', 'NotReadableError')).retryable).toBe(true);
  });
  it('OverconstrainedError → overconstrained (la cascada reintenta)', () => {
    expect(classifyCameraError(new DOMException('x', 'OverconstrainedError')).code).toBe('overconstrained');
  });
  it('NotSupportedError → unsupported; AbortError → busy (hardware abortó)', () => {
    expect(classifyCameraError(new DOMException('x', 'NotSupportedError')).code).toBe('unsupported');
    expect(classifyCameraError(new DOMException('x', 'AbortError')).code).toBe('busy');
  });
});

describe('classifyCameraError — por mensaje (errores envueltos)', () => {
  it('nombre dentro del string de la cascada "3 niveles"', () => {
    const wrapped = new Error('getUserMedia falló en 3 niveles: NotAllowedError: Permission denied');
    expect(classifyCameraError(wrapped).code).toBe('permission');
  });
  it('NotReadable textual del navegador', () => {
    const wrapped = new Error('getUserMedia falló en 3 niveles: NotReadableError: Could not start video source');
    expect(classifyCameraError(wrapped).code).toBe('busy');
  });
  it('"sin cámaras videoinput disponibles" (CameraController) → no-device', () => {
    expect(classifyCameraError(new Error('sin cámaras videoinput disponibles')).code).toBe('no-device');
  });
  it('contexto no seguro (mediaDevices undefined) → unsupported', () => {
    expect(classifyCameraError(new Error('Cannot read properties of undefined (reading getUserMedia)')).code).toBe('unsupported');
  });
});

describe('classifyCameraError — robustez', () => {
  it('string plano, objeto raro, undefined y números → unknown, nunca lanza', () => {
    expect(classifyCameraError('algo raro').code).toBe('unknown');
    expect(classifyCameraError({ name: 'CosaRara', message: 'nada útil' }).code).toBe('unknown');
    expect(classifyCameraError(undefined).code).toBe('unknown');
    expect(classifyCameraError(42).code).toBe('unknown');
    expect(classifyCameraError(null).code).toBe('unknown');
  });
  it('siempre devuelve título y hint no vacíos', () => {
    for (const e of [undefined, new Error('x'), new DOMException('y', 'NotAllowedError')]) {
      const info = classifyCameraError(e);
      expect(info.title.length).toBeGreaterThan(0);
      expect(info.hint.length).toBeGreaterThan(0);
    }
  });
});
