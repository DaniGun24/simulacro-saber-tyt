/* =========================================================
   estadisticas.js — Calculos, graficas y recomendaciones
   ========================================================= */

const Estadisticas = (() => {

  const MOD_NOMBRE = {
    LC:'Lectura Critica', RQ:'Razonamiento Cuantitativo',
    CE:'Comunicacion Escrita', CC:'Competencias Ciudadanas',
    IN:'Ingles', TE:'Telecomunicaciones Especifico',
  };
  const MOD_IDS = ['LC','RQ','CE','CC','IN','TE'];

  // ---------- Resumen global ----------

  function calcularResumen(resultados) {
    if (!resultados.length) return null;

    const total        = resultados.length;
    const promedioGral = resultados.reduce((s, r) => s + r.puntaje_total, 0) / total;

    const promedioModulo = {};
    for (const m of MOD_IDS) {
      const vals = resultados.map(r => r[`puntaje_${m}`]).filter(v => v > 0);
      promedioModulo[m] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    }

    const activos = MOD_IDS.filter(m => promedioModulo[m] > 0);
    const mejor = activos.length ? activos.reduce((a, b) => promedioModulo[a] >= promedioModulo[b] ? a : b) : 'LC';
    const peor  = activos.length ? activos.reduce((a, b) => promedioModulo[a] <= promedioModulo[b] ? a : b) : 'LC';

    const tiempoPromedio = resultados.reduce((s, r) => {
      return s + (r.total_preguntas ? r.tiempo_usado_segundos / r.total_preguntas : 0);
    }, 0) / total;

    // % preguntas nivel 3 correctas (sobre todos los simulacros)
    let n3Correctas = 0, n3Total = 0;
    for (const r of resultados) {
      for (const d of (r.respuestas_detalle || [])) {
        if (d.nivel === 3) { n3Total++; if (d.correcta) n3Correctas++; }
      }
    }
    const pctNivel3 = n3Total ? Math.round(n3Correctas / n3Total * 100) : null;

    // Streak
    const dias = [...new Set(resultados.map(r => r.fecha_completado.substring(0, 10)))].sort();
    let streak = 0;
    let fecha = new Date(new Date().toISOString().substring(0, 10));
    for (let i = dias.length - 1; i >= 0; i--) {
      const dif = Math.round((fecha - new Date(dias[i])) / 86400000);
      if (dif <= 1) { streak++; fecha = new Date(dias[i]); }
      else break;
    }

    return { total, promedioGral: Math.round(promedioGral), promedioModulo, mejor, peor, tiempoPromedio: Math.round(tiempoPromedio), streak, pctNivel3 };
  }

  // ---------- Analisis por modulo ----------

  function calcularAnalisisModulo(resultados, moduloId) {
    const nombre = MOD_NOMBRE[moduloId];

    const evolucion = resultados
      .filter(r => r[`puntaje_${moduloId}`] > 0)
      .sort((a, b) => a.fecha_completado.localeCompare(b.fecha_completado))
      .slice(-10)
      .map(r => ({ fecha: r.fecha_completado.substring(0, 10), puntaje: r[`puntaje_${moduloId}`] }));

    // Errores frecuentes (top 5 preguntas mas falladas)
    const errores = {};
    for (const r of resultados) {
      for (const d of (r.respuestas_detalle || [])) {
        if (d.modulo === nombre && !d.correcta && d.id) {
          errores[d.id] = (errores[d.id] || 0) + 1;
        }
      }
    }
    const frecuentes = Object.entries(errores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, veces]) => ({ id, veces }));

    // Distribucion correctas/incorrectas por nivel
    const dist = { 1:{ok:0,total:0}, 2:{ok:0,total:0}, 3:{ok:0,total:0} };
    for (const r of resultados) {
      for (const d of (r.respuestas_detalle || [])) {
        if (d.modulo === nombre && d.nivel >= 1 && d.nivel <= 3) {
          dist[d.nivel].total++;
          if (d.correcta) dist[d.nivel].ok++;
        }
      }
    }

    const promedio = evolucion.length
      ? Math.round(evolucion.reduce((s, e) => s + e.puntaje, 0) / evolucion.length)
      : 0;

    return { evolucion, frecuentes, dist, promedio };
  }

  // ---------- Recomendaciones ----------

  function recomendaciones(promedioModulo) {
    const rec = [];
    for (const [k, v] of Object.entries(promedioModulo)) {
      if (v > 0 && v < 120)       rec.push(`Refuerza urgentemente ${MOD_NOMBRE[k]}: promedio bajo (${Math.round(v)}/300).`);
      else if (v >= 120 && v < 180) rec.push(`Sigue practicando ${MOD_NOMBRE[k]} para superar el nivel medio (${Math.round(v)}/300).`);
    }
    return rec.length ? rec : ['Buen desempeno general. Mantén la constancia para seguir mejorando.'];
  }

  function recomendacionModulo(analisis, moduloId) {
    const { dist, promedio } = analisis;
    const msgs = [];
    if (promedio < 120)  msgs.push(`Tu puntaje promedio en este modulo es bajo (${promedio}/300). Practica mas preguntas de nivel 1 para afianzar la base.`);
    else if (promedio < 180) msgs.push(`Estas en nivel medio (${promedio}/300). Enfocate en nivel 2 para subir tu puntaje.`);
    else msgs.push(`Buen desempeno en este modulo (${promedio}/300). Trabaja nivel 3 para alcanzar la excelencia.`);

    for (let n = 1; n <= 3; n++) {
      const { ok, total } = dist[n];
      if (total > 0) {
        const pct = Math.round(ok / total * 100);
        if (pct < 50) msgs.push(`Nivel ${n === 1 ? 'Basico' : n === 2 ? 'Intermedio' : 'Avanzado'}: solo ${pct}% de acierto. Necesita refuerzo.`);
      }
    }
    return msgs;
  }

  // ---------- Graficas ----------

  function renderGraficaEvolucion(canvasId, resultados) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !window.Chart) return;
    const ultimos = [...resultados].sort((a, b) => a.fecha_completado.localeCompare(b.fecha_completado)).slice(-10);
    if (window._chartEvolucion) window._chartEvolucion.destroy();
    window._chartEvolucion = new Chart(ctx, {
      type: 'line',
      data: {
        labels:   ultimos.map(r => r.fecha_completado.substring(0, 10)),
        datasets: [{ label:'Puntaje total', data: ultimos.map(r => r.puntaje_total), borderColor:'#1a56db', backgroundColor:'rgba(26,86,219,0.1)', tension:0.3, fill:true, pointRadius:4 }],
      },
      options: { responsive:true, plugins:{legend:{display:false}}, scales:{ y:{min:0,max:300,title:{display:true,text:'Puntaje'}}, x:{ticks:{maxRotation:45}} } },
    });
  }

  function renderGraficaModulos(canvasId, promedioModulo) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !window.Chart) return;
    const etiquetas = ['Lect.','Raz.Cuant.','Com.Esc.','Comp.Ciu.','Ingles','Telecom.'];
    if (window._chartModulos) window._chartModulos.destroy();
    window._chartModulos = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: etiquetas,
        datasets: [{ label:'Promedio', data: MOD_IDS.map(n => Math.round(promedioModulo[n]||0)),
          backgroundColor: MOD_IDS.map(n => { const v=promedioModulo[n]||0; return v>=180?'#16a34a':v>=120?'#1a56db':'#dc2626'; }) }],
      },
      options: { responsive:true, plugins:{legend:{display:false}}, scales:{y:{min:0,max:300}} },
    });
  }

  function renderGraficaEvolucionModulo(canvasId, evolucion, moduloId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !window.Chart) return;
    const prev = Chart.getChart(ctx);
    if (prev) prev.destroy();
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: evolucion.map(e => e.fecha),
        datasets: [{ label: MOD_NOMBRE[moduloId], data: evolucion.map(e => e.puntaje), borderColor:'#1a56db', backgroundColor:'rgba(26,86,219,.08)', tension:0.3, fill:true, pointRadius:4 }],
      },
      options: { responsive:true, plugins:{legend:{display:false}}, scales:{y:{min:0,max:300}} },
    });
  }

  function renderGraficaNiveles(canvasId, dist) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !window.Chart) return;
    const prev = Chart.getChart(ctx);
    if (prev) prev.destroy();
    const labels = ['Nivel 1 (Basico)','Nivel 2 (Intermedio)','Nivel 3 (Avanzado)'];
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label:'Correctas',   data:[dist[1].ok,             dist[2].ok,             dist[3].ok            ], backgroundColor:'#16a34a' },
          { label:'Incorrectas', data:[dist[1].total-dist[1].ok,dist[2].total-dist[2].ok,dist[3].total-dist[3].ok], backgroundColor:'#dc2626' },
        ],
      },
      options: { responsive:true, scales:{x:{stacked:true},y:{stacked:true}}, plugins:{legend:{position:'bottom'}} },
    });
  }

  // ---------- Comparacion ----------

  function compararSimulacros(r1, r2) {
    return MOD_IDS.map(m => ({
      modulo: MOD_NOMBRE[m],
      id:     m,
      p1:     r1[`puntaje_${m}`] || 0,
      p2:     r2[`puntaje_${m}`] || 0,
      diff:   (r2[`puntaje_${m}`] || 0) - (r1[`puntaje_${m}`] || 0),
    }));
  }

  function renderGraficaComparacion(canvasId, comp, label1, label2) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !window.Chart) return;
    const prev = Chart.getChart(ctx);
    if (prev) prev.destroy();
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: comp.map(c => c.modulo.substring(0, 10)),
        datasets: [
          { label: label1, data: comp.map(c => c.p1), backgroundColor: 'rgba(26,86,219,.7)' },
          { label: label2, data: comp.map(c => c.p2), backgroundColor: 'rgba(22,163,74,.7)'  },
        ],
      },
      options: { responsive:true, scales:{y:{min:0,max:300}}, plugins:{legend:{position:'bottom'}} },
    });
  }

  return {
    calcularResumen, calcularAnalisisModulo,
    recomendaciones, recomendacionModulo,
    compararSimulacros,
    renderGraficaEvolucion, renderGraficaModulos,
    renderGraficaEvolucionModulo, renderGraficaNiveles,
    renderGraficaComparacion,
    MOD_NOMBRE, MOD_IDS,
  };
})();
