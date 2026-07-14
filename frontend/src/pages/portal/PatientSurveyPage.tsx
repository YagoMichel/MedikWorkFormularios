// Portal del PACIENTE: su encuesta con el MISMO formulario multi-paso de la
// tablet, a todo el ancho del main.
//   - Si aún NO tiene encuesta → formulario para llenarla (crea).
//   - Si YA la respondió → se ve en modo lectura; hay que dar "Editar" para
//     modificarla (actualiza la misma encuesta, no crea otra).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import { useAuth } from '../../stores/auth';
import SurveyFlow from '../tablet/SurveyFlow';

export default function PatientSurveyPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const [name, setName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');

  // Encuesta actual del paciente (o null si aún no ha respondido)
  const { data: survey, isLoading } = useQuery({
    queryKey: ['portal-my-survey'],
    queryFn: async () => (await api.get('/portal/patient/survey')).data,
  });

  // Precarga los datos capturados al registrar la cuenta del paciente.
  useEffect(() => {
    api.get('/portal/patient/me').then((r) => {
      if (r.data?.fullName) setName(r.data.fullName);
      if (r.data?.email) setEmail(r.data.email);
    }).catch(() => {});
  }, []);

  const submit = async (payload: any) => {
    if (survey?.id) {
      await api.put(`/portal/patient/survey/${survey.id}`, payload);
      toast.success('Datos de la encuesta actualizados en el sistema');
    } else {
      await api.post('/portal/patient/survey', payload);
      toast.success('Encuesta guardada en el sistema');
    }
    qc.invalidateQueries({ queryKey: ['portal-my-survey'] });
    qc.invalidateQueries({ queryKey: ['portal-results'] });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-118px)]">
      <button onClick={() => nav('/')} className="shrink-0 text-sm font-bold text-slate-500 mb-3 flex items-center gap-1 w-max">
        <span className="material-symbols-rounded" style={{ fontSize: 18 }}>arrow_back</span> Volver a mi expediente
      </button>
      <div className="flex-1 min-h-0 flex flex-col rounded-3xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">Cargando…</div>
        ) : (
          <SurveyFlow
            portalMode
            onSubmit={submit}
            initialName={name}
            initialEmail={email}
            initialData={survey || undefined}
            startReadOnly={!!survey}
            onClose={() => nav('/')}
          />
        )}
      </div>
    </div>
  );
}
