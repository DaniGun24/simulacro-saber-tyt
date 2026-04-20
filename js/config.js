// Reemplaza estos valores con tus credenciales de Google Cloud Console
const CONFIG = {
  SPREADSHEET_ID: '1CPCEykFqt5sIZ8ciaEkGZYrs1N7RXMZj86wQVaKDJSI',
  API_KEY: 'AIzaSyA1AZj_LruyrDH55JQC5UM3I9bsVpEsGD0',
  CLIENT_ID: '267394210867-taabaqrutie6a8rv3pvt4kdspqlmk33q.apps.googleusercontent.com',
  SCOPES: 'https://www.googleapis.com/auth/spreadsheets',
  BASE_URL: 'https://sheets.googleapis.com/v4/spreadsheets',
  DISCOVERY_DOC: 'https://sheets.googleapis.com/$discovery/rest?version=v4',
};

const MODULOS = [
  { id: 'LC', nombre: 'Lectura Critica',              key: 'Lectura Critica',              max: 200 },
  { id: 'RQ', nombre: 'Razonamiento Cuantitativo',    key: 'Razonamiento Cuantitativo',    max: 200 },
  { id: 'CE', nombre: 'Comunicacion Escrita',         key: 'Comunicacion Escrita',         max: 200 },
  { id: 'CC', nombre: 'Competencias Ciudadanas',      key: 'Competencias Ciudadanas',      max: 200 },
  { id: 'IN', nombre: 'Ingles',                       key: 'Ingles',                       max: 200 },
  { id: 'TE', nombre: 'Telecomunicaciones Especifico',key: 'Telecomunicaciones Especifico',max: 100 },
];

const REGLAS_MODULOS = {
  'Lectura Critica': [
    'No se permite el uso de ningun material de consulta.',
    'No se permite calculadora.',
    'Las preguntas evaluan comprension lectora, no conocimiento previo del tema.',
    'Se permiten anotaciones en el cuadernillo (en la version real del ICFES).',
    'Tiempo aproximado por pregunta en el ICFES real: 2.5 minutos.',
  ],
  'Razonamiento Cuantitativo': [
    'NO se permite calculadora (ni fisica ni en pantalla).',
    'No se permite material de apoyo.',
    'Los calculos deben realizarse mentalmente o en papel borrador.',
    'Las preguntas evaluan razonamiento, no calculo mecanico.',
    'Tiempo aproximado por pregunta en el ICFES real: 2.5 minutos.',
  ],
  'Comunicacion Escrita': [
    'En el ICFES real, este modulo tiene una componente de PRODUCCION ESCRITA (redaccion de un texto).',
    'En el simulacro se evalua solo la comprension de los aspectos de escritura (por limitaciones del formato).',
    'No se permite corrector ortografico ni herramientas externas.',
    'Tiempo aproximado por pregunta en el ICFES real: 2.5 minutos.',
  ],
  'Competencias Ciudadanas': [
    'No se permite material de consulta.',
    'Las preguntas evaluan razonamiento civico y etico, no memorizacion de articulos constitucionales.',
    'Tiempo aproximado por pregunta en el ICFES real: 2.5 minutos.',
  ],
  'Ingles': [
    'No se permite diccionario ni traductor.',
    'Las preguntas evaluan comprension de lectura en ingles.',
    'Nivel objetivo: B1-B2 del Marco Comun Europeo de Referencia.',
    'Tiempo aproximado por pregunta en el ICFES real: 2 minutos.',
  ],
  'Telecomunicaciones Especifico': [
    'No se permite material de consulta.',
    'Las preguntas evaluan conocimientos especificos del programa tecnico (Ensamblaje y Mantenimiento de Hardware y Software).',
    'Este modulo es adicional a los 5 modulos genericos.',
    'Tiempo oficial: 90 minutos para el modulo especifico completo.',
    'Este modulo se presenta al FINAL, despues de los 5 modulos genericos.',
  ],
};

const SESSION_KEY    = 'saber_tyt_session';
const SESSION_DAYS   = 7;
const AUTOSAVE_MS    = 60000; // 60 segundos
