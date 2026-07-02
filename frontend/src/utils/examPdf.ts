import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoCompleto from '../assets/logo_completo.png';

// ── Generación del PDF de "Resultados del examen" (MedicalExam) ──────────
// Mismo estilo visual que surveyPdf.ts (tablas con encabezado azul claro).

const TITLE_BG: [number, number, number] = [191, 219, 254];
const TITLE_TEXT: [number, number, number] = [30, 64, 175];
const LABEL_TEXT: [number, number, number] = [71, 85, 105];

const dash = (v: any) => (v === null || v === undefined || v === '' ? '—' : String(v));
const bool = (v: any) => (v === true ? 'Sí' : v === false ? 'No' : '—');

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

function sectionField(doc: jsPDF, startY: number, title: string, pares: [string, any][]): number {
  const body: any[] = [];
  for (let i = 0; i < pares.length; i += 2) {
    const [l1, v1] = pares[i];
    const [l2, v2] = pares[i + 1] || ['', ''];
    body.push([l1, dash(v1), l2, l2 ? dash(v2) : '']);
  }
  autoTable(doc, {
    startY,
    head: [titleRow(title, 4) as any],
    body,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.3, lineColor: [203, 213, 225], lineWidth: 0.1 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: LABEL_TEXT, cellWidth: 42 },
      1: { cellWidth: 53 },
      2: { fontStyle: 'bold', textColor: LABEL_TEXT, cellWidth: 42 },
      3: { cellWidth: 53 },
    },
    margin: { left: MARGIN, right: MARGIN },
  });
  return (doc as any).lastAutoTable.finalY + 3;
}

export async function buildExamPdfBlob(exam: any, patient: any): Promise<{ blob: Blob; filename: string }> {
  const e = exam || {};
  const av = e.agudezaVisual || {};
  const ol = e.opcionesLentes || {};
  const sv = e.signosVitales || {};
  const ag = e.antGineco || {};
  const aa = e.antAndro || {};
  const rc = e.riesgoCardio || {};
  const ex = e.examenes || {};
  const ru = e.ruffier || {};
  const rx = e.rayosX || {};

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  let y = 10;
  const logoW = 46, logoH = 12;
  try {
    const logoData = await loadImageDataUrl(logoCompleto, 600);
    doc.addImage(logoData, 'PNG', MARGIN, y, logoW, logoH);
  } catch { /* si falla la carga del logo, se omite */ }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Resultados del examen médico', MARGIN, y + logoH + 5);

  doc.setFontSize(8);
  const fecha = e.date ? new Date(e.date).toLocaleDateString('es-MX') : '—';
  doc.text(`Fecha del examen: ${fecha}`, PAGE_W - MARGIN, y + 4, { align: 'right' });

  y += logoH + 9;
  doc.setDrawColor(51, 117, 200);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 4;

  y = sectionField(doc, y, 'Paciente', [
    ['Nombre', patient?.fullName], ['Empresa', patient?.company],
  ]);

  y = sectionField(doc, y, 'Signos vitales', [
    ['Peso (kg)', sv.peso], ['Talla (m)', sv.talla],
    ['IMC', sv.imc], ['Clasificación', sv.imcClasificacion],
    ['T/A', sv.ta], ['F.C. (lpm)', sv.fc],
    ['F.R. (rpm)', sv.fr], ['Temperatura (°C)', sv.temperatura],
    ['Sat. O2 (%)', sv.sao2], ['Cintura (cm)', sv.cintura],
    ['Cadera (cm)', sv.cadera], ['Tórax (cm)', sv.torax],
  ]);

  y = sectionField(doc, y, 'Agudeza visual — Ojo derecho', [
    ['Sin lentes', av.od?.sinLentes], ['Con lentes', av.od?.conLentes],
    ['Recuperación', av.od?.recuperacion], ['', ''],
  ]);
  y = sectionField(doc, y, 'Agudeza visual — Ojo izquierdo', [
    ['Sin lentes', av.oi?.sinLentes], ['Con lentes', av.oi?.conLentes],
    ['Recuperación', av.oi?.recuperacion], ['', ''],
  ]);
  y = sectionField(doc, y, 'Agudeza visual — Ambos ojos / cercana', [
    ['Ambos — sin lentes', av.ambos?.sinLentes], ['Ambos — con lentes', av.ambos?.conLentes],
    ['Ambos — recuperación', av.ambos?.recuperacion], ['Visión cercana', av.cercana?.sinLentes],
  ]);

  y = sectionField(doc, y, 'Opciones y antecedentes de lentes', [
    ['Lentes de seguridad', bool(ol.seguridad)], ['Uso diario', bool(ol.usoDiario)],
    ['Ambos', bool(ol.ambos)], ['Requiere actualización', bool(ol.actualizacion)],
    ['Fotosensible', bool(ol.fotosensible)], ['Astigmatismo', bool(ol.astigmatismo)],
    ['Miopía', bool(ol.miopia)], ['Hipermetropía', bool(ol.hipermetropia)],
    ['Presbicia', bool(ol.presbicia)], ['Hace uso de lentes', ol.haceUsoLentes],
    ['Cirugías', ol.cirugias], ['Última actualización', ol.ultimaActualizacion],
    ['Pterigión OD', ol.pterigionOd], ['Pterigión OI', ol.pterigionOi],
    ['Lubricante', ol.lubricante], ['Campimetría', ol.campimetria],
    ['Campimetría (ast.)', ol.campimetriaAst], ['Rejilla de Amsler', ol.rejilla],
    ['Ishihara', ol.ishihara], ['Errores de refracción', ol.errores],
    ['Otros', ol.otros], ['', ''],
  ]);

  y = sectionField(doc, y, 'Antecedentes gineco-obstétricos', [
    ['Menarca', ag.menarca], ['FUM', ag.fum],
    ['Ritmo', ag.ritmo], ['IVS', ag.ivs],
    ['G', ag.g], ['P', ag.p],
    ['C', ag.c], ['A', ag.a],
    ['FUP', ag.fup], ['MPF', ag.mpf],
    ['ITS', ag.its], ['Otros', ag.otros],
  ]);
  y = sectionField(doc, y, 'Antecedentes andrológicos', [
    ['Hijos', aa.hijos], ['Hijos mujeres', aa.hijosMujeres],
    ['Hijos hombres', aa.hijosHombres], ['IVS', aa.ivs],
    ['MPF', aa.mpf], ['ITS', aa.its],
    ['Otros', aa.otros], ['', ''],
  ]);

  y = sectionField(doc, y, 'Riesgo cardiovascular', [
    ['HDL', rc.hdl], ['Colesterol', rc.colesterol],
    ['Edad cardiovascular', rc.edadCv], ['% de riesgo', rc.porcentajeRiesgo],
    ['Riesgo', rc.riesgo], ['', ''],
  ]);

  y = sectionField(doc, y, 'Exámenes complementarios', [
    ['Audiometría', ex.audiometria], ['Espirometría', ex.espirometria],
    ['Otoscopía', ex.otoscopia], ['Dientes', ex.dientes],
    ['Tiempo', ex.tiempo], ['Otros', ex.otros],
  ]);

  y = sectionField(doc, y, 'Prueba de Ruffier-Dickson', [
    ['Pulso en reposo', ru.reposoP], ['Ritmo en reposo', ru.reposoR],
    ['Pulso en esfuerzo', ru.esfuerzoP], ['Ritmo en esfuerzo', ru.esfuerzoR],
    ['Pulso al minuto', ru.minutoP], ['Ritmo al minuto', ru.minutoR],
    ['Calificación', ru.calificacion], ['', ''],
  ]);

  y = sectionField(doc, y, 'Rayos X', [
    ['I.C.', rx.ic], ['Anterior', rx.anterior],
    ['Sagital', rx.sagital], ['Ferguson', rx.ferguson],
    ['Lordótico', rx.lordotico], ['Coob', rx.coob],
    ['Dismetría', rx.dismetria], ['L3', rx.l3],
    ['Hallazgos', rx.hallazgos], ['', ''],
  ]);

  y = sectionField(doc, y, 'Radiografías y notas finales', [
    ['Recibe radiografías impresas', e.recibeRadiografias], ['Fecha de radiografías', e.fechaRadiografias],
    ['Indicaciones conocidas', bool(e.indicacionesConocidas)], ['', ''],
  ]);
  if (e.notas) {
    autoTable(doc, {
      startY: y,
      head: [titleRow('Notas', 1) as any],
      body: [[e.notas]],
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.3, lineColor: [203, 213, 225], lineWidth: 0.1 },
      margin: { left: MARGIN, right: MARGIN },
    });
  }

  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Documento generado a partir de los resultados del examen médico — MediWork', PAGE_W / 2, 290, { align: 'center' });

  const safeName = (patient?.fullName || 'paciente').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_');
  const filename = `Resultados_${safeName}.pdf`;
  const blob = doc.output('blob');
  return { blob, filename };
}

export async function downloadExamPdf(exam: any, patient: any) {
  const { blob, filename } = await buildExamPdfBlob(exam, patient);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
