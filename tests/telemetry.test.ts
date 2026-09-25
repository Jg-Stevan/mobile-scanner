// tests/telemetry.test.ts — F6.3: núcleo puro de la telemetría opt-in
// (parseo DSN, redacción, envelope Sentry, opt-in, rate limit, sin-DSN local).
import { describe, expect, it } from 'vitest';

import {
  TELEMETRY_KEY_DSN,
  TELEMETRY_KEY_ENABLED,
  TELEMETRY_MAX_EVENTS,
  buildEnvelope,
  createTelemetry,
  parseDsn,
  redactMessage,
} from '../src/telemetry/telemetry';

describe('parseDsn', () => {
  it('parsea un DSN Sentry estándar y deriva la URL de envelope', () => {
    const dsn = parseDsn('https://abc123@o0.ingest.sentry.io/450123');
    expect(dsn).not.toBeNull();
    expect(dsn!.publicKey).toBe('abc123');
    expect(dsn!.projectId).toBe('450123');
    expect(dsn!.envelopeUrl).toBe('https://o0.ingest.sentry.io/api/450123/envelope/');
  });

  it('rechaza http (solo https), formatos incompletos y vacíos', () => {
    expect(parseDsn('http://abc@host/1')).toBeNull();
    expect(parseDsn('https://host/1')).toBeNull(); // sin publicKey
    expect(parseDsn('https://abc@host/no-numero')).toBeNull();
    expect(parseDsn('')).toBeNull();
    expect(parseDsn('   ')).toBeNull();
  });
});

describe('redactMessage', () => {
  it('quita query strings de URLs dentro del mensaje', () => {
    const out = redactMessage('fetch falló: https://x.example/api?token=secreto&x=1 fin');
    expect(out).toBe('fetch falló: https://x.example/api?… fin');
    expect(out).not.toContain('token');
  });

  it('enmascara blob: y file:// y trunca mensajes largos', () => {
    expect(redactMessage('video blob:https://a/bc-de-fg muerto')).toContain('blob:…');
    expect(redactMessage('ruta file:///C:/Users/juan/foto.jpg')).not.toContain('juan');
    const long = redactMessage('x'.repeat(500));
    expect(long.length).toBeLessThanOrEqual(301);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('createTelemetry — opt-in', () => {
  it('OFF por defecto: captura en memoria pero NUNCA llama a send', () => {
    let sends = 0;
    const t = createTelemetry({ send: () => void ++sends });
    t.captureError(new Error('prueba'));
    t.captureMessage('prueba 2');
    expect(t.isEnabled()).toBe(false);
    expect(t.snapshot()).toMatchObject({ enabled: false, captured: 2, sent: 0 });
    expect(sends).toBe(0);
  });

  it('enable() persiste el opt-in y a partir de ahí envía', () => {
    const store = new Map<string, string>([[TELEMETRY_KEY_DSN, 'https://pk@o.ingest.sentry.io/4509']]);
    const bodies: string[] = [];
    const t = createTelemetry({
      readStore: (k) => store.get(k) ?? null,
      writeStore: (k, v) => void store.set(k, v),
      send: (body) => void bodies.push(body),
      uuid: () => 'uuid-fijo',
      now: () => 1_700_000_000_000,
    });
    t.enable();
    expect(store.get(TELEMETRY_KEY_ENABLED)).toBe('1');
    t.captureError(new Error('boom'));
    expect(bodies.length).toBe(1);
    const [header, payload] = bodies[0]!.trim().split('\n');
    expect(JSON.parse(header!)).toMatchObject({ event_id: 'uuid-fijo' });
    const p = JSON.parse(payload!) as Record<string, unknown>;
    expect(p).toMatchObject({ platform: 'javascript', level: 'error', message: 'boom' });
  });

  it('respeta el opt-in persistido previamente (arranca ON)', () => {
    const t = createTelemetry({ readStore: (k) => (k === TELEMETRY_KEY_ENABLED ? '1' : null) });
    expect(t.isEnabled()).toBe(true);
  });
});

describe('createTelemetry — sin DSN configurado', () => {
  it('con opt-in y sin DSN: cuenta localmente y no sale nada del dispositivo', () => {
    let sends = 0;
    const t = createTelemetry({ send: () => void ++sends, readStore: (k) => (k === TELEMETRY_KEY_ENABLED ? '1' : null) });
    t.captureMessage('local only');
    const s = t.snapshot();
    expect(s).toMatchObject({ enabled: true, hasDsn: false, captured: 1, sent: 0 });
    expect(sends).toBe(0);
  });
});

describe('createTelemetry — rate limit anti-bucle', () => {
  it('envía como máximo TELEMETRY_MAX_EVENTS y el resto cuenta como descartados', () => {
    let sends = 0;
    const t = createTelemetry({
      send: () => void ++sends,
      readStore: (k) =>
        k === TELEMETRY_KEY_ENABLED ? '1' : k === TELEMETRY_KEY_DSN ? 'https://pk@o.ingest.sentry.io/4509' : null,
      uuid: () => 'u',
    });
    for (let i = 0; i < TELEMETRY_MAX_EVENTS + 7; i += 1) t.captureMessage(`e${i}`);
    const s = t.snapshot();
    expect(s.captured).toBe(TELEMETRY_MAX_EVENTS + 7);
    expect(sends).toBe(TELEMETRY_MAX_EVENTS);
    expect(s.dropped).toBe(7);
    // el anillo local conserva los ÚLTIMOS MAX para depuración
  });
});

describe('buildEnvelope', () => {
  it('formato envelope: línea 1 header JSON, línea 2 payload con level/message', () => {
    const { eventId, body } = buildEnvelope(
      { kind: 'error', message: 'fallo', ts: 1_700_000_000_000 },
      { environment: 'harness', release: 'mscan 0.1.0' },
      () => 'evt-1',
    );
    expect(eventId).toBe('evt-1');
    const [header, payload] = body.trim().split('\n');
    expect(JSON.parse(header!)).toMatchObject({ event_id: 'evt-1' });
    const p = JSON.parse(payload!) as Record<string, unknown>;
    expect(p.message).toBe('fallo');
    expect(p.environment).toBe('harness');
  });

  it('incluye stack redactado como exception cuando existe', () => {
    const { body } = buildEnvelope(
      { kind: 'error', message: 'fallo', stack: 'at https://x/y.js?a=1:1:1', ts: 0 },
      { environment: 'harness', release: 'r' },
      () => 'u',
    );
    expect(body).toContain('stacktrace');
    expect(body).toContain('?…');
  });
});
