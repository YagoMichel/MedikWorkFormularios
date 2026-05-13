import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../services/api';

interface Batch {
  id: string;
  date: string;
  expectedCount: number;
  status: 'BORRADOR' | 'CONFIRMADO' | 'CANCELADO';
  company: { name: string };
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function StatusBadge({ status }: { status: Batch['status'] }) {
  if (status === 'CONFIRMADO') return <span className="badge badge-green">CONFIRMADO</span>;
  if (status === 'CANCELADO') return <span className="badge badge-red">CANCELADO</span>;
  return <span className="badge badge-slate">BORRADOR</span>;
}

export default function Citas() {
  const qc = useQueryClient();

  const { data: batches = [], isLoading } = useQuery<Batch[]>({
    queryKey: ['batches'],
    queryFn: () => api.get('/batches').then((r) => r.data),
  });

  const confirm = useMutation({
    mutationFn: (id: string) => api.post(`/batches/${id}/confirm-admin`),
    onSuccess: () => {
      toast.success('Cita confirmada');
      qc.invalidateQueries({ queryKey: ['batches'] });
    },
    onError: () => toast.error('Error al confirmar la cita'),
  });

  if (isLoading) return <p className="text-slate-500">Cargando...</p>;

  return (
    <div className="card p-0 overflow-hidden">
      <table className="tbl">
        <thead>
          <tr>
            <th>Empresa</th>
            <th>Fecha</th>
            <th>Trabajadores</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {batches.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center text-slate-400 py-8">
                Sin solicitudes de cita.
              </td>
            </tr>
          ) : (
            batches.map((b) => (
              <tr key={b.id}>
                <td>{b.company.name}</td>
                <td>{formatDate(b.date)}</td>
                <td>{b.expectedCount}</td>
                <td><StatusBadge status={b.status} /></td>
                <td>
                  {b.status === 'BORRADOR' && (
                    <div className="flex gap-2">
                      <button
                        className="btn btn-primary"
                        onClick={() => confirm.mutate(b.id)}
                        disabled={confirm.isPending}
                      >
                        Confirmar
                      </button>
                      <button
                        className="btn btn-secondary opacity-50 cursor-not-allowed"
                        disabled
                      >
                        Contactar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
