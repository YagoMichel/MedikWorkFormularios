// Descarga un archivo desde un endpoint autenticado (adjunta el JWT vía el
// interceptor de axios) y dispara la descarga en el navegador.
import { api } from '../services/api';

export async function downloadAuthedFile(url: string, fileName: string) {
  const { data } = await api.get(url, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}
