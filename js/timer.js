/* =========================================================
   timer.js — Temporizador regresivo con alertas
   ========================================================= */

const Timer = (() => {
  let segundosRestantes = 0;
  let intervalo         = null;
  let onTick            = null;
  let onExpire          = null;
  let audioCtx          = null;

  function formatear(seg) {
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = seg % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function beep(frecuencia = 880, duracion = 300) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type      = 'sine';
      osc.frequency.value = frecuencia;
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duracion / 1000);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + duracion / 1000);
    } catch (_) { /* Sin audio no es critico */ }
  }

  function iniciar(segundos, tickCb, expireCb) {
    detener();
    segundosRestantes = segundos;
    onTick   = tickCb;
    onExpire = expireCb;
    intervalo = setInterval(() => {
      segundosRestantes--;

      if (onTick) onTick(segundosRestantes, formatear(segundosRestantes));

      if (segundosRestantes === 300) beep(660, 400);   // 5 min: alerta
      if (segundosRestantes === 60)  beep(880, 600);   // 1 min: alerta sonora
      if (segundosRestantes <= 0) {
        detener();
        if (onExpire) onExpire();
      }
    }, 1000);
  }

  function pausar() {
    clearInterval(intervalo);
    intervalo = null;
  }

  function reanudar() {
    if (!intervalo && segundosRestantes > 0) {
      intervalo = setInterval(() => {
        segundosRestantes--;
        if (onTick) onTick(segundosRestantes, formatear(segundosRestantes));
        if (segundosRestantes === 300) beep(660, 400);
        if (segundosRestantes === 60)  beep(880, 600);
        if (segundosRestantes <= 0) { detener(); if (onExpire) onExpire(); }
      }, 1000);
    }
  }

  function detener() {
    clearInterval(intervalo);
    intervalo = null;
  }

  function obtenerRestantes() { return segundosRestantes; }
  function establecer(seg)    { segundosRestantes = seg; }

  return { iniciar, pausar, reanudar, detener, formatear, obtenerRestantes, establecer };
})();
