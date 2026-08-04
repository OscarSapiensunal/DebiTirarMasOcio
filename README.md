# Ociómetro · Calculadora de tiempo semanal

Herramienta de autoconocimiento del **Área de Acompañamiento Integral** (RAPsi ·
Dirección de Bienestar, Sede Bogotá) de la **Universidad Nacional de Colombia**.

> Cada semana tiene 168 horas. El Ociómetro las reparte entre sueño, alimentación,
> cuidado personal, transporte, estudio, trabajo, pantallas, deporte, vida social y
> hobbies, y devuelve cuánto **tiempo de bienestar** queda realmente — con
> retroalimentación respaldada en literatura científica.

**Producción:** https://ociometro.vercel.app · **Informe 2026-1:** `/stats`

---

## 1. Entender el proyecto en cinco minutos

### Qué hace

Dos páginas, dos propósitos:

| Página | Qué resuelve |
|---|---|
| `/` — **Calculadora** | La persona declara sus rutinas. La app reparte las 168 h, dibuja la distribución y devuelve entre 1 y 5 tarjetas de reflexión escogidas por un motor de reglas. |
| `/stats` — **Informe 2026-1** | Promedios anónimos de la comunidad que ya usó la herramienta, filtrables por fecha y por tipo de usuario. Si la persona ya calculó su semana, su registro se suma a los promedios ("Comunidad + Tú"). |

### La idea de fondo

El proyecto distingue **tres tipos de tiempo** que normalmente se confunden:

- **Tiempo estructural** — sueño, comida, higiene. No es negociable.
- **Carga dura** — estudio, trabajo, transporte, obligaciones. Se puede reorganizar, no eliminar.
- **Tiempo de bienestar** — deporte, vínculos, hobbies. Es lo que de verdad restaura.

El «Ociómetro» propiamente dicho es el tercero. La distinción importa porque *tener
tiempo libre no es lo mismo que estar descansando*: se puede tener 40 h libres y cero
bienestar si todas se van en scroll. El motor de feedback razona sobre combinaciones
(carga alta **y** sueño corto, pantallas altas **y** vínculos bajos), no sobre umbrales
sueltos.

### Cómo está construido

**HTML, CSS y JavaScript sin framework, sin build, sin backend.** Se abre y funciona.
Esa decisión es deliberada: el proyecto tiene que sobrevivir a la rotación de quien lo
mantiene, y cualquier persona con nociones de web puede editarlo sin instalar nada.

```
├── index.html                 Calculadora · metadatos SEO · preguntas frecuentes
├── app.js                     Cálculo de las 168 h y motor de retroalimentación
├── styles.css                 Estilos compartidos por todo el sitio
├── stats/
│   ├── index.html             Informe 2026-1
│   ├── stats.js               Filtros, KPIs, narrativas y gráficas
│   ├── stats.css              Estilos del informe
│   └── registros_bienestar_rows.json   Datos anónimos del periodo (117 registros)
├── vendor/                    Chart.js y tipografías auto-alojadas
├── Imagenes/                  Retratos del equipo (PNG + WebP)
├── vercel.json                Cabeceras de seguridad y política de caché
└── robots.txt · sitemap.xml · site.webmanifest · og-image.png · favicon.ico
```

### Los cuatro archivos que importan

- **`app.js`** — `readForm()` lee el formulario, `toWeekly()` normaliza todo a
  horas/semana (los campos diarios se multiplican por 7), y `renderFeedback()` evalúa
  ~21 reglas independientes con un tope de 4 tarjetas más un cierre universal. Cada
  regla lleva su cita bibliográfica en el propio texto.
- **`stats.js`** — carga el JSON, promedia en cliente, y arma cuatro «historias
  comunitarias» cuyo tono cambia según los datos (fortaleza / favorable / alerta).
- **`styles.css`** — un único sistema de diseño (variables CSS en `:root`) para ambas
  páginas.
- **`vercel.json`** — las cabeceras de seguridad. Sin este archivo el sitio funciona,
  pero desprotegido.

### Trabajar en local

```bash
python -m http.server 8000
```

Abre <http://127.0.0.1:8000>. **No** abras los archivos con doble clic (`file://`):
el informe carga su JSON por red y el navegador lo bloquearía.

---

## 2. Cómo llegó hasta aquí

El proyecto nació como una calculadora suelta y terminó siendo un producto con
identidad, informe estadístico y presencia pública. Estas son las etapas reales, según
el historial del repositorio.

### Abril 2026 · Semilla

Primera versión de la calculadora: repartir 168 horas y mostrar el resultado.

### 14–15 de mayo · Identidad institucional y captura de datos

Se alinea la interfaz con la identidad UNAL/RAPsi y se conecta **Supabase** para
guardar registros anónimos. Aparecen el *toggle* de estudiante, el transporte dual, el
contador en tiempo real y el consentimiento explícito (Ley 1581 de 2012). Nace el
dashboard en `stats/` con insights narrativos y dona interactiva.

### 19 de mayo · Base de datos v3 y motor de feedback v2

Se corrige una fuga de datos, se migra el dashboard a una vista con RLS y se
reescribe la retroalimentación: de umbrales aislados a **reglas combinadas**, con
insignias de tres niveles y narrativas comunitarias en el informe.

### 21 de mayo · Feria de las Emociones

El pico de recolección del semestre. Queda marcado como hito permanente en la línea de
tiempo del informe: `MILESTONE_YMD` en `stats.js`. Ese día llegan también los chips de
unidad temporal (DÍA / SEMANA), el tope duro de 168 h y el menú hamburguesa móvil.

### 10 de junio · Precisión del modelo

Se separan `class_hours` y `self_study_hours` — antes iban juntas y no permitían
distinguir la clase del estudio autónomo. Los filtros del informe pasan a resolverse en
el cliente y se migran los datos del piloto.

### 25 de junio · Cierre de recolección

Termina la captura del Informe 2026-1. La aplicación **se desconecta de Supabase y pasa
a ser 100 % estática**: los datos del periodo quedan congelados en un JSON versionado.
Para no perder el efecto «me veo en los datos», el resultado propio se guarda en el
navegador (`localStorage`) y se suma a los promedios del informe. Llegan el *timeline
slider*, los créditos del equipo y el enriquecimiento con evidencia científica.

### Agosto 2026 · Preparación para la publicación *(versión actual)*

La herramienta funcionaba, pero era invisible y frágil de cara al mundo. Esta etapa la
prepara para vivir en internet por su cuenta:

- **Identidad propia.** El producto pasa a llamarse **Ociómetro** en título, marca,
  navegación y metadatos — antes la dirección y el título hablaban del repositorio, no
  del producto.
- **Posicionamiento.** Metadatos orientados a las búsquedas reales («calculadora de
  tiempo semanal», «en qué se me va la semana»), datos estructurados schema.org,
  sección de preguntas frecuentes indexable, `robots.txt` y `sitemap.xml`.
- **Independencia de terceros.** Chart.js y las tipografías dejan de venir de CDN
  externas y se sirven desde el propio dominio.
- **Corrección de cálculo.** Se elimina un error que trataba el `0` como «campo vacío»:
  quien declaraba 0 h de transporte, hogar o cuidado personal recibía de vuelta los
  valores por defecto y se le sumaban ~12 horas fantasma.
- **Accesibilidad.** Landmarks, navegación por teclado, anuncios para lector de
  pantalla y respeto a «reducir movimiento».
- **Peso.** De ~5 MB a ~1.3 MB. Los retratos del equipo pesaban 4.6 MB (uno solo,
  1.4 MB).

---

## 3. Decisiones de diseño que conviene no deshacer

Cosas que parecen mejorables hasta que se entiende por qué están así:

- **Sin framework ni build.** No es descuido. Un sitio que se despliega copiando
  archivos sobrevive a cambios de equipo; uno que depende de `npm install` caduca.
- **Sin manejadores `onclick` en el HTML.** Todo se conecta con `addEventListener`.
  Eso es lo que permite servir el sitio con una política de seguridad estricta sin
  `unsafe-inline`. Añadir un solo `onclick` obligaría a debilitarla.
- **Chart.js versionado en el nombre del archivo** (`chart-4.4.0.umd.min.js`). Permite
  cachearlo un año sin riesgo: si se actualiza, cambia la URL.
- **El JSON del informe no se bloquea en `robots.txt`.** Googlebot necesita
  descargarlo para renderizar las gráficas; que no aparezca como resultado de búsqueda
  se resuelve con la cabecera `X-Robots-Tag: noindex` en `vercel.json`.
- **Los datos de `localStorage` se validan antes de promediarse.** Ese almacenamiento
  lo puede editar cualquiera desde la consola del navegador; sin saneamiento, un valor
  absurdo contaminaría las cifras del informe institucional.
- **Un aporte propio por día, máximo 10.** Recalcular veinte veces la misma tarde no
  debe pesar veinte veces sobre el promedio de la comunidad.

---

## 4. Privacidad y seguridad

- **No se recogen datos personales.** No pide nombre, correo ni documento, no crea
  cuentas y no envía nada a ningún servidor. El periodo de recolección está cerrado y
  la aplicación es completamente estática. *(El proyecto de Supabase que se usó durante
  la captura fue eliminado.)*
- **Consentimiento (Ley 1581 de 2012).** El cálculo está bloqueado hasta que la persona
  acepta explícitamente el tratamiento de datos.
- **Almacenamiento local.** El resultado se guarda solo en el navegador de quien lo
  usa. Se borra al limpiar los datos del navegador.
- **Cero peticiones a terceros.** Ni CDN ni Google Fonts: nadie externo ve quién usa la
  herramienta.
- **Cabeceras** (`vercel.json`): política de seguridad de contenido estricta, HSTS,
  `nosniff`, `frame-ancestors 'none'` y `Permissions-Policy` restrictiva.

---

## 5. Despliegue

El sitio es estático: Vercel solo publica los archivos tal cual.

**Importar** — *Add New → Project* → elegir el repositorio → framework `Other`, sin
*build command* ni *output directory* → **Deploy**.

**Dirección** — *Settings → General → Project Name* = `ociometro`. Eso produce
`ociometro.vercel.app`. En *Settings → Domains*, marcarlo como **Primary** para que las
direcciones anteriores redirijan y no compitan en Google.

> Si el nombre `ociometro` estuviera ocupado por otra cuenta de Vercel, las
> alternativas son `ociometro-unal.vercel.app` o un dominio institucional
> (`ociometro.unal.edu.co`) gestionado por la DNTIC.

**Si cambia el dominio**, hay que reemplazar `ociometro.vercel.app` en cuatro sitios:
`index.html` (canónica, Open Graph y datos estructurados), `stats/index.html` (lo
mismo), `robots.txt` (línea `Sitemap:`) y `sitemap.xml` (las dos etiquetas `<loc>`).
Una búsqueda y reemplazo los cubre todos.

### Lo que no se puede resolver desde el código

1. **Google Search Console** — añadir la propiedad, verificarla (Google entrega una
   etiqueta `<meta name="google-site-verification">` que se pega en el `<head>` de
   `index.html`), enviar `sitemap.xml` y pedir la indexación de `/` y `/stats`.
2. **Enlaces entrantes** — es el factor que más pesa. Un enlace desde un dominio
   `unal.edu.co`, desde el Instagram de RAPsi o desde un boletín institucional vale más
   que cualquier ajuste de metadatos.
3. **Tiempo** — un dominio nuevo tarda entre 2 y 8 semanas en posicionarse.

---

## 6. Créditos

**Equipo** — Oscar Saavedra (Ingeniería de Sistemas), Maria Rosero (Derecho y
Psicología), Wendy Tocanchón (Terapia Ocupacional), Gisell Triviño (Psicología),
Carolina Morales (Psicología), Diego Ramirez (Economía).

**Agradecimientos** — Fabián Andrés Meneses Morales (Líder de REDai) y Zulma Edith
Camargo Cantor (Jefe del Área de Acompañamiento Integral).

Universidad Nacional de Colombia · Dirección de Bienestar · Sede Bogotá
Instagram: [@rapsi.unal](https://www.instagram.com/rapsi.unal/) ·
[@acompanamientounal_bog](https://www.instagram.com/acompanamientounal_bog/)

**Licencias de terceros** — [Chart.js](https://www.chartjs.org/) 4.4.0 (MIT);
*Playfair Display* y *DM Sans* (SIL Open Font License 1.1).
