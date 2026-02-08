export type PresageEvent = {
  ts: number;
  face_present: boolean;
  gaze: "on_screen" | "away";
  confusion: number;
};

export type SessionState = {
  startedAt: number;
  lastEventTs?: number;
  focusedMs: number;
  lookAwayCount: number;
  lastGaze?: "on_screen" | "away";
  awayStartedAt?: number;
  confusionTriggers: number;
  questions: { ts: number; q: string }[];
};

const sessions = new Map<string, SessionState>();

export function getSession(socketId: string) {
  if (!sessions.has(socketId)) {
    sessions.set(socketId, {
      startedAt: Date.now(),
      focusedMs: 0,
      lookAwayCount: 0,
      confusionTriggers: 0,
      questions: []
    });
  }
  return sessions.get(socketId)!;
}

export function removeSession(socketId: string) {
  sessions.delete(socketId);
}
