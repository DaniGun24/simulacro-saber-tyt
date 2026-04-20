# Simulacro Saber TyT — ICFES

App web para simular el examen **Saber TyT** del ICFES colombiano (Telecomunicaciones). Funciona completamente en el navegador; usa Google Sheets como base de datos.

## Demo en GitHub Pages

Despues de configurar, accede en: `https://<tu-usuario>.github.io/<nombre-repo>/`

---

## Configuracion inicial (una sola vez)

### 1. Google Cloud Console

1. Ve a [console.cloud.google.com](https://console.cloud.google.com) y crea un proyecto.
2. Habilita la **Google Sheets API**.
3. Crea una **API Key** (Credenciales → API Key). Restringe el origen a tu dominio de GitHub Pages.
4. Crea un **OAuth 2.0 Client ID** (tipo: Aplicacion web). Agrega estos origenes autorizados:
   - `http://localhost` (para desarrollo local)
   - `https://<tu-usuario>.github.io` (para produccion)
5. Crea una **hoja de Google Sheets** nueva y copia el ID de la URL (`/spreadsheets/d/<ID>/`).
6. Comparte la hoja con "Cualquier persona con el enlace" en modo editor (o usa el email de la cuenta que hara login).

### 2. Configurar la app

Abre `js/config.js` y reemplaza:

```js
const CONFIG = {
  SPREADSHEET_ID: 'TU_SPREADSHEET_ID_AQUI',   // ID de tu Google Sheet
  API_KEY:        'TU_API_KEY_AQUI',            // API Key de Google Cloud
  CLIENT_ID:      'TU_CLIENT_ID_AQUI',          // Client ID OAuth2
  ...
};
```

O usa la pantalla de configuracion en `admin.html` (las credenciales se guardan en localStorage).

### 3. Inicializar las hojas

Abre `admin.html` en tu navegador:
1. Ingresa tus credenciales.
2. Haz clic en **"Conectar con Google"** (se abre popup de autorizacion).
3. Haz clic en **"Inicializar hojas"** — esto crea USUARIOS, SESIONES_ACTIVAS y RESULTADOS.

---

## Publicar en GitHub Pages

```bash
git init
git add .
git commit -m "Initial commit: Simulacro Saber TyT"
git branch -M main
git remote add origin https://github.com/<usuario>/<repo>.git
git push -u origin main
```

Luego en GitHub → Settings → Pages → Source: **Deploy from branch** → `main` / `/ (root)`.

---

## Estructura de archivos

```
simulacro-saber-tyt/
├── index.html          # Login y registro
├── dashboard.html      # Dashboard con estadisticas
├── configurar.html     # Configurar simulacro
├── simulacro.html      # Pantalla del simulacro
├── resultados.html     # Resultados y revision
├── admin.html          # Configuracion inicial (admin)
├── css/
│   ├── main.css
│   ├── simulacro.css
│   └── dashboard.css
├── js/
│   ├── config.js       # Credenciales y constantes
│   ├── auth.js         # Login, registro, sesion
│   ├── sheets.js       # Google Sheets API
│   ├── banco.js        # Banco de preguntas
│   ├── simulacro.js    # Logica del simulacro
│   ├── timer.js        # Temporizador
│   └── estadisticas.js # Graficas y calculos
└── data/
    └── banco_preguntas_saber_tyt.json  # 1100 preguntas
```

---

## Modulos y distribucion de preguntas

| Modulo | Preguntas | Nivel 1 | Nivel 2 | Nivel 3 |
|--------|-----------|---------|---------|---------|
| Lectura Critica | 200 | 65 | 75 | 60 |
| Razonamiento Cuantitativo | 200 | 70 | 70 | 60 |
| Comunicacion Escrita | 200 | 88 | 59 | 53 |
| Competencias Ciudadanas | 200 | 84 | 60 | 56 |
| Ingles | 200 | 87 | 60 | 53 |
| Telecomunicaciones Especifico | 100 | 28 | 43 | 29 |

Seleccion aleatoria: 40% nivel 1, 35% nivel 2, 25% nivel 3.

---

## Dependencias externas (CDN)

- [Chart.js](https://cdn.jsdelivr.net/npm/chart.js) — graficas de estadisticas
- [jsPDF](https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js) — exportar PDF
- Google APIs (GIS + GAPI) — autenticacion y Sheets

---

## Notas de seguridad

- Nunca subas `js/config.js` con credenciales reales al repositorio publico.
- Agrega `js/config.js` a `.gitignore` y usa variables de entorno o la pantalla `admin.html` para configurar en produccion.
- Para produccion real se recomienda un backend minimo (Cloud Functions) que maneje las credenciales.
