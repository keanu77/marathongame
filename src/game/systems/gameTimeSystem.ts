function normalizeMilliseconds(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Advances a remaining-duration timer only while game time is running. This
 * avoids absolute-clock deadlines expiring during a custom pause state.
 */
export function advanceRemainingGameTimeMs(
  remainingMs: number,
  deltaMs: number,
  gameTimeIsRunning: boolean,
  activatedThisFrame = false,
): number {
  const safeRemainingMs = normalizeMilliseconds(remainingMs);
  if (!gameTimeIsRunning || activatedThisFrame) return safeRemainingMs;

  return Math.max(0, safeRemainingMs - normalizeMilliseconds(deltaMs));
}
