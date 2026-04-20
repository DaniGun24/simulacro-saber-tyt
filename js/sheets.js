/* =========================================================
   sheets.js — Google Sheets API (GIS + GAPI)
   ========================================================= */

const TOKEN_SK = 'gsheets_tok'; // sessionStorage key

const Sheets = (() => {
  let tokenClient = null;
  let gapiInited   = false;
  let gisInited    = false;
  let accessToken  = null;

  // ---------- Inicializacion ----------

  async function initGAPI() {
    return new Promise((resolve, reject) => {
      gapi.load('client', async () => {
        try {
          await gapi.client.init({
            apiKey:        CONFIG.API_KEY,
            discoveryDocs: [CONFIG.DISCOVERY_DOC],
          });
          // Restaurar token guardado si aun es valido
          const stored = _tokenGuardado();
          if (stored) {
            gapi.client.setToken({ access_token: stored.access_token });
            accessToken = stored.access_token;
          }
          gapiInited = true;
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  function initGIS() {
    return new Promise(resolve => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.CLIENT_ID,
        scope:     CONFIG.SCOPES,
        callback:  resp => {
          if (resp.error) return;
          accessToken = resp.access_token;
        },
      });
      gisInited = true;
      resolve();
    });
  }

  async function inicializar() {
    await Promise.all([initGAPI(), initGIS()]);
  }

  function _tokenGuardado() {
    try {
      const raw = sessionStorage.getItem(TOKEN_SK);
      if (!raw) return null;
      const t = JSON.parse(raw);
      if (t.expires_at && Date.now() < t.expires_at) return t;
      sessionStorage.removeItem(TOKEN_SK);
      return null;
    } catch { return null; }
  }

  function _guardarToken(resp) {
    const t = {
      access_token: resp.access_token,
      expires_at:   Date.now() + ((resp.expires_in || 3600) * 1000) - 60000,
    };
    sessionStorage.setItem(TOKEN_SK, JSON.stringify(t));
    accessToken = t.access_token;
    gapi.client.setToken({ access_token: t.access_token });
  }

  // Solicitar token OAuth2 — reutiliza el guardado si sigue vigente
  async function autenticar() {
    // Si ya hay token valido en sesion, no pedir de nuevo
    const stored = _tokenGuardado();
    if (stored) {
      accessToken = stored.access_token;
      gapi.client.setToken({ access_token: stored.access_token });
      return stored.access_token;
    }

    return new Promise((resolve, reject) => {
      if (!gapiInited || !gisInited) { reject(new Error('GAPI no inicializado')); return; }
      tokenClient.callback = resp => {
        if (resp.error) { reject(new Error(resp.error)); return; }
        _guardarToken(resp);
        resolve(resp.access_token);
      };
      // prompt:'select_account' solo la primera vez; despues silencioso
      const yaAutorizado = !!sessionStorage.getItem('gsheets_authorized');
      tokenClient.requestAccessToken({ prompt: yaAutorizado ? '' : 'consent' });
      sessionStorage.setItem('gsheets_authorized', '1');
    });
  }

  function getToken() {
    const t = gapi.client.getToken();
    return t ? t.access_token : accessToken;
  }

  // ---------- Helpers CRUD ----------

  async function leerHoja(hoja, rango) {
    const resp = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `${hoja}!${rango}`,
    });
    return resp.result.values || [];
  }

  async function escribirHoja(hoja, rango, valores) {
    return gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId:     CONFIG.SPREADSHEET_ID,
      range:             `${hoja}!${rango}`,
      valueInputOption:  'RAW',
      resource: { values: valores },
    });
  }

  async function agregarFila(hoja, fila) {
    return gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId:     CONFIG.SPREADSHEET_ID,
      range:             `${hoja}!A:Z`,
      valueInputOption:  'RAW',
      insertDataOption:  'INSERT_ROWS',
      resource: { values: [fila] },
    });
  }

  // ---------- Inicializar hojas (admin) ----------

  async function inicializarHojas() {
    const spreadsheet = await gapi.client.sheets.spreadsheets.get({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
    });
    const existentes = spreadsheet.result.sheets.map(s => s.properties.title);

    const hojas = [
      { titulo: 'USUARIOS',        cabecera: ['id_usuario','nombre','email','hash_contrasena','institucion','programa','fecha_registro','ultimo_acceso','token_sesion'] },
      { titulo: 'SESIONES_ACTIVAS',cabecera: ['id_sesion','id_usuario','fecha_inicio','estado','configuracion_json','respuestas_json','tiempo_restante','modulo_actual','pregunta_actual','fecha_guardado'] },
      { titulo: 'RESULTADOS',      cabecera: ['id_resultado','id_sesion','id_usuario','fecha_completado','puntaje_total','puntaje_LC','puntaje_RQ','puntaje_CE','puntaje_CC','puntaje_IN','puntaje_TE','correctas_LC','correctas_RQ','correctas_CE','correctas_CC','correctas_IN','correctas_TE','total_preguntas','tiempo_usado_segundos','respuestas_detalle_json'] },
    ];

    const requests = hojas
      .filter(h => !existentes.includes(h.titulo))
      .map(h => ({ addSheet: { properties: { title: h.titulo } } }));

    if (requests.length) {
      await gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: CONFIG.SPREADSHEET_ID,
        resource: { requests },
      });
    }

    for (const h of hojas) {
      const filas = await leerHoja(h.titulo, 'A1:Z1');
      if (!filas.length) {
        await escribirHoja(h.titulo, 'A1', [h.cabecera]);
      }
    }
    return true;
  }

  // ---------- Usuarios ----------

  async function buscarTodosUsuarios() {
    const filas = await leerHoja('USUARIOS', 'A2:I');
    return filas.map((f, i) => ({
      fila:            i + 2,
      id_usuario:      f[0] || '',
      nombre:          f[1] || '',
      email:           (f[2] || '').toLowerCase(),
      hash_contrasena: f[3] || '',
      institucion:     f[4] || '',
      programa:        f[5] || '',
      fecha_registro:  f[6] || '',
      ultimo_acceso:   f[7] || '',
      token_sesion:    f[8] || '',
    }));
  }

  async function actualizarCamposUsuario(fila, campos) {
    const filas = await leerHoja('USUARIOS', `A${fila}:I${fila}`);
    if (!filas.length) return;
    const f = [...filas[0]];
    const idx = { ultimo_acceso: 7, token_sesion: 8 };
    for (const [k, v] of Object.entries(campos)) {
      if (idx[k] !== undefined) f[idx[k]] = v;
    }
    await escribirHoja('USUARIOS', `A${fila}:I${fila}`, [f]);
  }

  // ---------- Sesiones activas ----------

  async function obtenerSesionActiva(idUsuario) {
    const filas = await leerHoja('SESIONES_ACTIVAS', 'A2:J');
    const activa = filas
      .map((f, i) => ({ fila: i + 2, id_sesion: f[0], id_usuario: f[1], estado: f[3], configuracion_json: f[4], respuestas_json: f[5], tiempo_restante: f[6], modulo_actual: f[7], pregunta_actual: f[8], fecha_guardado: f[9] }))
      .find(s => s.id_usuario === idUsuario && s.estado === 'activa');
    return activa || null;
  }

  async function guardarSesionActiva(sesion) {
    const filas = await leerHoja('SESIONES_ACTIVAS', 'A2:J');
    const idx = filas.findIndex(f => f[0] === sesion.id_sesion);
    const fila = [
      sesion.id_sesion, sesion.id_usuario, sesion.fecha_inicio, sesion.estado,
      JSON.stringify(sesion.configuracion), JSON.stringify(sesion.respuestas),
      sesion.tiempo_restante, sesion.modulo_actual, sesion.pregunta_actual,
      new Date().toISOString(),
    ];
    if (idx >= 0) {
      await escribirHoja('SESIONES_ACTIVAS', `A${idx + 2}:J${idx + 2}`, [fila]);
    } else {
      await agregarFila('SESIONES_ACTIVAS', fila);
    }
  }

  async function abandonarSesionesActivas(idUsuario) {
    const filas = await leerHoja('SESIONES_ACTIVAS', 'A2:J');
    for (let i = 0; i < filas.length; i++) {
      if (filas[i][1] === idUsuario && filas[i][3] === 'activa') {
        const f = [...filas[i]];
        f[3] = 'abandonada';
        await escribirHoja('SESIONES_ACTIVAS', `A${i + 2}:J${i + 2}`, [f]);
      }
    }
  }

  // ---------- Resultados ----------

  async function guardarResultado(resultado) {
    const fila = [
      resultado.id_resultado, resultado.id_sesion, resultado.id_usuario,
      resultado.fecha_completado, resultado.puntaje_total,
      resultado.puntaje_LC || 0, resultado.puntaje_RQ || 0,
      resultado.puntaje_CE || 0, resultado.puntaje_CC || 0,
      resultado.puntaje_IN || 0, resultado.puntaje_TE || 0,
      resultado.correctas_LC || 0, resultado.correctas_RQ || 0,
      resultado.correctas_CE || 0, resultado.correctas_CC || 0,
      resultado.correctas_IN || 0, resultado.correctas_TE || 0,
      resultado.total_preguntas, resultado.tiempo_usado_segundos,
      JSON.stringify(resultado.respuestas_detalle),
    ];
    await agregarFila('RESULTADOS', fila);
  }

  async function obtenerResultadosUsuario(idUsuario) {
    const filas = await leerHoja('RESULTADOS', 'A2:T');
    return filas
      .filter(f => f[2] === idUsuario)
      .map(f => ({
        id_resultado:         f[0],  id_sesion:     f[1],
        fecha_completado:     f[3],  puntaje_total: parseFloat(f[4]) || 0,
        puntaje_LC:  parseFloat(f[5])  || 0,  puntaje_RQ:  parseFloat(f[6])  || 0,
        puntaje_CE:  parseFloat(f[7])  || 0,  puntaje_CC:  parseFloat(f[8])  || 0,
        puntaje_IN:  parseFloat(f[9])  || 0,  puntaje_TE:  parseFloat(f[10]) || 0,
        correctas_LC:parseInt(f[11]) || 0,  correctas_RQ:parseInt(f[12]) || 0,
        correctas_CE:parseInt(f[13]) || 0,  correctas_CC:parseInt(f[14]) || 0,
        correctas_IN:parseInt(f[15]) || 0,  correctas_TE:parseInt(f[16]) || 0,
        total_preguntas:     parseInt(f[17]) || 0,
        tiempo_usado_segundos:parseInt(f[18])|| 0,
        respuestas_detalle:  (() => { try { return JSON.parse(f[19]); } catch { return []; } })(),
      }));
  }

  return {
    inicializar, autenticar, getToken,
    leerHoja, escribirHoja, agregarFila,
    inicializarHojas,
    buscarTodosUsuarios, actualizarCamposUsuario,
    obtenerSesionActiva, guardarSesionActiva, abandonarSesionesActivas,
    guardarResultado, obtenerResultadosUsuario,
  };
})();
