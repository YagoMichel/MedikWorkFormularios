// =============================================================
// ARCHIVO: src/pages/tablet/Home.tsx
// SECCION: TABLET (tuyo)
// DESCRIPCION: Pantalla principal del kiosk/tablet.
//              El paciente llega, ve esta pantalla y presiona
//              "Generar nueva encuesta" para llenar su historial
//              medico antes del examen.
// =============================================================
import { useState } from 'react';
import SurveyFlow from './SurveyFlow';

export default function TabletHome() {
  const [open, setOpen] = useState(false);

  if (open) return <SurveyFlow onClose={() => setOpen(false)} />;

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'linear-gradient(135deg,#3375c8,#51abcd)' }}>
          <span className="material-symbols-rounded text-white text-4xl">assignment</span>
        </div>
        <h1 className="text-2xl font-extrabold mt-2">Bienvenido a MediWork</h1>
        <p className="mt-2 text-sm max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>
          Por favor completa tu encuesta médica antes de iniciar tu examen.
        </p>
      </div>
      <button
        onClick={() => setOpen(true)}
        className="btn btn-primary text-base px-8 py-3 flex items-center gap-2"
        style={{ background: '#3375c8', borderRadius: '14px' }}
      >
        <span className="material-symbols-rounded">add_circle</span>
        Generar nueva encuesta
      </button>
    </div>
  );
}
