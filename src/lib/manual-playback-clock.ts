export type ManualPlaybackClock = {
  start: () => void;
  pause: () => void;
  reset: () => void;
  seek: (seconds: number) => void;
  nudge: (delta: number) => void;
  isRunning: () => boolean;
  dispose: () => void;
};

export function createManualPlaybackClock(
  onTime: (seconds: number) => void,
): ManualPlaybackClock {
  let baseTime = 0;
  let running = false;
  let runStart = 0;
  let raf = 0;

  const readTime = () => {
    if (!running) return Math.max(0, baseTime);
    return Math.max(0, baseTime + (performance.now() - runStart) / 1000);
  };

  const emit = () => {
    onTime(readTime());
  };

  const tick = () => {
    if (!running) return;
    emit();
    raf = requestAnimationFrame(tick);
  };

  return {
    start() {
      if (running) return;
      running = true;
      runStart = performance.now();
      tick();
    },
    pause() {
      if (!running) return;
      baseTime = readTime();
      running = false;
      cancelAnimationFrame(raf);
      emit();
    },
    reset() {
      running = false;
      cancelAnimationFrame(raf);
      baseTime = 0;
      emit();
    },
    seek(seconds: number) {
      baseTime = Math.max(0, seconds);
      if (running) runStart = performance.now();
      emit();
    },
    nudge(delta: number) {
      this.seek(readTime() + delta);
    },
    isRunning: () => running,
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
