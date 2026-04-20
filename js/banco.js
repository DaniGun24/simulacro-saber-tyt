/* =========================================================
   banco.js — Carga y seleccion del banco de preguntas
   ========================================================= */

const Banco = (() => {
  let _preguntas = null;

  async function cargar() {
    if (_preguntas) return _preguntas;
    const resp = await fetch('data/banco_preguntas_saber_tyt.json');
    if (!resp.ok) throw new Error('No se pudo cargar el banco de preguntas.');
    _preguntas = await resp.json();
    return _preguntas;
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function seleccionarPreguntas(modulosSeleccionados, preguntasPorModulo) {
    if (!_preguntas) throw new Error('Banco no cargado. Llama a Banco.cargar() primero.');

    const simulacro = {};

    for (const moduloKey of modulosSeleccionados) {
      const pool  = _preguntas.filter(q => q.modulo === moduloKey);
      const n     = Math.min(preguntasPorModulo, pool.length);

      const niv1  = pool.filter(q => q.nivel === 1);
      const niv2  = pool.filter(q => q.nivel === 2);
      const niv3  = pool.filter(q => q.nivel === 3);

      const c1 = Math.round(n * 0.40);
      const c2 = Math.round(n * 0.35);
      const c3 = n - c1 - c2;

      const sel = [
        ...shuffle(niv1).slice(0, Math.min(c1, niv1.length)),
        ...shuffle(niv2).slice(0, Math.min(c2, niv2.length)),
        ...shuffle(niv3).slice(0, Math.min(c3, niv3.length)),
      ];

      // Completar si faltan preguntas en algun nivel
      if (sel.length < n) {
        const usados  = new Set(sel.map(q => q.id));
        const resto   = shuffle(pool.filter(q => !usados.has(q.id)));
        const faltan  = n - sel.length;
        sel.push(...resto.slice(0, faltan));
      }

      simulacro[moduloKey] = sel.sort((a, b) => a.nivel - b.nivel);
    }

    return simulacro;
  }

  function calcularTiempo(modulosSeleccionados, preguntasPorModulo) {
    const esEspecifico = key => key === 'Telecomunicaciones Especifico';
    const genericos = modulosSeleccionados.filter(m => !esEspecifico(m));
    const especifico = modulosSeleccionados.find(esEspecifico);

    // 300 preguntas genericas = 280 min; proporcional si son menos
    const totalPregGeneral = genericos.length * preguntasPorModulo;
    const minutosGenericos = (totalPregGeneral / 300) * 280;

    // Modulo especifico: 50 preguntas = 90 min
    const pregEsp     = especifico ? Math.min(preguntasPorModulo, 100) : 0;
    const minutosEsp  = especifico ? (pregEsp / 50) * 90 : 0;

    const totalMin = minutosGenericos + minutosEsp;
    const totalSeg = Math.round(totalMin * 60);

    return { totalSegundos: totalSeg, minutosGenericos, minutosEsp };
  }

  function calcularTiempoPorModulo(moduloKey, preguntasPorModulo) {
    const esEsp = moduloKey === 'Telecomunicaciones Especifico';
    if (esEsp) {
      return Math.round((Math.min(preguntasPorModulo, 100) / 50) * 90 * 60);
    }
    return Math.round((preguntasPorModulo / 50) * (280 / 5) * 60);
  }

  function calcularPuntajeICFES(correctas, total) {
    if (!total) return 0;
    const pct = correctas / total;
    return Math.max(0, Math.min(300, Math.round(pct * 300)));
  }

  return { cargar, seleccionarPreguntas, calcularTiempo, calcularTiempoPorModulo, calcularPuntajeICFES };
})();
