/**
 * simulatedSensing.ts
 * 
 * DEMO MODE: Generates smooth, believable attention values
 * 
 * This replaces real OpenCV detection for demo stability.
 * In production, this would connect to actual facial recognition.
 * 
 * Behavior:
 * - Student is mostly confident
 * - Occasionally becomes distracted
 * - Rarely enters confusion state
 * - Values change smoothly (no jitter)
 */

export interface SimulatedSensingEvent {
  ts: number;
  face_present: boolean;
  gaze: "on_screen" | "away";
  distraction: number; // 0-1, higher = more distracted
}

interface SensingState {
  distraction: number;
  trend: "increasing" | "stable" | "decreasing";
  stateStartTime: number;
}

export class SimulatedSensingEngine {
  private state: SensingState = {
    distraction: 0.15,
    trend: "stable",
    stateStartTime: Date.now(),
  };

  private readonly TREND_DURATION = 3000; // How long to stay in a trend (ms)
  private readonly MAX_STATE_DURATION = 12000; // Force trend change after this

  constructor() {
    // Periodically update trend
    setInterval(() => this.updateTrend(), this.TREND_DURATION);
  }

  private updateTrend() {
    const rand = Math.random();

    // 60% chance: stable (student is focused)
    // 30% chance: distracted for a bit
    // 10% chance: confused
    if (rand < 0.6) {
      this.state.trend = "stable";
      this.state.distraction = Math.max(0.1, this.state.distraction - 0.05);
    } else if (rand < 0.9) {
      this.state.trend = "increasing";
    } else {
      this.state.trend = "increasing";
    }

    this.state.stateStartTime = Date.now();
  }

  getEvent(): SimulatedSensingEvent {
    const ts = Date.now();
    const elapsedSinceChange = ts - this.state.stateStartTime;

    // Update distraction based on trend
    let delta = 0;
    if (this.state.trend === "increasing") {
      delta = 0.018; // Slowly increase confusion
    } else if (this.state.trend === "decreasing") {
      delta = -0.012; // Quickly recover focus
    } else {
      // Stable: small random fluctuation
      delta = (Math.random() - 0.5) * 0.008;
    }

    this.state.distraction = Math.max(0, Math.min(1, this.state.distraction + delta));

    // Add realistic noise (eye movement, head micro-movements)
    const noise = Math.sin(ts / 1200) * 0.03 + (Math.random() - 0.5) * 0.05;
    const finalDistraction = Math.max(0, Math.min(1, this.state.distraction + noise));

    // Gaze direction: more "away" when distracted
    const gaze = Math.random() < finalDistraction ? "away" : "on_screen";

    // Force trend change if state is too long
    if (elapsedSinceChange > this.MAX_STATE_DURATION) {
      this.updateTrend();
    }

    return {
      ts,
      face_present: true,
      gaze,
      distraction: finalDistraction,
    };
  }

  /**
   * For demo purposes: trigger confusion state
   * (Not used in this version, but available for manual testing)
   */
  triggerConfusion() {
    this.state.distraction = 0.8;
    this.state.trend = "stable";
    this.state.stateStartTime = Date.now();
  }

  reset() {
    this.state = {
      distraction: 0.15,
      trend: "stable",
      stateStartTime: Date.now(),
    };
  }
}