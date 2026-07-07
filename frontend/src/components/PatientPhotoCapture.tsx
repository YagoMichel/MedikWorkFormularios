// =============================================================
// ARCHIVO: src/components/PatientPhotoCapture.tsx
// DESCRIPCION: Captura/subida de foto del paciente al inicio del formulario.
//   Flujo: tomar o subir → validar (resolución, borrosidad, formato, tamaño)
//          → quitar fondo LOCALMENTE (@imgly/background-removal, no sale del
//          dispositivo) → confirmar → subir a /api/surveys/photo → guardar ruta.
//   Reutiliza estilos existentes (--bg-card, material-symbols-rounded, .btn).
// =============================================================

import { useRef, useState, useEffect } from 'react';
import { api } from '../services/api';
import toast from 'react-hot-toast';

// ── Parámetros de validación ─────────────────────────────────────────
const MIN_DIM = 320;                    // px mínimos de ancho y alto
const MAX_BYTES = 8 * 1024 * 1024;      // 8 MB
const BLUR_THRESHOLD = 55;              // varianza de Laplaciano; menor = borroso
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

type Phase = 'idle' | 'camera' | 'review' | 'processing' | 'confirm';

// Carga una imagen desde un blob en un HTMLImageElement
function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

// Varianza del Laplaciano en escala de grises → detector de borrosidad barato
function laplacianVariance(img: HTMLImageElement): number {
  const w = 256;
  const h = Math.round((img.height / img.width) * w) || 256;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const gray = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  let sum = 0, sumSq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4 * gray[i];
      sum += lap; sumSq += lap * lap; n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

// Valida un blob de imagen. Devuelve errores (bloquean) y avisos (soft).
async function validate(blob: Blob): Promise<{ errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!blob || blob.size === 0) { errors.push('La imagen está vacía'); return { errors, warnings }; }
  if (!ALLOWED.includes(blob.type)) errors.push('Formato no permitido (usa JPG, PNG o WEBP)');
  if (blob.size > MAX_BYTES) errors.push('La imagen pesa más de 8 MB');
  try {
    const img = await loadImage(blob);
    if (img.naturalWidth < MIN_DIM || img.naturalHeight < MIN_DIM) {
      errors.push(`Resolución muy baja (mínimo ${MIN_DIM}×${MIN_DIM} px)`);
    }
    if (laplacianVariance(img) < BLUR_THRESHOLD) {
      warnings.push('La foto se ve borrosa. Te recomendamos repetirla.');
    }
    URL.revokeObjectURL(img.src);
  } catch {
    errors.push('No se pudo leer la imagen');
  }
  return { errors, warnings };
}

// Compone la imagen (con fondo transparente) sobre blanco → PNG limpio de ID
function flattenOnWhite(blob: Blob): Promise<Blob> {
  return loadImage(blob).then(img => new Promise<Blob>((resolve, reject) => {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(img.src);
    c.toBlob(b => b ? resolve(b) : reject(new Error('toBlob falló')), 'image/png');
  }));
}

export default function PatientPhotoCapture({ value, onChange, allowUpload = true }: {
  value: string;
  onChange: (url: string) => void;
  allowUpload?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [rawBlob, setRawBlob] = useState<Blob | null>(null);
  const [rawUrl, setRawUrl] = useState<string>('');
  const [finalUrl, setFinalUrl] = useState<string>('');
  const [finalBlob, setFinalBlob] = useState<Blob | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Detiene la cámara y libera el hardware
  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };
  useEffect(() => stopCamera, []); // cleanup al desmontar

  const reset = () => {
    stopCamera();
    if (rawUrl) URL.revokeObjectURL(rawUrl);
    if (finalUrl) URL.revokeObjectURL(finalUrl);
    setRawBlob(null); setRawUrl(''); setFinalUrl(''); setFinalBlob(null);
    setWarnings([]); setPhase('idle');
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Cámara no disponible. Sube una foto en su lugar.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      setPhase('camera');
      // el <video> se monta al cambiar de fase; conectar en el siguiente tick
      setTimeout(() => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); } }, 0);
    } catch {
      toast.error('No se pudo acceder a la cámara. Revisa permisos (requiere HTTPS).');
    }
  };

  const capture = () => {
    const v = videoRef.current;
    if (!v) return;
    const size = Math.min(v.videoWidth, v.videoHeight);
    const c = document.createElement('canvas');
    c.width = size; c.height = size; // recorte cuadrado centrado
    const ctx = c.getContext('2d')!;
    ctx.drawImage(v, (v.videoWidth - size) / 2, (v.videoHeight - size) / 2, size, size, 0, 0, size, size);
    c.toBlob(b => { if (b) intake(b); }, 'image/jpeg', 0.92);
    stopCamera();
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) intake(f);
    e.target.value = '';
  };

  // Punto común: valida y pasa a revisión
  const intake = async (blob: Blob) => {
    const { errors, warnings } = await validate(blob);
    if (errors.length) { toast.error(errors[0]); setPhase('idle'); return; }
    if (rawUrl) URL.revokeObjectURL(rawUrl);
    setRawBlob(blob);
    setRawUrl(URL.createObjectURL(blob));
    setWarnings(warnings);
    setPhase('review');
  };

  // Quita el fondo localmente (el modelo se descarga; la imagen NO sale del equipo)
  const removeBg = async () => {
    if (!rawBlob) return;
    setPhase('processing');
    try {
      const { removeBackground } = await import('@imgly/background-removal');
      const cut = await removeBackground(rawBlob);       // PNG con transparencia
      const flat = await flattenOnWhite(cut);            // sobre fondo blanco
      if (finalUrl) URL.revokeObjectURL(finalUrl);
      setFinalBlob(flat);
      setFinalUrl(URL.createObjectURL(flat));
      setPhase('confirm');
    } catch (e) {
      console.error('[bg-removal]', e);
      toast.error('No se pudo quitar el fondo. Intenta de nuevo.');
      setPhase('review');
    }
  };

  // Sube la imagen final y entrega la ruta al formulario
  const confirm = async () => {
    if (!finalBlob) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', finalBlob, 'paciente.png');
      const { data } = await api.post('/surveys/photo', fd);
      onChange(data.url);
      reset();
      toast.success('Foto guardada');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'No se pudo subir la foto');
    } finally {
      setUploading(false);
    }
  };

  // ── Foto ya confirmada ─────────────────────────────────────────────
  if (value && phase === 'idle') {
    return (
      <section className="card space-y-4">
        <Header />
        <div className="flex flex-col items-center gap-3">
          <img src={value} alt="Foto del paciente"
            className="rounded-2xl object-cover border-2"
            style={{ width: 240, height: 240, maxWidth: '80%', borderColor: '#3375c8', background: '#fff' }} />
          <p className="font-semibold text-sm flex items-center gap-1.5" style={{ color: '#16a34a' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>check_circle</span>
            Foto lista
          </p>
          <button type="button" onClick={() => { onChange(''); setPhase('idle'); }}
            className="btn btn-secondary flex items-center gap-1.5">
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>refresh</span>
            Cambiar foto
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card space-y-4">
      <Header />

      {/* Paso: elegir origen */}
      {phase === 'idle' && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={startCamera}
            className="flex-1 flex flex-col items-center gap-2 p-6 rounded-2xl transition hover:shadow-lg cursor-pointer"
            style={{ border: '2px solid var(--border-subtle)' }}>
            <span className="material-symbols-rounded text-3xl" style={{ color: '#3375c8' }}>photo_camera</span>
            <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Tomar foto</span>
          </button>
          {allowUpload && (
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex-1 flex flex-col items-center gap-2 p-6 rounded-2xl transition hover:shadow-lg cursor-pointer"
              style={{ border: '2px solid var(--border-subtle)' }}>
              <span className="material-symbols-rounded text-3xl" style={{ color: '#51abcd' }}>upload</span>
              <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Subir foto</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="user"
            onChange={onFile} className="hidden" />
        </div>
      )}

      {/* Paso: cámara en vivo */}
      {phase === 'camera' && (
        <div className="space-y-3">
          <div className="relative mx-auto rounded-2xl overflow-hidden bg-black" style={{ maxWidth: 360, aspectRatio: '1 / 1' }}>
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
          </div>
          <div className="flex gap-3 justify-center">
            <button type="button" onClick={reset} className="btn btn-secondary flex items-center gap-1.5">
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>close</span> Cancelar
            </button>
            <button type="button" onClick={capture} className="btn btn-primary flex items-center gap-1.5">
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>photo_camera</span> Capturar
            </button>
          </div>
        </div>
      )}

      {/* Paso: revisar foto cruda */}
      {phase === 'review' && (
        <div className="space-y-3">
          <img src={rawUrl} alt="Vista previa" className="mx-auto rounded-2xl object-cover"
            style={{ maxWidth: 360, width: '100%', aspectRatio: '1 / 1' }} />
          {warnings.map((w, i) => (
            <p key={i} className="text-sm flex items-center gap-1.5 justify-center" style={{ color: '#d97706' }}>
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>warning</span> {w}
            </p>
          ))}
          <div className="flex gap-3 justify-center">
            <button type="button" onClick={reset} className="btn btn-secondary flex items-center gap-1.5">
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>refresh</span> Repetir
            </button>
            <button type="button" onClick={removeBg} className="btn btn-primary flex items-center gap-1.5">
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>auto_fix_high</span> Quitar fondo
            </button>
          </div>
        </div>
      )}

      {/* Paso: procesando */}
      {phase === 'processing' && (
        <div className="flex flex-col items-center gap-3 py-8">
          <span className="material-symbols-rounded animate-spin text-4xl" style={{ color: '#3375c8' }}>progress_activity</span>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Quitando el fondo… (se procesa en este dispositivo)</p>
        </div>
      )}

      {/* Paso: confirmar imagen final */}
      {phase === 'confirm' && (
        <div className="space-y-3">
          <img src={finalUrl} alt="Foto final" className="mx-auto rounded-2xl object-cover border"
            style={{ maxWidth: 360, width: '100%', aspectRatio: '1 / 1', background: '#fff', borderColor: 'var(--border-subtle)' }} />
          <div className="flex gap-3 justify-center">
            <button type="button" onClick={reset} disabled={uploading} className="btn btn-secondary flex items-center gap-1.5">
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>refresh</span> Repetir
            </button>
            <button type="button" onClick={confirm} disabled={uploading} className="btn btn-primary flex items-center gap-1.5">
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{uploading ? 'progress_activity' : 'check'}</span>
              {uploading ? 'Guardando…' : 'Confirmar foto'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-3 pb-4 mb-1 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#3375c820' }}>
        <span className="material-symbols-rounded" style={{ color: '#3375c8', fontSize: 20 }}>account_circle</span>
      </div>
      <div>
        <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Foto del paciente</h3>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Toma o sube una foto para iniciar</p>
      </div>
    </div>
  );
}
