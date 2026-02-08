// FILE: backend/src/socket/presageHandlers.ts
// (New file for Step 5 backend wiring)

export type PresageEvent = {
  ts: number;
  face_present: boolean;
  gaze: "on_screen" | "away";
  confusion: number;
};

export function attachPresageHandlers(socket: any) {
  // Just log for now, Step 6 will persist session metrics.
  socket.on("presage_event", (e: PresageEvent) => {
    // Keep logs lightweight
    // console.log("[presage_event]", socket.id, e.gaze, e.confusion.toFixed?.(2) ?? e.confusion);
  });

  socket.on("user_confused", ({ ts }: { ts: number }) => {
    // For Step 5: simply acknowledge. Step 6 will trigger clarification generation.
    // console.log("[user_confused]", socket.id, ts);
    socket.emit("confusion_ack", { ts });
  });
}
