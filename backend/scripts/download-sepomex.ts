/**
 * Genera frontend/public/sepomex-cp.json desde el dataset redrbrt/sepomex-zip-codes.
 * Uso: npm run seed:sepomex  (tarda ~30 segundos, solo se hace una vez)
 */
import https from 'https';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const RAW_URL = 'https://raw.githubusercontent.com/redrbrt/sepomex-zip-codes/master/sepomex_abril-2016.json';
const OUTPUT  = process.env.SEPOMEX_OUTPUT
  ?? path.resolve(__dirname, '../../frontend/public/sepomex-cp.json');

function download(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'Accept-Encoding': 'gzip' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location!).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} descargando ${url}`));
      }
      const chunks: Buffer[] = [];
      const stream = res.headers['content-encoding'] === 'gzip'
        ? res.pipe(zlib.createGunzip())
        : res;
      stream.on('data', (c: Buffer) => {
        chunks.push(c);
        process.stdout.write(`\r  Descargando… ${Math.round(Buffer.concat(chunks).length / 1024)} KB`);
      });
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      stream.on('error', reject);
    });
    req.on('error', reject);
  });
}

async function main() {
  console.log('Descargando dataset SEPOMEX de GitHub…');
  const raw = await download(RAW_URL);
  console.log('\nProcesando registros…');

  const rows: any[] = JSON.parse(raw.replace(/:\s*NULL\b/g, ': null'));

  // Detecta nombres de campos del primer registro
  const sample = rows[0] ?? {};
  const keys = Object.keys(sample);
  console.log('  Campos detectados:', keys.slice(0, 8).join(', '));

  // Mapeo flexible: busca por nombre exacto o insensible a mayúsculas
  const find = (row: any, ...names: string[]) => {
    for (const n of names) {
      if (row[n] != null) return String(row[n]).trim();
      const lower = n.toLowerCase();
      for (const k of Object.keys(row)) {
        if (k.toLowerCase() === lower && row[k] != null) return String(row[k]).trim();
      }
    }
    return '';
  };

  type Row = { e: string; m: string; c: string[] };
  const db: Record<string, Row> = {};

  for (const row of rows) {
    const cp  = find(row, 'd_codigo', 'CP', 'cp', 'codigo_postal').padStart(5, '0');
    const col = find(row, 'd_asenta', 'ASENTAMIENTO', 'asentamiento', 'd_ASENTA');
    const mun = find(row, 'D_mnpio', 'd_mnpio', 'MUNICIPIO', 'municipio', 'd_MUNICIPIO');
    const est = find(row, 'd_estado', 'ESTADO', 'estado', 'D_ESTADO');
    if (!cp || cp === '00000') continue;

    if (!db[cp]) db[cp] = { e: est, m: mun, c: [] };
    if (col && !db[cp].c.includes(col)) db[cp].c.push(col);
  }

  const total = Object.keys(db).length;
  console.log(`✓ ${total} CPs procesados`);

  const dir = path.dirname(OUTPUT);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(db));
  console.log(`✓ Guardado en ${OUTPUT} (${Math.round(fs.statSync(OUTPUT).size / 1024)} KB)`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
