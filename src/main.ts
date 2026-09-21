// src/main.ts — punto de entrada SPA (§8 · PLAN_MAESTRO §3: hilo principal).
// TODO (F1): montar ScannerView (UI vanilla) cuando exista.

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('No se encontró #app');
const p = document.createElement('p');
p.textContent = 'aplicación en construcción';
app.append(p);
