import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoCompleto from '../assets/logo_completo.png';

// ── Generación de la Historia Clínica (encuesta) como archivo .pdf real ──
// Usa jsPDF + autoTable (texto vectorial, no una captura de pantalla) para
// que la descarga sea un documento nítido y liviano.

const ENFERMEDADES_FAMILIARES = [
  'Diabetes', 'Presión alta (Hipertensión)', 'Cáncer',
  'Problemas cardíacos', 'Enfermedades mentales', 'Sordera', 'Otras',
];
const ANTECEDENTES_PATOLOGICOS = [
  'Padece o ha padecido alguna enfermedad',
  '¿Le han realizado alguna cirugía?',
  '¿Alguna vez ha convulsionado?',
  '¿Se ha fracturado algún hueso?',
  '¿Usa lentes?',
  '¿Es alérgico a algún medicamento?',
  '¿Toma algún medicamento o suplemento?',
  'Enfermedades o accidentes de trabajo',
];
const EXPOSICION_LABELS: Record<string, string> = {
  ruidos: 'Ruidos fuertes', polvos: 'Polvos', vapores: 'Vapores',
  humos: 'Humos', riesgoElectrico: 'Riesgo eléctrico', usaEpp: 'Usa EPP',
};

const TITLE_BG: [number, number, number] = [191, 219, 254];   // azul claro
const TITLE_TEXT: [number, number, number] = [30, 64, 175];   // azul oscuro (contraste)
const SUBHEAD_BG: [number, number, number] = [224, 238, 252]; // azul más claro
const LABEL_TEXT: [number, number, number] = [71, 85, 105];

const bool = (v: boolean | null | undefined) => (v === true ? 'Sí' : v === false ? 'No' : '—');
const dash = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v));

// Quita emojis de bandera (pares de "regional indicator") — deja solo el nombre del país/lugar
const cleanText = (v: any) => dash(v).replace(/[\u{1F1E6}-\u{1F1FF}]{2}\s*/gu, '').replace(/\s{2,}/g, ' ').trim() || '—';

// El formulario guarda municipio/estado/país ya unidos en un solo texto
// ("Monterrey, Nuevo León, México") — aquí se separan para mostrarlos en
// filas propias dentro de la sección Domicilio.
function splitMunicipio(s: any): [string, string, string] {
  const partes = (s.municipio ? String(s.municipio) : '').split(',').map((p: string) => p.trim()).filter(Boolean);
  return [partes[0] || '—', partes[1] || '—', partes[2] || '—'];
}

function parseDrogas(s: any) {
  const nombres = s.cualDroga ? (s.cualDroga as string).split(', ') : [];
  const frecs = s.frecuenciaDroga ? (s.frecuenciaDroga as string).split(', ') : [];
  const tiempos = s.tiempoDroga ? (s.tiempoDroga as string).split(', ') : [];
  const ultimas = s.ultimaVezDroga ? (s.ultimaVezDroga as string).split(', ') : [];
  return nombres.filter(Boolean).map((entry, i) => {
    const [droga, estadoRaw] = entry.split('|');
    const estado = estadoRaw === 'SI_CONSUMO' ? 'Consume actualmente' : estadoRaw === 'CONSUMI' ? 'Consumió antes' : '—';
    return { droga: droga?.trim() || '—', estado, frecuencia: dash(frecs[i]), tiempo: dash(tiempos[i]), ultimaVez: dash(ultimas[i]) };
  });
}

// Si `maxWidthPx` viene definido, la imagen se reescala con un canvas antes
// de convertirla a data URL — evita incrustar en el PDF una imagen a su
// resolución original (varios MB) cuando en la página se ve chiquita.
async function loadImageDataUrl(url: string, maxWidthPx?: number): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  if (!maxWidthPx) return dataUrl;
  return await new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidthPx / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const MARGIN = 10;
const PAGE_W = 210;

function titleRow(title: string, colSpan: number) {
  return [{ content: title, colSpan, styles: { fillColor: TITLE_BG, textColor: TITLE_TEXT, fontStyle: 'bold' as const, fontSize: 8, halign: 'left' as const } }];
}

// Sección de campos label:valor — `pares` = [label, valor] de a 4 columnas (2 pares por fila)
function sectionField(doc: jsPDF, startY: number, title: string, pares: [string, any][]): number {
  const body: any[] = [];
  for (let i = 0; i < pares.length; i += 2) {
    const [l1, v1] = pares[i];
    const [l2, v2] = pares[i + 1] || ['', ''];
    body.push([l1, cleanText(v1), l2, l2 ? cleanText(v2) : '']);
  }
  autoTable(doc, {
    startY,
    head: [titleRow(title, 4) as any],
    body,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.3, lineColor: [203, 213, 225], lineWidth: 0.1 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: LABEL_TEXT, cellWidth: 40 },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', textColor: LABEL_TEXT, cellWidth: 40 },
      3: { cellWidth: 55 },
    },
    margin: { left: MARGIN, right: MARGIN },
  });
  return (doc as any).lastAutoTable.finalY + 3;
}

// Sección de lista (tabla con columnas propias): Drogas, Familia, Patológicos, Exposiciones, Empleos
function sectionList(doc: jsPDF, startY: number, title: string, colTitles: string[], rows: any[][]): number {
  autoTable(doc, {
    startY,
    head: [
      titleRow(title, colTitles.length) as any,
      colTitles.map((c) => ({ content: c, styles: { fillColor: SUBHEAD_BG, textColor: TITLE_TEXT, fontStyle: 'bold' as const, fontSize: 6.5 } })) as any,
    ],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.3, lineColor: [203, 213, 225], lineWidth: 0.1 },
    margin: { left: MARGIN, right: MARGIN },
  });
  return (doc as any).lastAutoTable.finalY + 3;
}

// Sección con varias categorías en columnas lado a lado (label:valor cada
// una), p. ej. "Hábitos de consumo" dividido en Alcohol / Tabaquismo / Drogas
function sectionCategorias(doc: jsPDF, startY: number, title: string, categorias: { titulo: string; pares: [string, any][] }[]): number {
  const maxFilas = Math.max(...categorias.map((c) => c.pares.length));
  const body: any[] = [];
  for (let i = 0; i < maxFilas; i++) {
    const fila: any[] = [];
    categorias.forEach((c) => {
      const [label, value] = c.pares[i] || ['', ''];
      fila.push(label, label ? cleanText(value) : '');
    });
    body.push(fila);
  }
  const columnStyles: Record<number, any> = {};
  categorias.forEach((_, i) => { columnStyles[i * 2] = { fontStyle: 'bold', textColor: LABEL_TEXT, cellWidth: 28 }; });

  autoTable(doc, {
    startY,
    head: [
      titleRow(title, categorias.length * 2) as any,
      categorias.map((c) => ({ content: c.titulo, colSpan: 2, styles: { fillColor: SUBHEAD_BG, textColor: TITLE_TEXT, fontStyle: 'bold' as const, fontSize: 7 } })) as any,
    ],
    body,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.3, lineColor: [203, 213, 225], lineWidth: 0.1 },
    columnStyles,
    margin: { left: MARGIN, right: MARGIN },
  });
  return (doc as any).lastAutoTable.finalY + 3;
}

// Dibuja un checkbox real (cuadro + palomita si está marcado) con vectores —
// evita depender de glifos Unicode que las fuentes estándar del PDF no traen
function drawCheckbox(doc: jsPDF, x: number, yBaseline: number, checked: boolean, size = 2.6) {
  const top = yBaseline - size + 0.6;
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.15);
  doc.rect(x, top, size, size);
  if (checked) {
    doc.setDrawColor(51, 117, 200);
    doc.setLineWidth(0.35);
    doc.line(x + size * 0.15, top + size * 0.55, x + size * 0.4, top + size * 0.85);
    doc.line(x + size * 0.4, top + size * 0.85, x + size * 0.9, top + size * 0.15);
  }
}

// Tabla de historial de empleos — la columna "Exposición a" dibuja un
// checkbox + etiqueta por cada exposición seleccionada (una por línea).
// Si un empleo no tiene ninguna exposición seleccionada, la celda queda en "—".
function sectionEmpleos(doc: jsPDF, startY: number, title: string, colTitles: string[], rows: { empresa: string; cargo: string; tiempo: string; exponentes: string[] }[]): number {
  const body = rows.map((r) => [r.empresa, r.cargo, r.tiempo, r.exponentes]);
  autoTable(doc, {
    startY,
    head: [
      titleRow(title, colTitles.length) as any,
      colTitles.map((c) => ({ content: c, styles: { fillColor: SUBHEAD_BG, textColor: TITLE_TEXT, fontStyle: 'bold' as const, fontSize: 6.5 } })) as any,
    ],
    body: body as any,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.3, lineColor: [203, 213, 225], lineWidth: 0.1 },
    margin: { left: MARGIN, right: MARGIN },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const items: string[] = Array.isArray(data.cell.raw) ? data.cell.raw : [];
        data.cell.text = items.length ? items.map(() => ' ') : ['—'];
      }
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const items: string[] = Array.isArray(data.cell.raw) ? data.cell.raw : [];
        items.forEach((label, idx) => {
          const ly = data.cell.y + 3.3 + idx * 3.3;
          drawCheckbox(doc, data.cell.x + 1, ly, true);
          doc.setFont('helvetica'); doc.setFontSize(7); doc.setTextColor(15, 23, 42);
          doc.text(label, data.cell.x + 4.3, ly);
        });
      }
    },
  });
  return (doc as any).lastAutoTable.finalY + 3;
}

// Antecedentes laborales + exposiciones en un solo bloque compacto. Siempre
// se muestran las 6 exposiciones posibles, marcadas (✓, presente en el
// general o en algún empleo del historial) o sin marcar (no presente).
function sectionLaboral(doc: jsPDF, startY: number, s: any, empleos: any[]): number {
  const exp = s.exposiciones || {};
  const allExposures = Object.entries(EXPOSICION_LABELS).map(([k, l]) => ({
    label: l,
    checked: !!exp[k] || empleos.some((e: any) => (e.exponentes || []).includes(l)),
  }));

  const body: any[] = [
    ['Edad de inicio laboral', dash(s.edadInicioLaboral), 'Trabajó en minas', bool(s.trabajoMinas)],
  ];
  if (s.trabajoMinas) body.push(['Tiempo en minas', dash(s.tiempoMinas), '', '']);
  body.push([{ content: '', colSpan: 4, exposureItems: allExposures } as any]);

  autoTable(doc, {
    startY,
    head: [titleRow('Antecedentes laborales', 4) as any],
    body,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.3, lineColor: [203, 213, 225], lineWidth: 0.1 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: LABEL_TEXT, cellWidth: 40 },
      1: { cellWidth: 55 },
      2: { fontStyle: 'bold', textColor: LABEL_TEXT, cellWidth: 40 },
      3: { cellWidth: 55 },
    },
    margin: { left: MARGIN, right: MARGIN },
    didParseCell: (data) => {
      const raw: any = data.cell.raw;
      if (raw && typeof raw === 'object' && raw.exposureItems) data.cell.text = [' '];
    },
    didDrawCell: (data) => {
      const raw: any = data.cell.raw;
      if (raw && typeof raw === 'object' && raw.exposureItems) {
        let cx = data.cell.x + 2;
        const cy = data.cell.y + data.cell.height / 2 + 1;
        doc.setFont('helvetica'); doc.setFontSize(7);
        (raw.exposureItems as { label: string; checked: boolean }[]).forEach(({ label, checked }) => {
          drawCheckbox(doc, cx, cy, checked);
          doc.setTextColor(15, 23, 42);
          doc.text(label, cx + 3.3, cy);
          cx += 3.3 + doc.getTextWidth(label) + 6;
        });
      }
    },
  });
  return (doc as any).lastAutoTable.finalY + 3;
}

// Construye el PDF y regresa el blob + nombre sugerido, sin descargarlo —
// lo usa downloadSurveyPdf (descarga al equipo) y también quien lo quiera
// subir al expediente documental del paciente.
export async function buildSurveyPdfBlob(survey: any, patient: any): Promise<{ blob: Blob; filename: string }> {
  const s = survey || {};
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  let y = 10;
  const logoW = 46, logoH = 12; // proporción real del logo completo (3038x793)
  try {
    const logoData = await loadImageDataUrl(logoCompleto, 600);
    doc.addImage(logoData, 'PNG', MARGIN, y, logoW, logoH);
  } catch { /* si falla la carga del logo, se omite */ }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Historia Clínica — Cuestionario del paciente', MARGIN, y + logoH + 5);

  doc.setFontSize(8);
  const fecha = s.createdAt ? new Date(s.createdAt).toLocaleDateString('es-MX') : '—';
  doc.text(`Fecha del cuestionario: ${fecha}`, PAGE_W - MARGIN, y + 4, { align: 'right' });

  y += logoH + 9;
  doc.setDrawColor(51, 117, 200);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 4;

  y = sectionField(doc, y, 'Trabajo — Información general', [
    ['Empresa', s.empresa], ['Puesto de trabajo', s.puestoDeTrabajo],
    ['Tipo de examen', s.tipoExamen], ['Otro tipo (especifique)', s.otroTipo],
    ['Actividades del puesto', s.actividades], ['', ''],
  ]);

  y = sectionField(doc, y, 'Datos personales', [
    ['Nombre', s.nombre || patient?.fullName], ['Edad', s.edad],
    ['Tipo de sangre', s.tipoSangre], ['Fecha de nacimiento', s.fechaNacimiento],
    ['Lugar de nacimiento', s.lugarNacimiento], ['Estado civil', s.estadoCivil],
    ['Escolaridad', s.escolaridad], ['NSS', s.nss],
    ['Celular', s.celular], ['Correo', s.correo],
  ]);

  const [municipioTxt, estadoTxt, paisTxt] = splitMunicipio(s);
  y = sectionField(doc, y, 'Domicilio', [
    ['Calle', s.calle], ['Número', s.numero],
    ['Colonia', s.colonia], ['Código postal', s.cp],
    ['Municipio', municipioTxt], ['Estado', estadoTxt],
    ['País', paisTxt], ['', ''],
  ]);

  y = sectionField(doc, y, 'Hábitos', [
    ['Practica deporte', bool(s.practicaDeporte)], ['¿Cuál?', s.cualDeporte],
    ['Frecuencia', s.frecuenciaDeporte], ['Horas', s.horasDeporte],
    ['Hábitos alimenticios', s.habitosAlimenticios], ['Comidas al día', s.comidasDia],
    ['Frutas/verduras', s.consumeFrutasVerduras], ['Agua al día', s.aguaDia],
    ['Calidad de sueño', s.calidadSueno], ['Horas de sueño', s.horasSueno],
    ['Especifique (sueño)', s.especifiqueSueno], ['', ''],
  ]);

  y = sectionCategorias(doc, y, 'Hábitos de consumo', [
    {
      titulo: 'Alcohol',
      pares: [
        ['Consume alcohol', bool(s.consumeAlcohol)],
        ['Tipo de bebida', s.tipoBebida],
        ['Cantidad', s.cantidadBebidas],
        ['Frecuencia', s.frecuenciaAlcohol],
      ],
    },
    {
      titulo: 'Tabaquismo',
      pares: [
        ['Tabaquismo', s.fuma === 'SI' ? 'Sí' : s.fuma === 'EXFUMADOR' ? 'Exfumador/a' : s.fuma === 'NO' ? 'No' : '—'],
        ['Edad de inicio', s.edadInicioFuma],
        ['Años fumando', s.anosFumando],
        ['Cigarros al día', s.cigarrosDia],
      ],
    },
    {
      titulo: 'Drogas',
      pares: [
        ['Consume/consumió', s.consumeDrogas === 'SI' ? 'Sí' : s.consumeDrogas === 'NO_NUNCA' ? 'No, nunca' : '—'],
      ],
    },
  ]);

  const drogas = parseDrogas(s);
  if (drogas.length > 0) {
    y = sectionList(doc, y, 'Drogas', ['Droga', 'Estado', 'Frecuencia', 'Tiempo / Última vez'],
      drogas.map((d) => [d.droga, d.estado, d.frecuencia, `${d.tiempo} / ${d.ultimaVez}`]));
  }

  y = sectionField(doc, y, 'Vacunación y otros', [
    ['Esquema de vacunación completo', bool(s.esquemaVacunacion)], ['Dosis anticovid', s.dosisAnticovid],
    ['Marca de vacuna', s.marcaVacuna], ['Tiene tatuajes', bool(s.tieneTatuajes)],
    ['Último tatuaje', s.ultimoTatuaje], ['Usa audífonos con frecuencia', bool(s.usaAudifonos)],
  ]);

  const afRaw: any[] = Array.isArray(s.antecedentesFamiliares) ? s.antecedentesFamiliares : [];
  const afRows: any[][] = [];
  ENFERMEDADES_FAMILIARES.forEach((enfermedad) => {
    const a = afRaw.find((x) => x.enfermedad === enfermedad) || { si: null, familiares: [] };
    if (enfermedad === 'Otras') {
      const entradas = (a.entradas || []).filter((e: any) => e.especifique);
      if (entradas.length === 0) { afRows.push(['Otras', bool(a.si), '—']); return; }
      entradas.forEach((e: any) => afRows.push([`Otras: ${e.especifique}`, 'Sí', (e.familiares || []).join(', ') || '—']));
      return;
    }
    afRows.push([enfermedad, bool(a.si), (a.familiares || []).join(', ') || '—']);
  });
  y = sectionList(doc, y, 'Antecedentes heredo-familiares', ['Enfermedad', '¿Algún familiar?', 'Familiar(es)'], afRows);

  const apRaw: any[] = Array.isArray(s.antecedentesPatologicos) ? s.antecedentesPatologicos : [];
  const apRows = ANTECEDENTES_PATOLOGICOS.map((condicion) => {
    const a = apRaw.find((x) => x.condicion === condicion) || { si: null, entradas: [] };
    const entradas = (a.entradas || []).filter((e: any) => e.especifique || e.fecha);
    const detalle = entradas.length ? entradas.map((e: any) => `${e.especifique || '—'}${e.fecha ? ` (${e.fecha})` : ''}`).join('; ') : '—';
    return [condicion, bool(a.si), detalle];
  });
  y = sectionList(doc, y, 'Antecedentes personales patológicos', ['Condición', '¿Sí/No?', 'Especifique / Hace cuánto'], apRows);

  const empleos: any[] = (Array.isArray(s.historialEmpleos) ? s.historialEmpleos : []).filter((e: any) =>
    e.empresa || e.cargo || e.tiempo || (Array.isArray(e.exponentes) ? e.exponentes.length > 0 : e.exponentes));

  y = sectionLaboral(doc, y, s, empleos);

  y = sectionEmpleos(doc, y, 'Historial de empleos', ['Empresa', 'Cargo', 'Tiempo', 'Exposición a'],
    empleos.length
      ? empleos.map((e) => ({ empresa: dash(e.empresa), cargo: dash(e.cargo), tiempo: dash(e.tiempo), exponentes: Array.isArray(e.exponentes) ? e.exponentes : [] }))
      : [{ empresa: 'Sin historial de empleos registrado', cargo: '', tiempo: '', exponentes: [] }]);

  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Documento generado a partir del cuestionario médico capturado por el paciente — MediWork', PAGE_W / 2, 290, { align: 'center' });

  const safeName = (s.nombre || patient?.fullName || 'paciente').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_');
  const filename = `Encuesta_${safeName}.pdf`;
  const blob = doc.output('blob');
  return { blob, filename };
}

// Descarga el PDF directo al equipo (comportamiento original del botón)
export async function downloadSurveyPdf(survey: any, patient: any) {
  const { blob, filename } = await buildSurveyPdfBlob(survey, patient);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
