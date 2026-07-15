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
import { Users, Building2, CheckCircle2, Calendar } from 'lucide-react';

const fmt = (n: number) => `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0 })}`;
const COLORS = ['#2560aa', '#51abcd', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700 ${className}`}>
      {title && <h3 className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-6 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#51abcd]"></span>{title}</h3>}
      {children}
    </div>
  );
}

function KpiBox({ label, value, sub, color = '#2560aa', icon: Icon, bgClass = '' }: { label: string; value: string | number; sub?: string; color?: string; icon: any; bgClass?: string }) {
  return (
    <div className={`rounded-3xl p-6 flex flex-col gap-2 ${bgClass || 'bg-white dark:bg-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700'} relative overflow-hidden group hover:scale-[1.02] transition-transform`}>
      <div className="flex items-center justify-between mb-2 z-10">
        <div className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</div>
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur shadow-sm transition-transform group-hover:rotate-12" style={{ color }}>
          <Icon size={20} strokeWidth={2.5} />
        </div>
      </div>
      <div className="text-3xl font-black z-10" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px] font-bold text-slate-400 z-10 mt-1">{sub}</div>}
      
      {/* Decorative background blur */}
      <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full opacity-10 blur-xl pointer-events-none" style={{ backgroundColor: color }}></div>
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
    borderRadius: 16,
    color: dark ? '#e2e8f0' : '#1e293b',
    fontSize: 12,
    fontWeight: 'bold',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
  };
  const tooltipLabelStyle = { color: dark ? '#94a3b8' : '#64748b', marginBottom: 4 };
  const tooltipItemStyle  = { color: dark ? '#e2e8f0' : '#1e293b', fontWeight: '800' };
  const legendStyle  = { color: dark ? '#94a3b8' : '#64748b', fontSize: 12, fontWeight: 'bold' };

  const axisProps = {
    tick: { fontSize: 11, fill: axisColor, fontWeight: 'bold' },
    tickLine: false as const,
  };

  if (isLoading || !data) {
    return <div className="flex items-center justify-center h-[50vh] text-slate-400 font-bold text-sm">Cargando reportes detallados…</div>;
  }

  const { ventasMes, citasMes, top5Companies, top5Products, batchesByStatus, usuariosPastel, kpis, citasConfirmadas, proximaCita } = data;

  const statusLabels: Record<string, string> = { BORRADOR: 'Pendiente', CONFIRMADO: 'Confirmado', CANCELADO: 'Cancelado', CERRADO: 'Cerrado' };
  const pieStatus = (batchesByStatus as any[]).map((b: any) => ({ name: statusLabels[b.status] || b.status, value: b._count }));

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">Métricas y Reportes</h1>
        <p className="text-sm font-semibold text-slate-500 mt-1">Análisis de rendimiento, pacientes y ventas</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiBox label="Pacientes"      value={kpis.totalPacientes}  sub="Usuarios registrados"  color="#2560aa" icon={Users} bgClass="bg-[#2560aa]/5 border-[#2560aa]/10" />
        <KpiBox label="Empresas"       value={kpis.totalEmpresas}   sub="Con expediente activo" color="#51abcd" icon={Building2} bgClass="bg-[#51abcd]/5 border-[#51abcd]/10" />
        <KpiBox label="Confirmadas"    value={citasConfirmadas}     sub="Citas futuras"         color="#10b981" icon={CheckCircle2} bgClass="bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30" />
        <KpiBox
          label="Próxima cita"
          value={proximaCita ? new Date(proximaCita).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : '—'}
          sub={proximaCita ? new Date(proximaCita).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'Sin citas agendadas'}
          color="#8b5cf6"
          icon={Calendar}
          bgClass="bg-[#8b5cf6]/5 border-[#8b5cf6]/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Citas y trabajadores por mes */}
        <Card title="Citas empresariales vs Trabajadores" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={citasMes} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="mes" {...axisProps} axisLine={{ stroke: gridColor }} />
              <YAxis {...axisProps} axisLine={false} width={32} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Legend wrapperStyle={legendStyle} iconType="circle" />
              <Line type="monotone" dataKey="citas"        name="Citas"        stroke="#2560aa" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, fill: '#2560aa' }} />
              <Line type="monotone" dataKey="trabajadores" name="Trabajadores" stroke="#51abcd" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, fill: '#51abcd' }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Estado de solicitudes */}
        <Card title="Estado de solicitudes">
          <div className="flex flex-col items-center gap-6 h-[260px] justify-center relative">
            <PieChart width={180} height={180}>
              <Pie data={pieStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={55} stroke="none" paddingAngle={5} cornerRadius={4}>
                {pieStatus.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
            </PieChart>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total</div>
                <div className="text-xl font-black text-slate-800 dark:text-white">
                  {pieStatus.reduce((acc, curr) => acc + curr.value, 0)}
                </div>
              </div>
            </div>
            <div className="flex justify-center flex-wrap gap-x-4 gap-y-2 w-full mt-2">
              {pieStatus.map((d: any, i: number) => (
                <div key={i} className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: COLORS[i % COLORS.length] }} />
                  {d.name} <span className="text-slate-400">({d.value})</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ventas mensuales */}
        <Card title="Ventas mensuales (últimos 12 meses)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ventasMes} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="mes" {...axisProps} axisLine={{ stroke: gridColor }} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} {...axisProps} axisLine={false} width={52} />
              <Tooltip formatter={(v: number) => [fmt(v), 'Total ventas']} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} cursor={{ fill: cursorFill }} />
              <Bar dataKey="total" name="Total ventas" fill="#2560aa" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Top productos */}
        {top5Products.length > 0 && (
          <Card title="Top productos más vendidos (este año)">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={top5Products} layout="vertical" margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" {...axisProps} axisLine={{ stroke: gridColor }} />
                <YAxis dataKey="producto" type="category" {...axisProps} axisLine={false} width={140} />
                <Tooltip formatter={(v: number, name: string) => [name === 'ingresos' ? fmt(v) : v, name]} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} cursor={{ fill: cursorFill }} />
                <Legend wrapperStyle={legendStyle} iconType="circle" />
                <Bar dataKey="unidades" name="Unidades" fill="#51abcd" radius={[0, 6, 6, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* Usuarios por rol - Removed since it's less relevant or can be put at the bottom */}
      {usuariosPastel.length > 0 && (
        <Card title="Distribución de Usuarios en el Sistema">
          <div className="flex items-center gap-12 h-[200px] justify-center">
            <PieChart width={200} height={200}>
              <Pie data={usuariosPastel} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45} stroke="none" paddingAngle={4} cornerRadius={4}>
                {usuariosPastel.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
            </PieChart>
            <div className="flex flex-col gap-4">
              {usuariosPastel.map((d: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-4 h-4 rounded-full shadow-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-sm font-extrabold text-slate-600 dark:text-slate-300 w-24">{d.name}</span>
                  <span className="text-sm font-black text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

    </div>
  );
}
