// =============================================================
// ARCHIVO: src/pages/public/EncuestaPublica.tsx
// DESCRIPCION: Encuesta médica PÚBLICA (sin login) en /encuesta. Reutiliza el
//   MISMO formulario de la tablet (SurveyFlow) para que cualquiera la llene
//   desde su celular cuando no hay tablet — con todos los campos, el
//   autocompletado de código postal y las mismas validaciones.
//
//   Arranca directo en el formulario (portalMode): se omiten los pasos
//   "paciente nuevo / ya registrado" y la búsqueda de pacientes existentes,
//   que requieren sesión y no deben exponerse públicamente. Envía al endpoint
//   público POST /api/public/survey, que crea Paciente + Encuesta sin login.
//
//   ANTI-BOTS (sin servicio externo): al abrir se pide un token de tiempo
//   firmado por el servidor (/survey/challenge) que se devuelve al enviar; el
//   backend rechaza envíos sin token o instantáneos. Además hay un campo
//   honeypot oculto que un humano nunca llena. Se suma al rate-limit por IP y
//   al captcha Turnstile si algún día se activan sus claves.
// =============================================================
import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useTheme } from '../../stores/theme.tsx';
import SurveyFlow from '../tablet/SurveyFlow';
import logo from '../../assets/logo.png';

export default function EncuestaPublica() {
  const { dark, toggle } = useTheme();
  // Al terminar (o cancelar en el primer paso) se remonta SurveyFlow con una
  // nueva "instancia" para dejar el formulario limpio para la siguiente persona.
  const [instancia, setInstancia] = useState(0);
  const [formToken, setFormToken] = useState('');
  const [hp, setHp] = useState(''); // honeypot: debe quedar SIEMPRE vacío

  // Pide un token de tiempo fresco al abrir la encuesta y tras cada envío
  // (cuando cambia `instancia`).
  useEffect(() => {
    api.get('/public/survey/challenge')
      .then((r) => setFormToken(r.data.token))
      .catch(() => setFormToken(''));
  }, [instancia]);

  const submit = async (payload: any) => {
    await api.post('/public/survey', { ...payload, formToken, hp_extra: hp });
  };

  return (
    <div className="min-h-screen flex flex-col layout-root">
      <header className="layout-header h-[64px] flex items-center px-6 border-b">
        <img src={logo} alt="MediWork" className="h-9 object-contain select-none" />
        <div className="ml-auto flex items-center gap-3">
          <button onClick={toggle} className="layout-icon-btn w-9 h-9 rounded-xl flex items-center justify-center transition"
            title={dark ? 'Modo claro' : 'Modo oscuro'}>
            <span className="material-symbols-rounded text-[20px]">{dark ? 'light_mode' : 'dark_mode'}</span>
          </button>
        </div>
      </header>

      {/* Honeypot: invisible para humanos (fuera de pantalla, sin tab, sin
          autocompletado). Un bot que rellena todos los campos lo delatará. */}
      <input
        type="text" name="hp_extra" tabIndex={-1} autoComplete="off" aria-hidden="true"
        value={hp} onChange={(e) => setHp(e.target.value)}
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
      />

      <main className="flex-1 flex flex-col">
        <SurveyFlow
          key={instancia}
          portalMode
          onSubmit={submit}
          onClose={() => setInstancia((n) => n + 1)}
        />
      </main>
    </div>
  );
}
