import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Building2, ChevronDown, Eye, EyeOff, FileText, Search, ShieldCheck, X } from 'lucide-react';
import { api } from '../../services/api';

const TYPE_LABEL: Record<string, string> = {
  CUESTIONARIO: 'Cuestionario',
  RESULTADOS: 'Resultados',
  CONSENTIMIENTO: 'Consentimiento',
  OTRO: 'Otro documento',
};

const maskedNss = (nss?: string | null) => {
  if (!nss) return 'Sin registrar';
  return nss.length <= 4 ? nss : `${'•'.repeat(nss.length - 4)}${nss.slice(-4)}`;
};

export default function CompaniesReview() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [openCompany, setOpenCompany] = useState<string | null>(null);
  const [openPatient, setOpenPatient] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<null | { name: string; url: string; mime: string }>(null);

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ['documents-company-review'],
    queryFn: async () => (await api.get('/documents/company-review')).data,
  });

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const map = new Map<string, { name: string; patients: any[] }>();
    for (const patient of patients as any[]) {
      const companyName = patient.companyRel?.name || patient.company || 'Sin empresa';
      if (term && !companyName.toLowerCase().includes(term) &&
          !patient.fullName.toLowerCase().includes(term)) continue;
      const key = patient.companyRel?.id || companyName.toLowerCase();
      if (!map.has(key)) map.set(key, { name: companyName, patients: [] });
      map.get(key)!.patients.push(patient);
    }
    return [...map.entries()].map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [patients, search]);

  const documents = (patients as any[]).flatMap((patient) => patient.documents);
  const pending = documents.filter((document) => !document.companyVisible).length;
  const approved = documents.filter((document) => document.companyVisible).length;

  const toggleVisibility = async (document: any) => {
    setSavingId(document.id);
    try {
      await api.patch(`/documents/${document.id}/company-visibility`, { visible: !document.companyVisible });
      await qc.invalidateQueries({ queryKey: ['documents-company-review'] });
      toast.success(document.companyVisible ? 'Acceso revocado' : 'Archivo autorizado para la empresa');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'No se pudo cambiar la autorización');
    } finally {
      setSavingId(null);
    }
  };

  const openPreview = async (document: any) => {
    setPreviewLoadingId(document.id);
    try {
      const response = await api.get(`/documents/${document.id}/preview`, { responseType: 'blob' });
      const mime = response.headers['content-type'] || response.data.type || 'application/octet-stream';
      const url = URL.createObjectURL(response.data);
      setPreview({ name: document.fileName, url, mime });
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'No se pudo abrir la vista previa');
    } finally {
      setPreviewLoadingId(null);
    }
  };

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview]);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><ShieldCheck className="text-[#3375c8]" /> Archivos para empresas</h2>
          <p className="text-sm text-slate-500 mt-1">Autoriza únicamente los documentos que podrá consultar cada empresa.</p>
        </div>
        <div className="flex gap-3 text-sm">
          <span className="rounded-xl bg-amber-50 text-amber-700 px-3 py-2 font-semibold">{pending} pendientes</span>
          <span className="rounded-xl bg-emerald-50 text-emerald-700 px-3 py-2 font-semibold">{approved} autorizados</span>
        </div>
      </div>

      <div className="relative">
        <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input" style={{ paddingLeft: '2.5rem' }} placeholder="Buscar empresa o paciente por nombre…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {isLoading && <div className="card text-sm text-slate-400">Cargando archivos…</div>}
      {!isLoading && groups.length === 0 && <div className="card text-center text-sm text-slate-400">No hay archivos empresariales por revisar.</div>}

      <div className="space-y-3">
        {groups.map((group) => {
          const companyOpen = openCompany === group.id;
          const groupDocs = group.patients.flatMap((patient) => patient.documents);
          const groupPending = groupDocs.filter((document) => !document.companyVisible).length;
          return (
            <div key={group.id} className="card p-0 overflow-hidden">
              <button type="button" onClick={() => setOpenCompany(companyOpen ? null : group.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <Building2 className="text-[#3375c8]" size={20} />
                <div className="font-bold">{group.name}</div>
                <div className="ml-auto text-xs text-slate-400">{group.patients.length} paciente(s) · {groupPending} pendiente(s)</div>
                <ChevronDown size={18} className={`transition-transform ${companyOpen ? 'rotate-180' : ''}`} />
              </button>

              {companyOpen && <div className="border-t border-slate-100 dark:border-slate-700 p-3 space-y-2">
                {group.patients.map((patient) => {
                  const patientOpen = openPatient === patient.id;
                  return <div key={patient.id} className="rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                    <button type="button" onClick={() => setOpenPatient(patientOpen ? null : patient.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left bg-slate-50/60 dark:bg-slate-800/40">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{patient.fullName}</div>
                        <div className="text-xs text-slate-400">NSS: {maskedNss(patient.nss)}</div>
                      </div>
                      <span className="ml-auto text-xs text-slate-400">{patient.documents.length} archivo(s)</span>
                      <ChevronDown size={16} className={`transition-transform ${patientOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {patientOpen && <div className="p-3 space-y-2">
                      {patient.documents.map((document: any) => <div key={document.id} className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-700 p-3">
                        <FileText size={17} className="text-blue-500 shrink-0" />
                        <button type="button"
                          disabled={previewLoadingId === document.id}
                          onClick={() => openPreview(document)}
                          title="Abrir vista previa"
                          className="min-w-0 flex-1 text-left cursor-pointer hover:text-blue-600">
                          <div className="font-medium text-sm truncate">{document.fileName}</div>
                          <div className="text-xs text-slate-400">{TYPE_LABEL[document.type] || document.type} · {new Date(document.visitDate).toLocaleDateString('es-MX')}</div>
                          <div className="text-[11px] text-blue-500 mt-0.5">
                            {previewLoadingId === document.id ? 'Abriendo…' : 'Ver vista previa'}
                          </div>
                        </button>
                        {document.companyVisible ? <Eye size={16} className="text-emerald-600" /> : <EyeOff size={16} className="text-slate-400" />}
                        <button type="button" disabled={savingId === document.id} onClick={() => toggleVisibility(document)}
                          className={`btn text-xs whitespace-nowrap ${document.companyVisible ? 'btn-secondary' : 'btn-primary'}`}>
                          {savingId === document.id ? 'Guardando…' : document.companyVisible ? 'Revocar' : 'Autorizar'}
                        </button>
                      </div>)}
                    </div>}
                  </div>;
                })}
              </div>}
            </div>
          );
        })}
      </div>

      {preview && <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={() => setPreview(null)}>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden"
          onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <FileText size={18} className="text-blue-500 shrink-0" />
            <div className="font-semibold text-sm truncate">{preview.name}</div>
            <button type="button" onClick={() => setPreview(null)} aria-label="Cerrar vista previa"
              className="ml-auto rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 min-h-0 bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
            {preview.mime.includes('pdf') ?
              <iframe src={preview.url} title={`Vista previa de ${preview.name}`} className="w-full h-full border-0" /> :
              preview.mime.startsWith('image/') ?
                <img src={preview.url} alt={preview.name} className="max-w-full max-h-full object-contain" /> :
                preview.mime.startsWith('text/') ?
                  <iframe src={preview.url} title={`Vista previa de ${preview.name}`} className="w-full h-full border-0 bg-white" /> :
                  <div className="max-w-md text-center p-8 text-sm text-slate-500">
                    Este formato no tiene vista previa integrada. Utiliza archivos PDF o imágenes para consultarlos aquí.
                  </div>}
          </div>
        </div>
      </div>}
    </div>
  );
}
