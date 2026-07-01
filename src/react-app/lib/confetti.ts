import confetti from "canvas-confetti";

/** A tasteful two-burst confetti pop — fired when a new board is created. */
export function celebrate() {
  const colors = ["#2f6feb", "#2f9e6f", "#c98a1b", "#8b5cf6", "#e2547d", "#1d1d1f"];
  const base = {
    spread: 70,
    startVelocity: 42,
    ticks: 220,
    gravity: 0.9,
    scalar: 0.9,
    colors,
    zIndex: 100,
    disableForReducedMotion: true,
  };
  confetti({ ...base, particleCount: 70, angle: 60, origin: { x: 0.15, y: 0.7 } });
  confetti({ ...base, particleCount: 70, angle: 120, origin: { x: 0.85, y: 0.7 } });
  setTimeout(() => {
    confetti({ ...base, particleCount: 50, spread: 100, angle: 90, origin: { x: 0.5, y: 0.4 } });
  }, 120);
}
