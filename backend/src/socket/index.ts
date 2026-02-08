import type { Server, Socket } from "socket.io";

type PresageEvent = {
  ts: number;
  face_present: boolean;
  gaze: "on_screen" | "away";
  confusion: number;
};

export type SessionState = {
  startedAt: number;

  lastEventTs?: number | undefined;
  focusedMs: number;

  awayStartedAt?: number | undefined;
  lookAwayCount: number;

  confusionTriggers: number;
  confusionEvents: { ts: number; confusion: number }[];

  questions: { ts: number; q: string }[];

  lastQuestion?: string | undefined;
  lastAnswerSoFar?: string | undefined;
};

const sessions = new Map<string, SessionState>();

export function getSession(socketId: string): SessionState {
  let s = sessions.get(socketId);
  if (!s) {
    s = {
      startedAt: Date.now(),
      focusedMs: 0,
      lookAwayCount: 0,
      confusionTriggers: 0,
      confusionEvents: [],
      questions: [],
      lastAnswerSoFar: ""
    };
    sessions.set(socketId, s);
  }
  return s;
}

export function removeSession(socketId: string) {
  sessions.delete(socketId);
}

function recordPresageEvent(s: SessionState, e: PresageEvent) {
  if (s.lastEventTs != null) {
    const dt = Math.max(0, e.ts - s.lastEventTs);

    if (e.face_present && e.gaze === "on_screen") {
      s.focusedMs += dt;
    }

    if (e.gaze === "away") {
      if (s.awayStartedAt == null) s.awayStartedAt = e.ts;
    } else {
      if (s.awayStartedAt != null) {
        const awayDur = e.ts - s.awayStartedAt;
        if (awayDur >= 1500) s.lookAwayCount += 1;
        s.awayStartedAt = undefined;
      }
    }
  }

  s.lastEventTs = e.ts;

  s.confusionEvents.push({ ts: e.ts, confusion: e.confusion });
  if (s.confusionEvents.length > 3500) {
    s.confusionEvents.splice(0, s.confusionEvents.length - 3500);
  }
}

function sessionSummary(s: SessionState) {
  const now = Date.now();
  const totalMs = Math.max(0, now - s.startedAt);

  return {
    startedAt: s.startedAt,
    endedAt: now,
    totalMs,
    focusedMs: s.focusedMs,
    lookAwayCount: s.lookAwayCount,
    confusionTriggers: s.confusionTriggers,
    questionsCount: s.questions.length,
    questions: s.questions.slice(-10),
    confusionEvents: s.confusionEvents
  };
}

export function registerSocketHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    const s = getSession(socket.id);


    socket.on("presage_event", (e: PresageEvent) => {
      if (
        !e ||
        typeof e.ts !== "number" ||
        typeof e.face_present !== "boolean" ||
        (e.gaze !== "on_screen" && e.gaze !== "away") ||
        typeof e.confusion !== "number"
      ) {
        return;
      }
      recordPresageEvent(s, e);
    });

    socket.on("user_confused", ({ ts }: { ts: number }) => {
      s.confusionTriggers += 1;
      socket.emit("confusion_ack", { ts: typeof ts === "number" ? ts : Date.now() });
    });

    

    socket.on("end_session", () => {
      socket.emit("session_summary", sessionSummary(s));
    });

    socket.on("disconnect", () => {
      removeSession(socket.id);
    });
  });
}
