// src/scan/ScanOrchestrator.ts — máquina de estados del flujo (PLAN_MAESTRO §3 UI).
//
// TODO (F2/F3): FSM idle → detecting → capturing → revalidating → editing,
// disparo auto (score>0.8 sostenido 300ms + burst-rank) + shutter manual SIEMPRE
// visible + timeout 8s ("Activa la captura manual o mejora la iluminación").
// Sin implementación en T2.
export const SCAN_ORCHESTRATOR_TODO =
  'FSM + burst-rank + timeout 8s — F2/F3, PLAN_MAESTRO §5-F2/F3' as const;