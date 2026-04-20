/* =========================================================
   simulacro.js — Logica principal del simulacro
   ========================================================= */

const Simulacro = (() => {

  let estado = {
    config:          null,
    preguntas:       {},
    moduloIdx:       0,
    preguntaIdx:     0,
    respuestas:      {},
    marcadas:        new Set(),
    iniciado:        false,
    pausado:         false,
    id_sesion:       null,
    tiempoUsadoAcumulado: 0, // segundos usados en modulos ya terminados
  };

  let autoSaveInterval  = null;
  let tiempoModuloInicio = 0; // segundos al iniciar el modulo actual

  // ---- Getters ----
  function moduloActual()    { return estado.config.modulos[estado.moduloIdx]; }
  function preguntasModulo() { return estado.preguntas[moduloActual()] || []; }
  function preguntaActual()  { return preguntasModulo()[estado.preguntaIdx]; }
  function totalPreguntas()  { return Object.values(estado.preguntas).reduce((s, a) => s + a.length, 0); }
  function preguntasRespondidas() { return Object.keys(estado.respuestas).length; }

  function tiempoUsadoTotal() {
    const usadoModuloActual = tiempoModuloInicio - Timer.obtenerRestantes();
    return estado.tiempoUsadoAcumulado + Math.max(0, usadoModuloActual);
  }

  // ---- Inicializar ----
  async function iniciar(config, preguntasSeleccionadas) {
    estado.config               = config;
    estado.preguntas            = preguntasSeleccionadas;
    estado.moduloIdx            = 0;
    estado.preguntaIdx          = 0;
    estado.respuestas           = {};
    estado.marcadas             = new Set();
    estado.iniciado             = true;
    estado.pausado              = false;
    estado.id_sesion            = generarUUID();
    estado.tiempoUsadoAcumulado = 0;

    _persistirMarcadas();
    if (!config.modoPractica) {
      guardarEstadoLocal();
      autoSaveInterval = setInterval(guardarEnSheets, AUTOSAVE_MS);
      window.addEventListener('beforeunload', guardarEnSheets);
    }
  }

  // Llamar al comenzar cada modulo para registrar el tiempo inicial
  function registrarInicioModulo(segundosModulo) {
    tiempoModuloInicio = segundosModulo;
  }

  // Llamar al terminar cada modulo para acumular tiempo
  function acumularTiempoModulo() {
    const usado = tiempoModuloInicio - Timer.obtenerRestantes();
    estado.tiempoUsadoAcumulado += Math.max(0, usado);
    tiempoModuloInicio = 0;
  }

  // ---- Restaurar desde localStorage ----
  function restaurarLocal() {
    try {
      const raw = localStorage.getItem('simulacro_estado');
      if (!raw) return null;
      const snap = JSON.parse(raw);
      // Validar que la config del banco sigue siendo la misma
      const rawConfig = localStorage.getItem('simulacro_config');
      if (!rawConfig) return null;
      return snap;
    } catch { return null; }
  }

  function aplicarSnapshot(snap, preguntas) {
    estado.moduloIdx            = snap.moduloIdx || 0;
    estado.preguntaIdx          = snap.preguntaIdx || 0;
    estado.respuestas           = snap.respuestas || {};
    estado.tiempoUsadoAcumulado = snap.tiempoUsadoAcumulado || 0;
    estado.marcadas             = new Set(snap.marcadas || []);
    estado.id_sesion            = snap.id_sesion || generarUUID();
    estado.preguntas            = preguntas;
    tiempoModuloInicio          = snap.tiempoModuloInicio || 0;
    _persistirMarcadas();
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
    _persistirMarcadas();
  }

  function _persistirMarcadas() {
    localStorage.setItem('simulacro_marcadas', JSON.stringify([...estado.marcadas]));
  }

  // ---- Navegacion ----
  function irAPregunta(idx) {
    if (idx >= 0 && idx < preguntasModulo().length) estado.preguntaIdx = idx;
  }
  function siguientePregunta() {
    if (estado.preguntaIdx < preguntasModulo().length - 1) { estado.preguntaIdx++; return true; }
    return false;
  }
  function anteriorPregunta() {
    if (estado.preguntaIdx > 0) { estado.preguntaIdx--; return true; }
    return false;
  }
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
    const MAP = { 'Lectura Critica':'LC','Razonamiento Cuantitativo':'RQ','Comunicacion Escrita':'CE','Competencias Ciudadanas':'CC','Ingles':'IN','Telecomunicaciones Especifico':'TE' };
    const res = { correctas:{}, totales:{}, puntajes:{}, detalle:[] };

    for (const [mk, pregs] of Object.entries(estado.preguntas)) {
      const mid = MAP[mk] || 'XX';
      let ok = 0;
      for (const p of pregs) {
        const resp = estado.respuestas[p.id];
        const corr = resp === p.respuesta;
        if (corr) ok++;
        res.detalle.push({
          id: p.id, modulo: mk, nivel: p.nivel,
          respuesta_usuario: resp !== undefined ? resp : null,
          respuesta_correcta: p.respuesta, correcta: corr,
          pregunta: p.pregunta, opciones: p.opciones, explicacion: p.explicacion,
          marcada: estado.marcadas.has(p.id),
        });
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
    const snap = {
      id_sesion:            estado.id_sesion,
      moduloIdx:            estado.moduloIdx,
      preguntaIdx:          estado.preguntaIdx,
      respuestas:           estado.respuestas,
      marcadas:             [...estado.marcadas],
      tiempoUsadoAcumulado: estado.tiempoUsadoAcumulado,
      tiempoModuloInicio:   tiempoModuloInicio,
      tiempoRestanteModulo: Timer.obtenerRestantes(),
    };
    localStorage.setItem('simulacro_estado', JSON.stringify(snap));
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
    } catch (_) { /* no bloquear el simulacro */ }
  }

  async function finalizarYGuardar() {
    clearInterval(autoSaveInterval);
    window.removeEventListener('beforeunload', guardarEnSheets);
    localStorage.removeItem('simulacro_estado');

    const segUsados  = tiempoUsadoTotal();
    const resultados = calcularResultados();
    const u          = obtenerUsuarioActual();
    const idRes      = 'R' + generarUUID().replace(/-/g,'').substring(0,12).toUpperCase();

    const payload = {
      id_resultado:          idRes,
      id_sesion:             estado.id_sesion,
      id_usuario:            u.usuario_id,
      fecha_completado:      new Date().toISOString(),
      puntaje_total:         resultados.puntajeTotal,
      puntaje_LC:            resultados.puntajes.LC  || 0,
      puntaje_RQ:            resultados.puntajes.RQ  || 0,
      puntaje_CE:            resultados.puntajes.CE  || 0,
      puntaje_CC:            resultados.puntajes.CC  || 0,
      puntaje_IN:            resultados.puntajes.IN  || 0,
      puntaje_TE:            resultados.puntajes.TE  || 0,
      correctas_LC:          resultados.correctas.LC || 0,
      correctas_RQ:          resultados.correctas.RQ || 0,
      correctas_CE:          resultados.correctas.CE || 0,
      correctas_CC:          resultados.correctas.CC || 0,
      correctas_IN:          resultados.correctas.IN || 0,
      correctas_TE:          resultados.correctas.TE || 0,
      total_preguntas:       totalPreguntas(),
      tiempo_usado_segundos: segUsados,
      respuestas_detalle:    resultados.detalle,
    };

    try {
      await Sheets.guardarResultado(payload);
      await Sheets.guardarSesionActiva({
        id_sesion: estado.id_sesion, id_usuario: u.usuario_id,
        fecha_inicio: payload.fecha_completado, estado: 'completada',
        configuracion: estado.config, respuestas: estado.respuestas,
        tiempo_restante: 0, modulo_actual: estado.moduloIdx, pregunta_actual: estado.preguntaIdx,
      });
    } catch (_) { /* fallback local */ }

    localStorage.setItem('ultimo_resultado', JSON.stringify(payload));
    return payload;
  }

  // ---- Pausa ----
  function pausar()   { estado.pausado = true;  Timer.pausar();   guardarEstadoLocal(); }
  function reanudar() { estado.pausado = false; Timer.reanudar(); }

  return {
    iniciar, restaurarLocal, aplicarSnapshot,
    registrarInicioModulo, acumularTiempoModulo,
    responder, toggleMarca,
    irAPregunta, siguientePregunta, anteriorPregunta, siguienteModulo,
    calcularResultados, finalizarYGuardar,
    pausar, reanudar, guardarEstadoLocal,
    tiempoUsadoTotal,
    get estado() { return estado; },
    moduloActual, preguntasModulo, preguntaActual, totalPreguntas, preguntasRespondidas,
  };
})();
