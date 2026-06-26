// =============================================================
// ARCHIVO: src/pages/admin/Reports.tsx
// SECCION: ADMIN (compañero)
// DESCRIPCION: Reportes graficos del negocio.
//              Muestra ventas por periodo, productos mas vendidos,
//              citas por mes y otros indicadores.
// API: GET /api/dashboard
// =============================================================
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useTheme } from '../../stores/theme';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';

const fmt = (n: number) => `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0 })}`;
const COLORS = ['#3375c8', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`card rounded-2xl p-5 ${className}`}>
      {title && <h3 className="text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-4">{title}</h3>}
      {children}
    </div>
  );
}

function KpiBox({ label, value, sub, color = '#3375c8' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="card rounded-2xl p-5 flex flex-col gap-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">{label}</div>
      <div className="text-3xl font-extrabold" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-ink-muted">{sub}</div>}
    </div>
  );
}

export default function Reports() {
  const { dark } = useTheme();
  const { data, isLoading } = useQuery({
    queryKey: ['reportes'],
    queryFn: async () => (await api.get('/dashboard/reportes')).data,
  });

  const axisColor    = dark ? '#64748b' : '#94a3b8';
  const gridColor    = dark ? 'rgba(148,163,184,0.12)' : '#e2e8f0';
  const cursorFill   = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
  const tooltipStyle = {
    backgroundColor: dark ? '#1e293b' : '#fff',
    border: `1px solid ${dark ? 'rgba(148,163,184,0.2)' : '#e2e8f0'}`,
    borderRadius: 8,
    color: dark ? '#e2e8f0' : '#1e293b',
    fontSize: 12,
  };
  const tooltipLabelStyle = { color: dark ? '#94a3b8' : '#64748b' };
  const tooltipItemStyle  = { color: dark ? '#e2e8f0' : '#1e293b' };
  const legendStyle  = { color: dark ? '#94a3b8' : '#64748b', fontSize: 12 };

  const axisProps = {
    tick: { fontSize: 11, fill: axisColor },
    tickLine: false as const,
  };

  if (isLoading || !data) {
    return <div className="flex items-center justify-center h-full text-ink-muted">Cargando reportes…</div>;
  }

  const { ventasMes, citasMes, top5Companies, top5Products, batchesByStatus, usuariosPastel, kpis, citasPendientes, citasConfirmadas, proximaCita } = data;

  const statusLabels: Record<string, string> = { BORRADOR: 'Pendiente', CONFIRMADO: 'Confirmado', CANCELADO: 'Cancelado' };
  const pieStatus = (batchesByStatus as any[]).map((b: any) => ({ name: statusLabels[b.status] || b.status, value: b._count }));

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiBox label="Pacientes"      value={kpis.totalPacientes}  sub="registrados"           color="#3375c8" />
        <KpiBox label="Empresas"       value={kpis.totalEmpresas}   sub="con expediente"        color="#10b981" />
        <KpiBox label="Por confirmar"  value={citasPendientes}      sub="citas pendientes"      color="#f59e0b" />
        <KpiBox label="Confirmadas"    value={citasConfirmadas}     sub="citas futuras"         color="#10b981" />
        <KpiBox
          label="Próxima cita"
          value={proximaCita ? new Date(proximaCita).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
          sub="fecha más cercana"
          color="#8b5cf6"
        />
      </div>

      {/* Ventas mensuales */}
      <Card title="Ventas mensuales (últimos 12 meses)">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={ventasMes} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="mes" {...axisProps} axisLine={{ stroke: gridColor }} />
            <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} {...axisProps} axisLine={false} width={52} />
            <Tooltip formatter={(v: number) => [fmt(v), 'Total ventas']} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} cursor={{ fill: cursorFill }} />
            <Bar dataKey="total" name="Total ventas" fill="#3375c8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Citas y trabajadores por mes */}
        <Card title="Citas empresariales por mes">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={citasMes} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="mes" {...axisProps} axisLine={{ stroke: gridColor }} />
              <YAxis {...axisProps} axisLine={false} width={32} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Legend wrapperStyle={legendStyle} />
              <Line type="monotone" dataKey="citas"        name="Citas"        stroke="#3375c8" strokeWidth={2} dot={{ r: 3, fill: '#3375c8' }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="trabajadores" name="Trabajadores" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Usuarios por rol */}
        <Card title="Usuarios en el sistema">
          <div className="flex items-center justify-center gap-6 h-[220px]">
            <PieChart width={160} height={160}>
              <Pie data={usuariosPastel} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                {usuariosPastel.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
            </PieChart>
            <div className="flex flex-col gap-3">
              {usuariosPastel.map((d: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-sm text-ink-secondary">{d.name}</span>
                  <span className="text-sm font-bold ml-1">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

      </div>

      {/* Estado de solicitudes */}
      <Card title="Estado de solicitudes">
        <div className="flex flex-col items-center gap-4 h-[200px] justify-center">
          <PieChart width={140} height={140}>
            <Pie data={pieStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={30}>
              {pieStatus.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
          </PieChart>
          <div className="flex flex-col gap-1 w-full">
            {pieStatus.map((d: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-ink-secondary">{d.name}</span>
                </div>
                <span className="font-semibold">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Top productos */}
      {top5Products.length > 0 && (
        <Card title="Top productos más vendidos (este año)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={top5Products} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
              <XAxis type="number" {...axisProps} axisLine={{ stroke: gridColor }} />
              <YAxis dataKey="producto" type="category" {...axisProps} axisLine={false} width={140} />
              <Tooltip formatter={(v: number, name: string) => [name === 'ingresos' ? fmt(v) : v, name]} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} cursor={{ fill: cursorFill }} />
              <Legend wrapperStyle={legendStyle} />
              <Bar dataKey="unidades" name="Unidades" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

    </div>
  );
}
