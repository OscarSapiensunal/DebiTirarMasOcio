/* ============================================================
   Ociómetro — RAPsi UNAL
   Sistema de Análisis de Bienestar Universitario · app.js
   Dependencia: Chart.js (auto-alojado en /vendor, cargado antes)

   Nota de arquitectura: la página no usa manejadores inline
   (onclick / oninput). Todo se conecta con addEventListener al
   final de este archivo, lo que permite servir el sitio con una
   Content-Security-Policy estricta (sin 'unsafe-inline' en
   script-src). Ver vercel.json.
============================================================ */

/* ----------------------------------------------------------
   CONFIGURACIÓN (editable sin tocar otra lógica)
---------------------------------------------------------- */
const CONFIG = {
  totalHoras:  168,
  diasSemana:  7,
};

/* Campos con slider: id → se sincronizan solos con su etiqueta */
const SLIDER_IDS = [
  'sleep', 'food', 'transit_hours', 'grooming', 'house_tasks',
  'work', 'screen', 'physical_activity', 'social_activity', 'hobby_wellbeing',
  'class_hours', 'self_study_hours'
];

/* ----------------------------------------------------------
   LECTURA SEGURA DE CAMPOS NUMÉRICOS

   Antes se usaba `parseFloat(el.value) || fallback`, que trata
   el 0 como valor ausente: quien ponía "0 h" de transporte,
   cuidado personal o tareas del hogar veía cómo el formulario
   le devolvía silenciosamente el valor por defecto. Aquí el
   fallback solo actúa si el campo no existe o no es un número,
   y el resultado se recorta al rango [min, max] declarado en el
   HTML (protege el <input type="number"> de valores absurdos).
---------------------------------------------------------- */
function readNum(id, fallback = 0) {
  const el = document.getElementById(id);
  if (!el) return fallback;

  const raw = parseFloat(el.value);
  if (!Number.isFinite(raw)) return fallback;

  const min = parseFloat(el.min);
  const max = parseFloat(el.max);
  let val = raw;
  if (Number.isFinite(min)) val = Math.max(min, val);
  if (Number.isFinite(max)) val = Math.min(max, val);
  return val;
}

/* ----------------------------------------------------------
   HELPER: sincronizar slider con su etiqueta de valor
---------------------------------------------------------- */
function syncRange(id) {
  const input = document.getElementById(id);
  if (!input) return;
  const label = document.getElementById(id + '-val');
  if (label) label.textContent = `${fmt(readNum(id))} h`;
  updateCounter();
}

/* ----------------------------------------------------------
   LECTURA COMPLETA DEL FORMULARIO
   Fuente única de verdad: la usan tanto el contador en vivo
   como el cálculo final, de modo que nunca puedan discrepar.
---------------------------------------------------------- */
function readForm() {
  const isStudent = document.getElementById('is_student')?.checked ?? true;

  return {
    isStudent,
    sleep:        readNum('sleep', 7),
    food:         readNum('food', 1.5),
    grooming:     readNum('grooming', 1),
    screen:       readNum('screen', 0),
    transitHours: readNum('transit_hours', 0),
    houseTasks:   readNum('house_tasks', 0),
    classHours:     isStudent ? readNum('class_hours', 0)      : 0,
    selfStudyHours: isStudent ? readNum('self_study_hours', 0) : 0,
    work:     readNum('work', 0),
    other:    readNum('other', 0),
    physical: readNum('physical_activity', 0),
    social:   readNum('social_activity', 0),
    hobby:    readNum('hobby_wellbeing', 0),
  };
}

/* Convierte la lectura del formulario a horas semanales. */
function toWeekly(f) {
  const D = CONFIG.diasSemana;
  return {
    hSleep:      f.sleep    * D,
    hFood:       f.food     * D,
    hGrooming:   f.grooming * D,
    hScreen:     f.screen   * D,
    hTransit:    f.transitHours,   // ya viene en horas/semana
    hHouseTasks: f.houseTasks,
    hStudy:      f.classHours + f.selfStudyHours,
    hWork:       f.work,
    hOther:      f.other,
    hPhysical:   f.physical,
    hSocial:     f.social,
    hHobby:      f.hobby,
  };
}

function totalOcupado(w) {
  return w.hSleep + w.hFood + w.hGrooming + w.hScreen + w.hTransit
       + w.hHouseTasks + w.hStudy + w.hWork + w.hOther
       + w.hPhysical + w.hSocial + w.hHobby;
}

/* ----------------------------------------------------------
   CONTADOR EN TIEMPO REAL: horas ocupadas de 168
---------------------------------------------------------- */
function updateCounter() {
  const total   = totalOcupado(toWeekly(readForm()));
  const pctUsed = Math.min(100, (total / CONFIG.totalHoras) * 100);
  const isOver  = total > CONFIG.totalHoras;

  const usedEl     = document.getElementById('hc-used');
  const barEl      = document.getElementById('hc-bar');
  const wrapEl     = document.getElementById('hours-counter');
  const overflowEl = document.getElementById('hours-overflow');
  const btnCalc    = document.getElementById('btn-calc');

  if (usedEl) usedEl.textContent = fmt(total);
  if (barEl)  barEl.style.width  = pctUsed + '%';
  if (wrapEl)     wrapEl.classList.toggle('hc-over', isOver);
  if (overflowEl) overflowEl.hidden = !isOver;
  if (btnCalc) {
    btnCalc.classList.toggle('btn-calc--over', isOver);
    btnCalc.textContent = isOver
      ? '⚠️ Superaste las 168 h · ajusta tus valores antes de calcular'
      : 'Calcular mi tiempo disponible ⟶';
  }
}

/* ----------------------------------------------------------
   HELPERS: formato numérico y porcentaje
---------------------------------------------------------- */
function fmt(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  // Muestra 1 decimal solo si el valor no es entero
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function pct(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0.0%';
  return ((v / CONFIG.totalHoras) * 100).toFixed(1) + '%';
}

/* Redondea a 2 decimales — evita colas de coma flotante
   (p. ej. 10.500000000000002) en el snapshot guardado. */
function round2(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

/* ----------------------------------------------------------
   INSTANCIA DEL GRÁFICO (reutilizable entre recálculos)
---------------------------------------------------------- */
let weekChart = null;

/* ----------------------------------------------------------
   MENSAJE DE CONSENTIMIENTO (sustituye al alert() bloqueante)
   Un alert() nativo interrumpe a los lectores de pantalla, no
   se puede estilar y en móvil tapa el propio checkbox que hay
   que marcar. Aquí el aviso vive junto al campo, con role="alert"
   para que se anuncie solo.
---------------------------------------------------------- */
function setConsentError(show) {
  const box   = document.getElementById('consent-box');
  const error = document.getElementById('consent-error');
  if (error) error.hidden = !show;
  if (box)   box.classList.toggle('consent-box--error', show);
}

/* ==========================================================
   FUNCIÓN PRINCIPAL: CALCULAR
   Orquesta lectura → cálculo → UI → gráfico → feedback
========================================================== */
function calcular() {
  const btnCalc = document.getElementById('btn-calc');
  if (btnCalc?.classList.contains('btn-calc--over')) {
    btnCalc.classList.remove('shake');
    void btnCalc.offsetWidth;
    btnCalc.classList.add('shake');
    document.getElementById('hours-overflow')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // --------------------------------------------------------
  // 1. VALIDACIÓN DEL CONSENTIMIENTO (Ley 1581/2012)
  //    Bloqueo técnico antes de procesar cualquier dato.
  // --------------------------------------------------------
  const consentBox = document.getElementById('consent_accepted');
  if (!consentBox?.checked) {
    setConsentError(true);
    consentBox?.focus();
    document.getElementById('consent-box')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return; // detener ejecución
  }
  setConsentError(false);

  // --------------------------------------------------------
  // 2. CAPTURA Y CONVERSIÓN A HORAS SEMANALES
  // --------------------------------------------------------
  const f = readForm();
  const w = toWeekly(f);

  // --------------------------------------------------------
  // 3. ALGORITMO INSTITUCIONAL DE BIENESTAR
  // --------------------------------------------------------

  // Necesidades corporales ineludibles (sueño, alimentación, aseo)
  const tEstructural = w.hSleep + w.hFood + w.hGrooming;

  // Tiempo académico, obligaciones fijas y hogar
  const tAcademico   = w.hStudy + w.hOther + w.hHouseTasks;

  // Bienestar activo: física + social + hobbies/actividades restauradoras
  const tBienestar   = w.hPhysical + w.hSocial + w.hHobby;

  // Ocio digital: consumo pasivo de pantallas
  const tOcioDigital = w.hScreen;

  // Total ocupado
  const tOcupado = totalOcupado(w);

  // Tiempo libre neto (puede ser negativo: sobreocupación crítica)
  const tLibreNeto = CONFIG.totalHoras - tOcupado;

  // Segmento gráfico: tiempo libre neto puro
  const tOcioYLibre = Math.max(0, tLibreNeto);

  // --------------------------------------------------------
  // 4. ACTUALIZAR TARJETAS DE RESULTADO
  // --------------------------------------------------------
  setResult('sleep',       w.hSleep);
  setResult('food',        w.hFood);
  setResult('grooming',    w.hGrooming);
  setResult('transit',     w.hTransit);
  setResult('study',       w.hStudy);
  setResult('work',        w.hWork);
  setResult('obligations', w.hOther);
  setResult('screen',      w.hScreen);
  setResult('physical',    w.hPhysical);
  setResult('social',      w.hSocial);
  setResult('hobby',       w.hHobby);
  setResult('free',        Math.max(0, tLibreNeto));
  setResult('total',       tOcupado);

  // --------------------------------------------------------
  // 5. MOSTRAR SECCIONES OCULTAS
  // --------------------------------------------------------
  ['.results-section', '.chart-section', '.feedback-section']
    .forEach(sel => document.querySelector(sel)?.classList.add('visible'));

  // --------------------------------------------------------
  // 6. GRÁFICO Y FEEDBACK
  // --------------------------------------------------------
  renderChart({ ...w, tAcademico, tOcioDigital, tOcioYLibre });

  renderFeedback({
    tLibreNeto, tBienestar, tOcioDigital, tAcademico,
    hTransit: w.hTransit, hWork: w.hWork,
    sleep: f.sleep, isStudent: f.isStudent,
    hPhysical: w.hPhysical, hSocial: w.hSocial, hFood: w.hFood,
    hStudy: w.hStudy, hHouseTasks: w.hHouseTasks, hHobby: w.hHobby
  });

  // Anuncio para lectores de pantalla: el scroll automático no
  // comunica nada a quien navega sin ver la página.
  const status = document.getElementById('calc-status');
  if (status) {
    status.textContent =
      `Resultados listos. Tienes ${fmt(Math.max(0, tLibreNeto))} horas libres a la semana ` +
      `y ${fmt(tBienestar)} horas de bienestar activo. ` +
      `El detalle está a continuación.`;
  }

  // --------------------------------------------------------
  // 7. SCROLL SUAVE A RESULTADOS
  // --------------------------------------------------------
  setTimeout(() => {
    document.querySelector('.results-section')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 150);

  // --------------------------------------------------------
  // 8. CIERRE DE RECOLECCIÓN — aplicación 100% estática
  //    El periodo de captura del Informe 2026-1 finalizó: ya no
  //    se escribe en ninguna base de datos externa. Antes de
  //    avisarlo, guardamos un snapshot local de esta respuesta
  //    (mismos nombres de campo que registros_bienestar_rows.json)
  //    para poder simular su impacto en las estadísticas globales.
  // --------------------------------------------------------
  saveLocalSnapshot({
    is_student:              f.isStudent,
    sleep_hours:             round2(w.hSleep),
    transport_hours:         round2(w.hTransit),
    food_hours:              round2(w.hFood),
    grooming_hours:          round2(w.hGrooming),
    house_tasks_hours:       round2(w.hHouseTasks),
    class_hours:             round2(f.classHours),
    self_study_hours:        round2(f.selfStudyHours),
    academic_load_hours:     round2(w.hStudy),
    work_hours:              round2(w.hWork),
    obligations_hours:       round2(w.hOther),
    scrolling_hours:         round2(w.hScreen),
    physical_activity_hours: round2(w.hPhysical),
    quality_social_hours:    round2(w.hSocial),
    other_hobbies_hours:     round2(w.hHobby),
    available_time:          round2(tLibreNeto),
    wellbeing_time:          round2(tBienestar),
    occupied_time:           round2(tOcupado),
  });

  showLocalSubmissionMessage();
}

/* ----------------------------------------------------------
   PERSISTENCIA LOCAL: snapshot anónimo en localStorage
   Reutiliza los mismos nombres de campo que el JSON estático
   del dashboard (registros_bienestar_rows.json), de modo que
   este snapshot pueda mezclarse ahí para simular un impacto
   real en las estadísticas globales del Informe 2026-1.

   No se guarda ningún identificador de la persona: ni nombre,
   ni correo, ni IP. El id es aleatorio y solo sirve para
   distinguir un registro de otro dentro de este dispositivo.
---------------------------------------------------------- */
const LOCAL_SNAPSHOT_KEY = 'rapsi_user_snapshots';
const MAX_SNAPSHOTS      = 50;   // techo de crecimiento en localStorage

function saveLocalSnapshot(fields) {
  try {
    const snapshot = {
      id:               (window.crypto?.randomUUID?.() ?? `local-${Date.now()}`),
      usuario_id:       null,
      anonymous_mode:   true,
      consent_accepted: true,
      created_at:       new Date().toISOString(),
      ...fields,
    };

    let snapshots = [];
    const raw = localStorage.getItem(LOCAL_SNAPSHOT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migra un snapshot antiguo (objeto único, formato pre-acumulativo) a array.
      snapshots = Array.isArray(parsed) ? parsed : [parsed];
    }

    snapshots.push(snapshot);
    // Conserva solo los más recientes: sin este tope, recalcular
    // muchas veces haría crecer localStorage sin límite.
    if (snapshots.length > MAX_SNAPSHOTS) {
      snapshots = snapshots.slice(-MAX_SNAPSHOTS);
    }

    localStorage.setItem(LOCAL_SNAPSHOT_KEY, JSON.stringify(snapshots));
  } catch (err) {
    // localStorage puede no estar disponible (modo privado, cuota llena, etc.)
    console.warn('[RAPsi] No se pudo guardar el snapshot local:', err?.message);
  }
}

/* ----------------------------------------------------------
   CIERRE DE RECOLECCIÓN: confirmación local (sin backend)
   Aviso flotante breve y discreto — no compite con los
   resultados que la persona está a punto de ver. La invitación
   al Informe 2026-1 vive de forma permanente y no invasiva en
   el bloque de reflexión final (ver index.html).
---------------------------------------------------------- */
function showLocalSubmissionMessage() {
  // Evita duplicados si se recalcula varias veces seguidas
  document.getElementById('rapsi-toast')?.remove();

  const toast = document.createElement('div');
  toast.id = 'rapsi-toast';
  toast.className = 'rapsi-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `
    <div class="rapsi-toast-icon" aria-hidden="true">✓</div>
    <div class="rapsi-toast-text">
      Al final, puedes consultar tus respuestas, unidas junto con las estadísticas del 2026-1.
    </div>
    <button type="button" class="rapsi-toast-close" aria-label="Cerrar aviso">&times;</button>`;

  document.body.appendChild(toast);

  let dismissTimer;
  const dismiss = () => {
    toast.classList.add('rapsi-toast--out');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  };
  const scheduleDismiss = () => { dismissTimer = setTimeout(dismiss, 9000); };

  toast.querySelector('.rapsi-toast-close').addEventListener('click', dismiss);
  // Pausa el autodescartado mientras la persona está leyendo
  // (ratón encima o foco dentro del aviso, para navegación por teclado)
  toast.addEventListener('mouseenter', () => clearTimeout(dismissTimer));
  toast.addEventListener('mouseleave', scheduleDismiss);
  toast.addEventListener('focusin',    () => clearTimeout(dismissTimer));
  toast.addEventListener('focusout',   scheduleDismiss);

  // Animación de entrada (setTimeout en vez de requestAnimationFrame:
  // así dispara igual aunque la pestaña esté en segundo plano) y
  // autodescartado.
  setTimeout(() => toast.classList.add('rapsi-toast--in'), 10);
  scheduleDismiss();
}

/* ----------------------------------------------------------
   HELPER: actualizar una tarjeta de resultado con animación
---------------------------------------------------------- */
/* Microdatos institucionales por categoría — se muestran en "Así se ve tu semana"
   para invitar a la reflexión sin emitir juicio sobre el dato del usuario. */
const FACTS = {
  sleep:       'Los CDC y la OMS recomiendan 7–9 h/noche para adultos de 18–60 años. El sueño consolida la memoria, regula las emociones y protege la salud cardiovascular (CDC, 2024).',
  food:        'Comer despacio (al menos 20 min por comida, sin pantallas) permite al cuerpo liberar a tiempo las señales de saciedad. Mantener horarios regulares de desayuno, almuerzo y cena favorece hábitos alimentarios saludables a largo plazo (Kokkinos et al., 2009; OMS, 2024).',
  grooming:    'Una rutina diaria de higiene completa toma en promedio 60–90 min',
  transit:     'Estudiantes de Bogotá invierten en promedio 1.5–2 h/día en desplazamientos',
  study:       'Cada crédito UNAL equivale a 3 h semanales (clase + estudio independiente)',
  obligations: 'Las obligaciones de cuidado y voluntariado cuentan como trabajo invisible',
  work:        'Jornada legal en Colombia: 46 h/semana (desde julio 2025: 44 h)',
  screen:      'En universitarios de 21–23 años, más de 3 h/día en pantallas recreativas se asocia con mayor ansiedad, trastornos del sueño y aislamiento social (Osman, 2025). El promedio en jóvenes adultos es de 6 h/día (DataReportal 2024).',
  physical:    'La OMS recomienda ≥150 min/sem de actividad moderada o ≥75 min intensa. No tiene que ser gimnasio: bailar, nadar, subir escaleras o hacer yoga en casa cuenta (OMS, 2020).',
  social:      'Compartir tiempo presencial con personas cercanas (al menos 2 h/sem) tiene efecto directo sobre el bienestar emocional (Chalela-Naffah et al., Revista Latinoamericana de Investigación).',
  hobby:       'Las actividades creativas —pintura, música, escritura, meditación— activan zonas del cerebro asociadas al placer y la regulación emocional. El proceso importa más que el resultado (Stuckey & Nobel, American Journal of Public Health, 2010).',
  free:        'El bienestar activo recarga distinto al tiempo libre pasivo',
  total:       'Las 168 h semanales son el único recurso verdaderamente igualitario entre personas'
};

function setResult(key, value) {
  const valEl  = document.getElementById('res-' + key);
  const factEl = document.getElementById('res-' + key + '-pct');

  if (valEl) {
    valEl.textContent = fmt(value);
    valEl.classList.remove('animate-count');
    void valEl.offsetWidth; // fuerza reflow para reiniciar animación
    valEl.classList.add('animate-count');
  }

  if (factEl) {
    factEl.textContent = FACTS[key] || '';
  }
}

/* ==========================================================
   GRÁFICO DOUGHNUT — CATEGORÍAS MACRO
   Agrupa las variables del formulario en segmentos legibles.
========================================================== */
function renderChart({ hSleep, hFood, hGrooming, hTransit, tAcademico,
                        hWork, tOcioDigital, hPhysical, hSocial, hHobby, tOcioYLibre }) {

  const canvas = document.getElementById('weekChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const CATEGORIAS = [
    {
      label: 'Sueño',
      value: hSleep,
      color: '#27546c',
      desc:  'Sueño nocturno acumulado en la semana'
    },
    {
      label: 'Alimentación',
      value: hFood,
      color: '#d4a574',
      desc:  'Tiempo dedicado a preparar, comer y descansar post-comida'
    },
    {
      label: 'Cuidado Personal',
      value: hGrooming,
      color: '#3d8ba0',
      desc:  'Higiene, arreglo y rituales de autocuidado'
    },
    {
      label: 'Transporte',
      value: hTransit,
      color: '#5a9bb5',
      desc:  'Desplazamientos semanales'
    },
    {
      label: 'Academia y Obligaciones',
      value: tAcademico,
      color: '#ff9491',
      desc:  'Carga académica, hogar y compromisos fijos'
    },
    {
      label: 'Trabajo',
      value: hWork,
      color: '#e8956d',
      desc:  'Trabajo remunerado o prácticas'
    },
    {
      label: 'Ocio Digital',
      value: tOcioDigital,
      color: '#ffccc9',
      desc:  'Redes sociales, streaming, scroll'
    },
    {
      label: 'Deporte y salud',
      value: hPhysical,
      color: '#2F7A8C',
      desc:  'Ejercicio, deporte y caminatas activas'
    },
    {
      label: 'Tiempo con los que quieres',
      value: hSocial,
      color: '#5BC8AF',
      desc:  'Amigos, pareja, familia — conexión genuina'
    },
    {
      label: 'Lo que te apasiona',
      value: hHobby,
      color: '#B79CED',
      desc:  'Creatividad, hobbies y actividades restauradoras'
    },
    {
      label: 'Tiempo libre',
      value: tOcioYLibre,
      color: '#e2e8f0',
      desc:  'Recreación libre y tiempo sin compromisos'
    },
  ];

  const chartData = {
    labels:   CATEGORIAS.map(c => c.label),
    datasets: [{
      data:             CATEGORIAS.map(c => Math.max(0, c.value)),
      backgroundColor:  CATEGORIAS.map(c => c.color),
      borderWidth:      3,
      borderColor:      '#ffffff',
      hoverBorderWidth: 4,
      hoverOffset:      10,
    }]
  };

  // Respeta "reducir movimiento" del sistema operativo
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  if (weekChart) {
    // Actualizar sin destruir la instancia (evita parpadeo)
    weekChart.data = chartData;
    weekChart.update(reduceMotion ? 'none' : 'active');
  } else {
    weekChart = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: chartData,
      options: {
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => {
                const val  = item.parsed;
                const pctV = ((val / CONFIG.totalHoras) * 100).toFixed(1);
                return `  ${fmt(val)} h  (${pctV}%)`;
              },
              afterLabel: (item) => '  ' + CATEGORIAS[item.dataIndex].desc,
            },
            backgroundColor: '#1a2e38',
            titleColor:      '#ffffff',
            bodyColor:       'rgba(255,255,255,.8)',
            padding:         14,
            cornerRadius:    10,
            boxPadding:      4,
          }
        },
        animation: reduceMotion ? false : {
          animateRotate: true,
          duration:      900,
          easing:        'easeInOutQuart'
        },
      }
    });
  }

  // --------------------------------------------------------
  // LEYENDA PERSONALIZADA (HTML)
  // Se construye con el DOM en vez de innerHTML: no hay
  // concatenación de strings que pueda convertirse en un
  // vector de inyección si mañana las etiquetas dejan de ser
  // constantes.
  // --------------------------------------------------------
  const legendEl = document.getElementById('chart-legend');
  if (!legendEl) return;
  legendEl.replaceChildren(...CATEGORIAS.map(item => {
    const value = Math.max(0, item.value);
    const barW  = Math.min(100, Math.round((value / CONFIG.totalHoras) * 100));

    const row = document.createElement('div');
    row.className = 'legend-item';

    const dot = document.createElement('div');
    dot.className = 'legend-dot';
    dot.style.background = item.color;
    dot.style.border     = '1.5px solid rgba(0,0,0,.08)';

    const info  = document.createElement('div');
    info.className = 'legend-info';
    const name  = document.createElement('div');
    name.className   = 'legend-name';
    name.textContent = item.label;
    const hours = document.createElement('div');
    hours.className   = 'legend-hours';
    hours.textContent = `${fmt(value)} h · ${pct(value)}`;
    info.append(name, hours);

    const barWrap = document.createElement('div');
    barWrap.className = 'legend-bar-wrap';
    const bar = document.createElement('div');
    bar.className      = 'legend-bar';
    bar.style.width    = barW + '%';
    bar.style.background = item.color;
    bar.style.border   = '1px solid rgba(0,0,0,.06)';
    barWrap.appendChild(bar);

    row.append(dot, info, barWrap);
    return row;
  }));
}

/* ==========================================================
   FEEDBACK DE EQUILIBRIO OCUPACIONAL · MOTOR v2

   Filosofía: el bienestar es un balance entre tres bloques —
   carga (académico + trabajo + transporte), sostenimiento
   (sueño + comida + higiene), y bienestar activo (físico +
   social + hobbies). Las reglas miran combinaciones, no
   umbrales aislados.

   Tono: describir realidades, ofrecer palancas, no moralizar.
   Lo estructural (transporte, créditos altos) se reframea
   como oportunidad, no como problema a eliminar.

   Estructura: if independientes (no cadena), tope MAX = 4
   tarjetas + cierre universal. Técnica del sándwich:
   alertas y fortalezas conviven en la misma vista.
========================================================== */
function renderFeedback({
  tLibreNeto, tBienestar, tOcioDigital,
  tAcademico, hTransit, hWork,
  sleep, isStudent,
  hPhysical, hSocial, hFood,
  hStudy, hHouseTasks, hHobby
}) {
  const hSleep         = sleep * CONFIG.diasSemana;
  const cargaDura      = tAcademico + hWork + hTransit;
  const MAX            = 4;
  const cards          = [];
  // ════════════════════════════════════════════════════════
  // ALERTAS — describir realidades, ofrecer palancas
  // Nota: la sobreocupación crítica (tLibreNeto < 0) ya no se
  // comunica aquí como tarjeta — calcular() bloquea el cálculo
  // en tiempo real (ver #hours-overflow) antes de llegar a este
  // punto, así que esa condición nunca se alcanza en la práctica.
  // ════════════════════════════════════════════════════════
  // 1 · Sueño por debajo de la recomendación (umbral estricto: 7 h/noche)
  if (cards.length < MAX && hSleep < 49) {
    cards.push({
      type: 'warn', icon: '😴',
      title: 'Duermes menos de lo recomendado',
      body: `Promedias ${fmt(hSleep / 7)} h de sueño por noche. Los CDC (2024)
             recomiendan de 7 a 9 horas. Menos de esto afecta la consolidación
             de memoria, aumenta la irritabilidad y el riesgo metabólico
             (National Heart, Lung, and Blood Institute, 2022).`
    });
  }
  // 2 · Burnout estructural
  if (cards.length < MAX && cargaDura > 60 && hSleep < 42) {
    cards.push({
      type: 'warn', icon: '🚨',
      title: 'Carga alta con descanso corto',
      body: `Estás sosteniendo ${fmt(cargaDura)} h/sem de obligaciones duras
             (estudio + trabajo + transporte) con ${fmt(hSleep / 7)} h de sueño
             por noche. Una semana así es viable; un mes así no lo es. El
             cuerpo paga con concentración, ánimo y salud antes de que se note. La <a href="https://drive.google.com/file/d/1wcdjd-gvyvrm92v3QPHVvHjC1LDX5ASD/view?usp=sharing"
             target="_blank" rel="noopener noreferrer"
             class="feedback-ig-link">Cartilla de Bienestar RAPsi</a>
             tiene estrategias concretas de afrontamiento para este momento.`
    });
  }
  // 3 · Privación severa de sueño
  if (cards.length < MAX && hSleep < 35) {
    cards.push({
      type: 'warn', icon: '😵',
      title: 'Alerta del cuerpo: dormir menos de 5 h',
      body: `${fmt(hSleep / 7)} h por noche no es disciplina, es deuda
             acumulándose. La regulación emocional, la memoria de corto plazo
             y la respuesta inmune dependen del sueño profundo. Una semana
             así se siente como tres. Si no puedes dormir más esta semana,
             al menos protege un día completo de recuperación. La <a href="https://drive.google.com/file/d/1wcdjd-gvyvrm92v3QPHVvHjC1LDX5ASD/view?usp=sharing"
             target="_blank" rel="noopener noreferrer"
             class="feedback-ig-link">Cartilla de Bienestar RAPsi</a>
             tiene estrategias concretas de afrontamiento para este momento.`
    });
  }
  // 4 · Afrontamiento Evitativo (sobrecarga + refugio digital + sin red social)
  if (cards.length < MAX && (hStudy + hWork) > 45 && tOcioDigital > 21 && hSocial < 2) {
    cards.push({
      type: 'warn', icon: '🌀',
      title: 'Afrontamiento Evitativo',
      body: `Sobrecarga y refugio digital: Las pantallas parecen ser tu escape.
             El scrolling infinito silencia la ansiedad a corto plazo, pero la
             acumula. Busca afrontar el estrés apoyándote en tu red social; es
             tu mayor factor protector (Lazarus & Folkman).`
    });
  }
  // 5 · Scrolling por encima de 3 h/día (umbral estricto, independiente)
  if (cards.length < MAX && tOcioDigital > 21) {
    cards.push({
      type: 'warn', icon: '📲',
      title: 'Más de 3 horas diarias en redes',
      body: `Reportas ${fmt(tOcioDigital / 7)} h/día en pantallas recreativas.
             Tiempos superiores a 3 horas diarias en redes se asocian con
             trastornos del sueño, agotamiento y mayor ansiedad en
             universitarios (Osman, 2025).`
    });
  }
  // 6 · Procrastinación del sueño por pantallas
  if (cards.length < MAX && tOcioDigital > 15 && hSleep < 49) {
    cards.push({
      type: 'warn', icon: '🌙',
      title: 'Las pantallas están negociando con tu descanso',
      body: `${fmt(tOcioDigital)} h/sem en pantallas recreativas + ${fmt(hSleep / 7)} h
             de sueño por noche. La calidad del sueño cae aunque cierres los
             ojos: la luz azul retrasa la melatonina y el "una más" nocturno
             acumula deuda cognitiva. El experimento que sí funciona: poner
             el celular a cargar lejos de la cama. Además, hacer dos actividades
             a la vez —scrollear mientras comes o estudias— consume más energía
             cognitiva y reduce la concentración disponible para cada una.`
    });
  }
  // 7 · Evasión digital (no simple consumo alto)
  if (cards.length < MAX && tOcioDigital > 20 && tBienestar < tOcioDigital / 2) {
    cards.push({
      type: 'warn', icon: '📱',
      title: 'Pantallas como refugio, no como ocio',
      body: `Pasas ${fmt(tOcioDigital)} h en pantallas recreativas, pero solo
             ${fmt(tBienestar)} h en actividades restauradoras activas
             (deporte, vínculos, hobbies). A veces no es ocio, es agotamiento
             buscando salida. La pregunta honesta: ¿de qué descansas cuando
             scrolleas? Tu celular registra tu uso real en Bienestar Digital (Android)
             o Tiempo en pantalla (iOS) — el número a veces sorprende y ayuda a
             tomar decisiones más conscientes.
             <br><br>
             <a href="https://www.instagram.com/rapsi.unal/" target="_blank" rel="noopener noreferrer" class="feedback-media-link">🎬 Ver la videocápsula de estudiantes</a>
             <a href="https://www.instagram.com/rapsi.unal/" target="_blank" rel="noopener noreferrer" class="feedback-media-link">📱 Ver tips en nuestro Carrusel de Ocio</a>`
    });
  }
  // 8 · Comidas con poco espacio (umbral ~1.5 h/día = 3 comidas × 30 min)
  if (cards.length < MAX && hFood < 10.5) {
    cards.push({
      type: 'warn', icon: '🍽️',
      title: 'Comidas con poco espacio',
      body: `Dedicas ${fmt(hFood / 7)} h/día a comer (incluye preparar y el
             descanso post-comida). Se recomienda extender las comidas a
             unos 30 minutos. Comer pausado permite que el cerebro registre
             la saciedad (Kokkinos et al., 2009).`
    });
  }
  // 9 · Maratón de Tareas (mucha carga doméstica + poco tiempo libre)
  if (cards.length < MAX && hHouseTasks > 12 && tLibreNeto < 10) {
    cards.push({
      type: 'warn', icon: '🧹',
      title: 'Maratón de Tareas',
      body: `Las labores domésticas consumen energía. Para evitar que sean un
             estresor, Kielhofner (2008) recomienda distribuirlas en bloques
             cortos de 20-30 minutos en lugar de hacer maratones de limpieza
             el fin de semana.`
    });
  }
  // 10 · Aislamiento social (regla independiente, no condicionada a estudio)
  if (cards.length < MAX && hSocial < 2) {
    cards.push({
      type: 'warn', icon: '🫥',
      title: 'Vínculos en pausa esta semana',
      body: `Reportas menos de 2 h de tiempo de calidad con personas que te
             importan. Los vínculos no se construyen en crisis — se cultivan
             antes. Una llamada de 15 minutos a alguien con quien te ríes
             es de las palancas más rentables que existen para la salud mental.`
    });
  }
  // 11 · Micro-pausas (sin espacio para el ocio)
  if (cards.length < MAX && tBienestar < 3) {
    cards.push({
      type: 'warn', icon: '🧘',
      title: 'Micro-pausas',
      body: `Cuando no hay espacio para el ocio, las micro-pausas salvan. 10 a
             20 minutos diarios de mindfulness reducen significativamente el
             estrés en universitarios (Aiquipa-Meza, 2024). Apps como Insight
             Timer son un buen inicio.`
    });
  }
  // 12 · Tiempo libre sin restauración
  if (cards.length < MAX && tLibreNeto >= 5 && tBienestar < 3) {
    cards.push({
      type: 'warn', icon: '⏳',
      title: 'Tiempo libre sin convertirse en bienestar',
      body: `Tienes ${fmt(tLibreNeto)} h libres a la semana, pero solo
             ${fmt(tBienestar)} h en actividades restauradoras. El descanso
             pasivo no recarga igual que la actividad restauradora: el cuerpo
             y la mente necesitan moverse, conectar, crear — no solo dejar
             de hacer cosas.`
    });
  }
  // 13 · Transporte como segunda jornada (reframe, no prohibición)
  if (cards.length < MAX && hTransit > 12) {
    cards.push({
      type: 'warn', icon: '🚌',
      title: 'El transporte es una segunda jornada',
      body: `${fmt(hTransit)} h/sem en transporte es tiempo de tu semana que
             ya está siendo invertido — no se puede recuperar, pero sí se
             puede convertir. ¿Audiolibros? ¿Podcast de algo que te interese?
             ¿Una serie liviana? ¿Cerrar los ojos y descansar de verdad?
             La palanca no es "transportarse menos", es decidir qué pasa
             dentro de esas horas.`
    });
  }
  // ════════════════════════════════════════════════════════
  // FORTALEZAS — reconocer balance, no umbrales aislados
  // ════════════════════════════════════════════════════════
  // 14 · Balance Integral (la regla más exigente — la joya)
  if (
    cards.length < MAX &&
    hSleep >= 49 &&
    tBienestar >= 7 &&
    tLibreNeto >= 0 &&
    tOcioDigital <= 14
  ) {
    cards.push({
      type: 'strength', icon: '🌟',
      title: 'Balance Integral',
      body: `Estás cuidando varios pilares al tiempo: sueño en rango saludable,
             bienestar activo presente, semana que cierra sin sobregiro, y uso
             medido de pantallas. Esto es lo que se ve cuando alguien se conoce
             y se respeta. Sostenlo — es más difícil de recuperar que de
             mantener.`
    });
  }
  // 15 · Carga académica saludable (contextual: solo si el resto está bien)
  if (
    cards.length < MAX &&
    isStudent &&
    tAcademico >= 15 &&
    hSleep >= 42 &&
    tBienestar >= 5
  ) {
    cards.push({
      type: 'strength', icon: '📖',
      title: 'Carga académica sostenida con balance',
      body: `Manejas ${fmt(tAcademico)} h/sem de estudio sin sacrificar
         lo que sostiene esa carga: duermes ${fmt(hSleep / 7)} h por
         noche y dedicas ${fmt(tBienestar)} h al bienestar activo.
         Los estilos de afrontamiento centrados en el problema
         (planificar, priorizar, buscar apoyo) son los que mejor
         predicen el bienestar bajo carga alta. Tú estás haciendo eso.`
    });
  }
  // 16 · Descanso en rango OMS
  if (cards.length < MAX && hSleep >= 49 && hSleep <= 63) {
    cards.push({
      type: 'strength', icon: '🌙',
      title: 'Descanso en rango OMS',
      body: `Duermes ${fmt(hSleep / 7)} h por noche, dentro del rango
             recomendado por los CDC y la OMS (7–9 h). El sueño es el
             pilar invisible del rendimiento cognitivo: consolida la
             memoria del día, regula las emociones y reduce el riesgo
             cardiovascular. Estás cuidando lo que sostiene todo lo demás.`
    });
  }
  // 17 · Vida activa
  if (cards.length < MAX && hPhysical >= 3) {
    cards.push({
      type: 'strength', icon: '🏃',
      title: 'Cuerpo en movimiento',
      body: `${fmt(hPhysical)} h/sem de actividad física. La OMS recomienda
             150 min de actividad moderada o 75 min intensa por semana —
             no tiene que ser gimnasio: bailar, caminar rápido, nadar o
             hacer yoga en casa cuentan. Ese umbral protege contra la
             ansiedad, mejora el sueño y fortalece la salud mental. Además,
             dedicar al menos 2 horas a encuentros sociales sin agenda
             académica impacta directo en el bienestar emocional
             (Chalela-Naffah).`
    });
  }
  // 18 · Red social viva
  if (cards.length < MAX && hSocial >= 5) {
    cards.push({
      type: 'strength', icon: '💬',
      title: 'Red de apoyo activa',
      body: `Dedicas ${fmt(hSocial)} h semanales a tiempo de calidad con
             personas que te importan. Investigaciones latinoamericanas en
             bienestar universitario señalan al menos 2 horas presenciales
             por semana como umbral de efecto protector. Los vínculos no
             se construyen en crisis — se cultivan antes. La OMS recomienda
             además 150 min semanales de actividad física: combinar ambos
             —movimiento y encuentros sin agenda académica— es lo que más
             impacta el bienestar emocional (Chalela-Naffah).`
    });
  }
  // 19 · Juego y Creatividad
  if (cards.length < MAX && hHobby > 2) {
    cards.push({
      type: 'strength', icon: '🎨',
      title: 'Juego y Creatividad',
      body: `El juego y la creatividad no son solo para la infancia. Dedicar
             tiempo a un hobby sin presión de resultados activa tu sistema de
             recompensa cerebral y te regula emocionalmente (Brown, 2009;
             Stuckey & Nobel).`
    });
  }
  // 20 · Autocuidado Ocupacional
  if (cards.length < MAX && hHouseTasks > 4 && hHouseTasks < 10) {
    cards.push({
      type: 'strength', icon: '🧺',
      title: 'Autocuidado Ocupacional',
      body: `Mantener tu espacio y tus comidas al día es Autocuidado
             Ocupacional. Has integrado estas tareas en tu rutina, lo que
             genera sensación de logro y control sobre tu entorno
             (Kielhofner, 2008).`
    });
  }
  // 21 · Higiene digital
  if (cards.length < MAX && tOcioDigital <= 12) {
    cards.push({
      type: 'strength', icon: '✨',
      title: 'Pantallas bajo control',
      body: `${fmt(tOcioDigital)} h/sem en pantallas recreativas es uso
             moderado. La contención del consumo digital pasivo libera
             espacio cognitivo y emocional para descanso real, conversaciones
             presentes y actividades que genuinamente restauran.`
    });
  }
  // ════════════════════════════════════════════════════════
  // CIERRE UNIVERSAL — siempre presente
  // ════════════════════════════════════════════════════════
  cards.push({
    type: 'ok', icon: '🌱',
    title: 'Conocerse es el primer paso del autocuidado',
    body: `Haber completado esta reflexión ya dice algo sobre ti: que te importa
           tu bienestar, no solo tu rendimiento. No existe una distribución
           perfecta del tiempo. Existe la que te permita estudiar con sentido,
           descansar de verdad y seguir siendo tú.
           <br><br>
           Un tip de afrontamiento: identifica qué puedes controlar
           (afrontamiento centrado en el problema) y evita aislarte. El apoyo
           social es tu principal factor protector.
           <br><br>
           Recuerda: tu bienestar no depende solo de ti, sino del entorno que
           habitas. La universidad tiene redes para apoyarte.
           <br><br>
           Si algo de lo que viste hoy
           te inquieta,
           <a href="https://www.instagram.com/rapsi.unal/" target="_blank" rel="noopener noreferrer" class="feedback-ig-link">@rapsi.unal</a> y
           <a href="https://www.instagram.com/acompanamientounal_bog/"
              target="_blank" rel="noopener noreferrer"
              class="feedback-ig-link">@acompanamientounal_bog</a>
           están para acompañarte. Si necesitas orientación profesional,
           la <a href="https://drive.google.com/file/d/1kB44Fki-kYU-Hty2Sxnd9Dh-dXKSZisG/view?usp=sharing"
                target="_blank" rel="noopener noreferrer"
                class="feedback-ig-link">Ruta de Salud Mental UNAL</a>
           explica cómo acceder a acompañamiento especializado.
           <br>
           Si te interesa fortalecer habilidades, la
           <a href="https://sites.google.com/unal.edu.co/escuela-habilidades-aai/inicio"
              target="_blank" rel="noopener noreferrer"
              class="feedback-ig-link">Escuela de Habilidades para la Vida UNAL</a>
           tiene talleres abiertos a toda la comunidad.<br><br>
           <a href="https://docs.google.com/document/d/1u4TNtav8ljhSD3NhbAP3uy-_0vQlXI0MNvAuqemWISU/edit?usp=sharing"
              target="_blank" rel="noopener noreferrer"
              class="feedback-ig-link">Ver las fuentes bibliográficas</a>
           de este análisis.
           <a href="/stats/" class="reflection-stats-link">
             📊 Conocer el panorama general de bienestar institucional (Informe 2026-1) ⟶
           </a>`
  });
  // ════════════════════════════════════════════════════════
  // RENDERIZAR
  // ════════════════════════════════════════════════════════
  const container = document.getElementById('feedback-cards');
  if (!container) return;
  container.innerHTML = cards.map((c, i) => `
    <div class="feedback-card ${c.type}" style="animation-delay:${i * 0.08}s">
      <div class="fc-icon" aria-hidden="true">${c.icon}</div>
      <div class="fc-content">
        <h3>${c.title}</h3>
        <p>${c.body}</p>
      </div>
    </div>
  `).join('');
}

/* ----------------------------------------------------------
   BARRA DE PROGRESO DE SCROLL
   Se actualiza dentro de requestAnimationFrame y con listener
   pasivo: así el scroll nunca espera por este cálculo (mejora
   la métrica INP de Core Web Vitals, que Google usa para
   posicionar).
---------------------------------------------------------- */
function initScrollProgress() {
  const bar = document.getElementById('progress-bar');
  if (!bar) return;

  let ticking = false;
  const update = () => {
    const scrollTop   = document.documentElement.scrollTop || document.body.scrollTop;
    const scrollTotal = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (scrollTotal > 0 ? (scrollTop / scrollTotal) * 100 : 0) + '%';
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });

  update();
}

/* ----------------------------------------------------------
   INICIALIZACIÓN AL CARGAR LA PÁGINA
   Conecta todos los eventos (sin manejadores inline) y
   sincroniza los sliders con sus etiquetas de valor.
---------------------------------------------------------- */
function init() {
  // Sliders: etiqueta en vivo + contador de 168 h
  SLIDER_IDS.forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => syncRange(id));
    syncRange(id);
  });

  // Campo numérico libre "Otras obligaciones"
  document.getElementById('other')?.addEventListener('input', updateCounter);

  // Botón principal
  document.getElementById('btn-calc')?.addEventListener('click', calcular);

  // El aviso de consentimiento desaparece en cuanto se acepta
  document.getElementById('consent_accepted')
    ?.addEventListener('change', (e) => { if (e.target.checked) setConsentError(false); });

  // Visibilidad condicional del bloque académico
  const isStudentCb   = document.getElementById('is_student');
  const academicField = document.getElementById('academic-field');
  if (isStudentCb) {
    isStudentCb.addEventListener('change', () => {
      if (academicField) academicField.hidden = !isStudentCb.checked;
      updateCounter();
    });
    if (academicField) academicField.hidden = !isStudentCb.checked;
  }

  initScrollProgress();
  updateCounter();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
