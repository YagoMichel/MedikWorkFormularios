import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Link } from 'react-router-dom';

const TYPE_LABELS: Record<string, string> = {
  LEJOS: 'Monofocal · visión lejana',
  CERCA: 'Monofocal · visión próxima',
  BIFOCAL: 'Bifocal',
  PROGRESIVO: 'Multifocal progresivo',
};

const TYPE_BADGE: Record<string, string> = {
  LEJOS: 'badge-blue',
  CERCA: 'badge-green',
  BIFOCAL: 'badge-slate',
  PROGRESIVO: 'badge-slate',
};

export default function Prescriptions() {
  const { data: list = [] } = useQuery({ queryKey: ['prescriptions'], queryFn: async () => (await api.get('/prescriptions')).data });
  return (
    <div className="space-y-4">
<div className="card">
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-xs">
            <tr><th className="text-left py-2">Paciente</th><th className="text-left">Tipo</th><th className="text-left">Diagnóstico</th><th className="text-left">Fecha</th><th className="text-left">Estado</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((rx: any) => (
              <tr key={rx.id} className="border-t border-slate-100">
                <td className="py-2 font-medium">{rx.patient.fullName}</td>
                <td><span className={`badge ${TYPE_BADGE[rx.type] || 'badge-slate'}`}>{TYPE_LABELS[rx.type] || rx.type}</span></td>
                <td className="text-slate-500 text-xs">{rx.diagnosis || '—'}</td>
                <td>{new Date(rx.issuedAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                <td><span className={`badge ${rx.status === 'ACTIVA' ? 'badge-green' : 'badge-slate'}`}>{rx.status === 'ACTIVA' ? 'Activa' : rx.status}</span></td>
                <td className="text-right"><Link to={`/patients/${rx.patientId}`} className="text-blue-600 text-xs">Ver paciente</Link></td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={6} className="text-center text-slate-400 py-6">Aún no hay recetas emitidas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
