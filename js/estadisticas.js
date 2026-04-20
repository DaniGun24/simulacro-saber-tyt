/* =========================================================
   estadisticas.js — Calculos, graficas y recomendaciones
   ========================================================= */

const Estadisticas = (() => {

  function calcularResumen(resultados) {
    if (!resultados.length) return null;

    const total        = resultados.length;
    const promedioGral = resultados.reduce((s, r) => s + r.puntaje_total, 0) / total;

    const modIds = ['LC','RQ','CE','CC','IN','TE'];
    const promedioModulo = {};
    for (const m of modIds) {
      const vals = resultados.map(r => r[`puntaje_${m}`]).filter(v => v > 0);
      promedioModulo[m] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    }

    const mejor = modIds.reduce((a, b) => promedioModulo[a] >= promedioModulo[b] ? a : b);
    const peor  = modIds.reduce((a, b) => promedioModulo[a] <= promedioModulo[b] ? a : b);

    const tiempoPromedio = resultados.reduce((s, r) => {
      const tp = r.total_preguntas ? r.tiempo_usado_segundos / r.total_preguntas : 0;
      return s + tp;
    }, 0) / total;

    // Streak: dias consecutivos con al menos un simulacro
    const dias = [...new Set(resultados.map(r => r.fecha_completado.substring(0, 10)))].sort();
    let streak = 0;
    const hoy = new Date().toISOString().substring(0, 10);
    let fecha = new Date(hoy);
    for (let i = dias.length - 1; i >= 0; i--) {
      const d = dias[i];
      const dif = Math.round((fecha - new Date(d)) / 86400000);
      if (dif <= 1) { streak++; fecha = new Date(d); }
      else break;
    }

    return { total, promedioGral: Math.round(promedioGral), promedioModulo, mejor, peor, tiempoPromedio: Math.round(tiempoPromedio), streak };
  }

  function recomendaciones(promedioModulo) {
    const nombres = { LC:'Lectura Critica', RQ:'Razonamiento Cuantitativo', CE:'Comunicacion Escrita', CC:'Competencias Ciudadanas', IN:'Ingles', TE:'Telecomunicaciones Especifico' };
    const recom = [];
    for (const [k, v] of Object.entries(promedioModulo)) {
      if (v > 0 && v < 120) recom.push(`Refuerza ${nombres[k]}: puntaje promedio bajo (${Math.round(v)}/300).`);
      else if (v >= 120 && v < 180) recom.push(`Practica mas ${nombres[k]} para alcanzar un nivel medio-alto.`);
    }
    return recom.length ? recom : ['Buen desempeno general. Sigue practicando para mantener tu nivel.'];
  }

  function renderGraficaEvolucion(canvasId, resultados) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !window.Chart) return;
    const ultimos = [...resultados].sort((a, b) => a.fecha_completado.localeCompare(b.fecha_completado)).slice(-10);
    if (window._chartEvolucion) window._chartEvolucion.destroy();
    window._chartEvolucion = new Chart(ctx, {
      type: 'line',
      data: {
        labels:   ultimos.map(r => r.fecha_completado.substring(0, 10)),
        datasets: [{
          label:           'Puntaje total',
          data:            ultimos.map(r => r.puntaje_total),
          borderColor:     '#1a56db',
          backgroundColor: 'rgba(26,86,219,0.1)',
          tension:         0.3,
          fill:            true,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 0, max: 300, title: { display: true, text: 'Puntaje ICFES' } },
          x: { title: { display: true, text: 'Fecha' } },
        },
      },
    });
  }

  function renderGraficaModulos(canvasId, promedioModulo) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !window.Chart) return;
    const nombres = ['LC','RQ','CE','CC','IN','TE'];
    const etiquetas = ['Lect.Critica','Raz.Cuant.','Com.Escrita','Comp.Ciud.','Ingles','Telecom.'];
    if (window._chartModulos) window._chartModulos.destroy();
    window._chartModulos = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: etiquetas,
        datasets: [{
          label:           'Puntaje promedio',
          data:            nombres.map(n => Math.round(promedioModulo[n] || 0)),
          backgroundColor: nombres.map(n => {
            const v = promedioModulo[n] || 0;
            if (v >= 180) return '#16a34a';
            if (v >= 120) return '#1a56db';
            return '#dc2626';
          }),
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { min: 0, max: 300 } },
      },
    });
  }

  return { calcularResumen, recomendaciones, renderGraficaEvolucion, renderGraficaModulos };
})();
