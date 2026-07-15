// =============================================================
// ARCHIVO: src/pages/portal/PatientPurchases.tsx
// DESCRIPCION: Portal del paciente — "Mis compras". Muestra sus ventas (POS)
//   con productos, totales y abonos, acotadas por su patientId ligado.
// =============================================================
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import SalesHistory from '../../components/SalesHistory';

export default function PatientPurchases() {
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['portal-purchases'],
    queryFn: async () => (await api.get('/portal/patient/purchases')).data,
  });

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h2 className="text-xl font-bold">Mis compras</h2>
        <p className="text-sm text-slate-500 mt-1">Aquí ves lo que has comprado en la clínica, con su detalle y saldo.</p>
      </div>
      {isLoading
        ? <div className="card text-sm text-slate-400">Cargando…</div>
        : <SalesHistory sales={sales} emptyText="Aún no tienes compras registradas." />}
    </div>
  );
}
