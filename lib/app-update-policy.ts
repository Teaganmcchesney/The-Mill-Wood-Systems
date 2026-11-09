export const UPDATE_POLL_MS = 60000;
export const UPDATE_IDLE_MS = 15000;
export const UPDATE_CONFIRM_MS = 2000;
export const UPDATE_RETRY_MS = 300000;
export type ReleaseState = {
  version: string | null;
  observations: number;
  firstSeen: number;
  lastSeen: number;
};
export const emptyRelease = (): ReleaseState => ({
  version: null,
  observations: 0,
  firstSeen: 0,
  lastSeen: 0,
});
export function observeRelease(
  current: string,
  state: ReleaseState,
  value: unknown,
  now: number,
): ReleaseState {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > 128 ||
    !/^[a-zA-Z0-9._-]+$/.test(value)
  )
    return state;
  if (value === current) return emptyRelease();
  return value === state.version
    ? { ...state, observations: state.observations + 1, lastSeen: now }
    : { version: value, observations: 1, firstSeen: now, lastSeen: now };
}
export function canApplyRelease(
  state: ReleaseState,
  context: {
    now: number;
    lastInteraction: number;
    online: boolean;
    visible: boolean;
    focused: boolean;
    blocked: boolean;
    pointerDown: boolean;
  },
) {
  return (
    !!state.version &&
    state.observations >= 2 &&
    context.now - state.firstSeen >= UPDATE_CONFIRM_MS &&
    context.now - state.lastSeen <= 90000 &&
    context.now - context.lastInteraction >= UPDATE_IDLE_MS &&
    context.online &&
    context.visible &&
    context.focused &&
    !context.blocked &&
    !context.pointerDown
  );
}
export function recentlyAttempted(
  raw: string | null,
  current: string,
  target: string,
  now: number,
) {
  try {
    const value = JSON.parse(raw ?? "null");
    return (
      value?.from === current &&
      value?.to === target &&
      Number.isFinite(value.at) &&
      now >= value.at &&
      now - value.at < UPDATE_RETRY_MS
    );
  } catch {
    return false;
  }
}
