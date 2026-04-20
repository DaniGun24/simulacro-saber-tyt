/* =========================================================
   simulacro.js — Logica principal del simulacro
   ========================================================= */

const Simulacro = (() => {

  // ---- Estado ----
  let estado = {
    config:          null,   // {modulos, preguntasPorModulo, modoRevision, mostrarRespuesta, modoPractica}
    preguntas:       {},     // { moduloKey: [...preguntas] }
    moduloIdx:       0,
    preguntaIdx:     0,
    respuestas:      {},     // { pregId: opcionIndex }
    marcadas:        new Set(),
    tiempoRestante:  0,
    iniciado:        false,
    pausado:         false,
    id_sesion:       null,
  };

  let autoSaveInterval = null;

  // ---- Getters de conveniencia ----
  function moduloActual()   { return estado.config.modulos[estado.moduloIdx]; }
  function preguntasModulo(){ return estado.preguntas[moduloActual()] || []; }
  function preguntaActual() { return preguntasModulo()[estado.preguntaIdx]; }
  function totalPreguntas() { return Object.values(estado.preguntas).reduce((s, arr) => s + arr.length, 0); }
  function preguntasRespondidas() {
    return Object.keys(estado.respuestas).length;
  }

  // ---- Inicializar ----
  async function iniciar(config, preguntasSeleccionadas, tiempoInicial) {
    estado.config        = config;
    estado.preguntas     = preguntasSeleccionadas;
    estado.moduloIdx     = 0;
    estado.preguntaIdx   = 0;
    estado.respuestas    = {};
    estado.marcadas      = new Set();
    estado.tiempoRestante = tiempoInicial;
    estado.iniciado      = true;
    estado.pausado       = false;
    estado.id_sesion     = generarUUID();

    if (!config.modoPractica) {
      guardarEstadoLocal();
      autoSaveInterval = setInterval(guardarEnSheets, AUTOSAVE_MS);
      window.addEventListener('beforeunload', guardarEnSheets);
    }
  }

  async function restaurar(sesionData) {
    const cfg = JSON.parse(sesionData.configuracion_json || '{}');
    const res = JSON.parse(sesionData.respuestas_json || '{}');
    estado.config        = cfg;
    estado.preguntas     = await Banco.cargar().then(() => Banco.seleccionarPreguntas(cfg.modulos, cfg.preguntasPorModulo));
    // No re-aleatorizamos si restauramos: cargamos las ids guardadas
    // Por simplicidad re-seleccionamos (mejor experiencia vs complejidad)
    estado.moduloIdx     = parseInt(sesionData.modulo_actual) || 0;
    estado.preguntaIdx   = parseInt(sesionData.pregunta_actual) || 0;
    estado.respuestas    = res;
    estado.marcadas      = new Set();
    estado.tiempoRestante = parseInt(sesionData.tiempo_restante) || 0;
    estado.id_sesion     = sesionData.id_sesion;
    estado.iniciado      = true;
    estado.pausado       = false;

    autoSaveInterval = setInterval(guardarEnSheets, AUTOSAVE_MS);
    window.addEventListener('beforeunload', guardarEnSheets);
    return estado;
  }

  // ---- Responder ----
  function responder(pregId, opcion) {
    estado.respuestas[pregId] = opcion;
    guardarEstadoLocal();
    if (!estado.config.modoPractica) guardarEnSheets();
  }

  function toggleMarca(pregId) {
    if (estado.marcadas.has(pregId)) estado.marcadas.delete(pregId);
    else estado.marcadas.add(pregId);
  }

  // ---- Navegacion ----
  function irAPregunta(idx) {
    if (idx >= 0 && idx < preguntasModulo().length) {
      estado.preguntaIdx = idx;
    }
  }

  function siguientePregunta() {
    if (estado.preguntaIdx < preguntasModulo().length - 1) {
      estado.preguntaIdx++;
      return true;
    }
    return false;
  }

  function anteriorPregunta() {
    if (estado.preguntaIdx > 0) {
      estado.preguntaIdx--;
      return true;
    }
    return false;
  }

  // Avanzar al siguiente modulo (devuelve false si era el ultimo)
  function siguienteModulo() {
    if (estado.moduloIdx < estado.config.modulos.length - 1) {
      estado.moduloIdx++;
      estado.preguntaIdx = 0;
      return true;
    }
    return false;
  }

  // ---- Calculo de resultados ----
  function calcularResultados() {
    const modIds = { 'Lectura Critica':'LC', 'Razonamiento Cuantitativo':'RQ', 'Comunicacion Escrita':'CE', 'Competencias Ciudadanas':'CC', 'Ingles':'IN', 'Telecomunicaciones Especifico':'TE' };
    const res = { correctas:{}, totales:{}, puntajes:{}, detalle:[] };

    for (const [mk, pregs] of Object.entries(estado.preguntas)) {
      const mid = modIds[mk] || 'XX';
      let ok = 0;
      for (const p of pregs) {
        const resp  = estado.respuestas[p.id];
        const corr  = resp === p.respuesta;
        if (corr) ok++;
        res.detalle.push({ id: p.id, modulo: mk, nivel: p.nivel, respuesta_usuario: resp !== undefined ? resp : null, respuesta_correcta: p.respuesta, correcta: corr, pregunta: p.pregunta, opciones: p.opciones, explicacion: p.explicacion });
      }
      res.correctas[mid] = ok;
      res.totales[mid]   = pregs.length;
      res.puntajes[mid]  = Banco.calcularPuntajeICFES(ok, pregs.length);
    }

    const totalCorr  = Object.values(res.correctas).reduce((s, v) => s + v, 0);
    const totalPregs = Object.values(res.totales).reduce((s, v) => s + v, 0);
    res.puntajeTotal = Banco.calcularPuntajeICFES(totalCorr, totalPregs);

    return res;
  }

  // ---- Persistencia ----
  function guardarEstadoLocal() {
    const snapshot = {
      id_sesion:        estado.id_sesion,
      moduloIdx:        estado.moduloIdx,
      preguntaIdx:      estado.preguntaIdx,
      tiempoRestante:   Timer.obtenerRestantes(),
      respuestas:       estado.respuestas,
    };
    localStorage.setItem('simulacro_estado', JSON.stringify(snapshot));
  }

  async function guardarEnSheets() {
    const u = obtenerUsuarioActual();
    if (!u) return;
    try {
      await Sheets.guardarSesionActiva({
        id_sesion:       estado.id_sesion,
        id_usuario:      u.usuario_id,
        fecha_inicio:    new Date().toISOString(),
        estado:          'activa',
        configuracion:   estado.config,
        respuestas:      estado.respuestas,
        tiempo_restante: Timer.obtenerRestantes(),
        modulo_actual:   estado.moduloIdx,
        pregunta_actual: estado.preguntaIdx,
      });
    } catch (_) { /* no bloquear el simulacro por errores de red */ }
  }

  async function finalizarYGuardar(tiempoUsado) {
    clearInterval(autoSaveInterval);
    window.removeEventListener('beforeunload', guardarEnSheets);
    localStorage.removeItem('simulacro_estado');

    const resultados = calcularResultados();
    const u = obtenerUsuarioActual();
    const idRes = 'R' + generarUUID().replace(/-/g,'').substring(0,12).toUpperCase();

    const payload = {
      id_resultado:         idRes,
      id_sesion:            estado.id_sesion,
      id_usuario:           u.usuario_id,
      fecha_completado:     new Date().toISOString(),
      puntaje_total:        resultados.puntajeTotal,
      puntaje_LC:           resultados.puntajes.LC  || 0,
      puntaje_RQ:           resultados.puntajes.RQ  || 0,
      puntaje_CE:           resultados.puntajes.CE  || 0,
      puntaje_CC:           resultados.puntajes.CC  || 0,
      puntaje_IN:           resultados.puntajes.IN  || 0,
      puntaje_TE:           resultados.puntajes.TE  || 0,
      correctas_LC:         resultados.correctas.LC || 0,
      correctas_RQ:         resultados.correctas.RQ || 0,
      correctas_CE:         resultados.correctas.CE || 0,
      correctas_CC:         resultados.correctas.CC || 0,
      correctas_IN:         resultados.correctas.IN || 0,
      correctas_TE:         resultados.correctas.TE || 0,
      total_preguntas:      totalPreguntas(),
      tiempo_usado_segundos:tiempoUsado,
      respuestas_detalle:   resultados.detalle,
    };

    try {
      await Sheets.guardarResultado(payload);
      await Sheets.guardarSesionActiva({ ...payload, id_sesion: estado.id_sesion, id_usuario: u.usuario_id, fecha_inicio: new Date().toISOString(), estado: 'completada', configuracion: estado.config, respuestas: estado.respuestas, tiempo_restante: 0, modulo_actual: estado.moduloIdx, pregunta_actual: estado.preguntaIdx });
    } catch (_) { /* guardar localmente como fallback */ }

    localStorage.setItem('ultimo_resultado', JSON.stringify(payload));
    return payload;
  }

  // ---- Pausa ----
  function pausar() { estado.pausado = true; Timer.pausar(); guardarEstadoLocal(); }
  function reanudar() { estado.pausado = false; Timer.reanudar(); }

  return {
    iniciar, restaurar, responder, toggleMarca,
    irAPregunta, siguientePregunta, anteriorPregunta, siguienteModulo,
    calcularResultados, finalizarYGuardar,
    pausar, reanudar, guardarEstadoLocal,
    get estado() { return estado; },
    moduloActual, preguntasModulo, preguntaActual, totalPreguntas, preguntasRespondidas,
  };
})();
