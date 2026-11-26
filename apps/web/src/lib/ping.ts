"use client";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

// Navegadores só liberam áudio depois de um gesto do usuário: no primeiro clique/tecla
// criamos e "destravamos" o contexto, para o ping de alertas reais já poder tocar.
if (typeof window !== "undefined") {
  const unlock = () => {
    void getCtx()?.resume();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

/** Toca um "ping" curto de duas notas (sintetizado, sem arquivo de áudio). */
export function playPing() {
  const c = getCtx();
  if (!c || c.state !== "running") return; // ainda sem gesto do usuário: fica em silêncio
  const now = c.currentTime;
  for (const [i, freq] of [880, 1318.5].entries()) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const t = now + i * 0.12;
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  }
}
