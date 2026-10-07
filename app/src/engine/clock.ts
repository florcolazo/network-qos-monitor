// RN expone `performance.now()` (reloj monotónico de alta resolución) pero sus
// tipos no lo declaran. Se usa Date.now() como respaldo.
declare const performance: { now(): number } | undefined;

export const now = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();
