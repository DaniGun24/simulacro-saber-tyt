/* =========================================================
   auth.js — Login, registro, sesion
   ========================================================= */

async function hashContrasena(contrasena) {
  const encoder = new TextEncoder();
  const data = encoder.encode(contrasena);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function generarUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ---------- Sesion en localStorage ----------

function guardarSesionLocal(usuario) {
  const sesion = { ...usuario, timestamp: Date.now() };
  localStorage.setItem(SESSION_KEY, JSON.stringify(sesion));
}

function obtenerUsuarioActual() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  const sesion = JSON.parse(raw);
  const diasInactivo = (Date.now() - sesion.timestamp) / (1000 * 60 * 60 * 24);
  if (diasInactivo > SESSION_DAYS) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  return sesion;
}

function refrescarTimestamp() {
  const sesion = obtenerUsuarioActual();
  if (sesion) guardarSesionLocal(sesion);
}

function cerrarSesion() {
  localStorage.removeItem(SESSION_KEY);
  window.location.href = 'index.html';
}

function verificarSesion() {
  if (!obtenerUsuarioActual()) {
    window.location.href = 'index.html';
    return false;
  }
  refrescarTimestamp();
  return true;
}

// ---------- Registro ----------

async function registrarUsuario(nombre, email, contrasena, institucion, programa) {
  const usuarios = await Sheets.buscarTodosUsuarios();
  const existe = usuarios.find(u => u.email === email.toLowerCase().trim());
  if (existe) throw new Error('Ya existe una cuenta con ese email.');

  const hash    = await hashContrasena(contrasena);
  const id      = 'U' + generarUUID().replace(/-/g, '').substring(0, 8).toUpperCase();
  const ahora   = new Date().toISOString();
  const token   = generarUUID();

  await Sheets.agregarFila('USUARIOS', [
    id, nombre.trim(), email.toLowerCase().trim(), hash,
    institucion || '', programa || '', ahora, ahora, token,
  ]);

  guardarSesionLocal({ usuario_id: id, nombre: nombre.trim(), email: email.toLowerCase().trim(), token_sesion: token });
  return { usuario_id: id, nombre: nombre.trim() };
}

// ---------- Login ----------

async function loginUsuario(email, contrasena) {
  const usuarios = await Sheets.buscarTodosUsuarios();
  const usuario  = usuarios.find(u => u.email === email.toLowerCase().trim());
  if (!usuario) throw new Error('Email o contrasena incorrectos.');

  const hash = await hashContrasena(contrasena);
  if (hash !== usuario.hash_contrasena) throw new Error('Email o contrasena incorrectos.');

  const token = generarUUID();
  const ahora = new Date().toISOString();

  // Actualizar ultimo_acceso y token en Sheets
  await Sheets.actualizarCamposUsuario(usuario.fila, { ultimo_acceso: ahora, token_sesion: token });

  guardarSesionLocal({
    usuario_id:   usuario.id_usuario,
    nombre:       usuario.nombre,
    email:        usuario.email,
    token_sesion: token,
    fila:         usuario.fila,
  });

  return { usuario_id: usuario.id_usuario, nombre: usuario.nombre };
}
