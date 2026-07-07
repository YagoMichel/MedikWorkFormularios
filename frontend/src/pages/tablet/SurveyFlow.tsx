import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { api } from '../../services/api';
import toast from 'react-hot-toast';
import PatientPhotoCapture from '../../components/PatientPhotoCapture';

// ── Dataset SEPOMEX local (generado con npm run seed:sepomex) ────────
type SepomexRow = { e: string; m: string; c: string[] };
let sepomexPromise: Promise<Record<string, SepomexRow> | null> | null = null;
function loadSepomex() {
  if (!sepomexPromise) {
    sepomexPromise = fetch('/sepomex-cp.json')
      .then(r => r.ok ? r.json() as Promise<Record<string, SepomexRow>> : null)
      .catch(() => null);
  }
  return sepomexPromise;
}

// Deriva estado → municipios únicos ordenados a partir del JSON SEPOMEX
type MunicipiosDB = Record<string, string[]>;
let municipiosDBPromise: Promise<MunicipiosDB | null> | null = null;
function loadMunicipiosDB(): Promise<MunicipiosDB | null> {
  if (!municipiosDBPromise) {
    municipiosDBPromise = loadSepomex().then(data => {
      if (!data) return null;
      const db: MunicipiosDB = {};
      for (const row of Object.values(data)) {
        const e = row.e?.trim();
        const m = row.m?.trim();
        if (!e || !m) continue;
        if (!db[e]) db[e] = [];
        if (!db[e].includes(m)) db[e].push(m);
      }
      for (const k of Object.keys(db)) db[k].sort();
      return db;
    });
  }
  return municipiosDBPromise;
}

// Valor centinela para buscar pacientes sin empresa asignada (particulares / sala general)
const SIN_EMPRESA = '__sin_empresa__';

// Calcula la edad en años a partir de una fecha "yyyy-mm-dd" — se usa para
// que la edad siempre coincida con la fecha de nacimiento, sin diferencias.
function calcularEdad(fechaISO: string): string {
  if (!fechaISO) return '';
  const nacimiento = new Date(fechaISO + 'T00:00:00');
  if (isNaN(nacimiento.getTime())) return '';
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mesDiff = hoy.getMonth() - nacimiento.getMonth();
  if (mesDiff < 0 || (mesDiff === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
  return edad >= 0 ? String(edad) : '';
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'No sé'];
const ESCOLARIDADES = [
  'Sin estudios', 'Primaria', 'Secundaria',
  'Preparatoria / Bachillerato', 'Técnico / Tecnológico',
  'Licenciatura', 'Maestría', 'Doctorado',
];
const ESTADOS_CIVILES = ['Soltero/a', 'Casado/a', 'Unión libre', 'Divorciado/a', 'Viudo/a', 'Separado/a'];
const FRECUENCIAS_ALCOHOL = ['Todos los días', 'Cada fin de semana', 'Cada 15 días', 'Cada mes', '1 o 2 veces al año'];

// flag emoji + nombre → código ISO para zippopotam.us
const PAISES_DATA: { label: string; iso: string }[] = [
  // América del Norte
  { label: '🇲🇽 México',                         iso: 'mx' },
  { label: '🇺🇸 Estados Unidos',                  iso: 'us' },
  { label: '🇨🇦 Canadá',                          iso: 'ca' },
  // Centroamérica
  { label: '🇬🇹 Guatemala',                       iso: 'gt' },
  { label: '🇧🇿 Belice',                          iso: 'bz' },
  { label: '🇭🇳 Honduras',                        iso: 'hn' },
  { label: '🇸🇻 El Salvador',                     iso: 'sv' },
  { label: '🇳🇮 Nicaragua',                       iso: 'ni' },
  { label: '🇨🇷 Costa Rica',                      iso: 'cr' },
  { label: '🇵🇦 Panamá',                          iso: 'pa' },
  // Caribe
  { label: '🇨🇺 Cuba',                            iso: 'cu' },
  { label: '🇯🇲 Jamaica',                         iso: 'jm' },
  { label: '🇭🇹 Haití',                           iso: 'ht' },
  { label: '🇩🇴 República Dominicana',            iso: 'do' },
  { label: '🇵🇷 Puerto Rico',                     iso: 'pr' },
  { label: '🇹🇹 Trinidad y Tobago',               iso: 'tt' },
  { label: '🇧🇧 Barbados',                        iso: 'bb' },
  { label: '🇧🇸 Bahamas',                         iso: 'bs' },
  { label: '🇦🇬 Antigua y Barbuda',               iso: 'ag' },
  { label: '🇩🇲 Dominica',                        iso: 'dm' },
  { label: '🇬🇩 Granada',                         iso: 'gd' },
  { label: '🇰🇳 San Cristóbal y Nieves',          iso: 'kn' },
  { label: '🇱🇨 Santa Lucía',                     iso: 'lc' },
  { label: '🇻🇨 San Vicente y las Granadinas',    iso: 'vc' },
  // América del Sur
  { label: '🇻🇪 Venezuela',                       iso: 've' },
  { label: '🇨🇴 Colombia',                        iso: 'co' },
  { label: '🇪🇨 Ecuador',                         iso: 'ec' },
  { label: '🇵🇪 Perú',                            iso: 'pe' },
  { label: '🇧🇴 Bolivia',                         iso: 'bo' },
  { label: '🇨🇱 Chile',                           iso: 'cl' },
  { label: '🇦🇷 Argentina',                       iso: 'ar' },
  { label: '🇺🇾 Uruguay',                         iso: 'uy' },
  { label: '🇵🇾 Paraguay',                        iso: 'py' },
  { label: '🇧🇷 Brasil',                          iso: 'br' },
  { label: '🇬🇾 Guyana',                          iso: 'gy' },
  { label: '🇸🇷 Surinam',                         iso: 'sr' },
  // Europa Occidental
  { label: '🇪🇸 España',                          iso: 'es' },
  { label: '🇫🇷 Francia',                         iso: 'fr' },
  { label: '🇩🇪 Alemania',                        iso: 'de' },
  { label: '🇮🇹 Italia',                          iso: 'it' },
  { label: '🇬🇧 Reino Unido',                     iso: 'gb' },
  { label: '🇵🇹 Portugal',                        iso: 'pt' },
  { label: '🇳🇱 Países Bajos',                    iso: 'nl' },
  { label: '🇧🇪 Bélgica',                         iso: 'be' },
  { label: '🇨🇭 Suiza',                           iso: 'ch' },
  { label: '🇦🇹 Austria',                         iso: 'at' },
  { label: '🇮🇪 Irlanda',                         iso: 'ie' },
  { label: '🇮🇸 Islandia',                        iso: 'is' },
  { label: '🇱🇺 Luxemburgo',                      iso: 'lu' },
  { label: '🇲🇨 Mónaco',                          iso: 'mc' },
  { label: '🇸🇲 San Marino',                      iso: 'sm' },
  { label: '🇦🇩 Andorra',                         iso: 'ad' },
  { label: '🇲🇹 Malta',                           iso: 'mt' },
  { label: '🇱🇮 Liechtenstein',                   iso: 'li' },
  // Europa del Norte
  { label: '🇸🇪 Suecia',                          iso: 'se' },
  { label: '🇳🇴 Noruega',                         iso: 'no' },
  { label: '🇩🇰 Dinamarca',                       iso: 'dk' },
  { label: '🇫🇮 Finlandia',                       iso: 'fi' },
  { label: '🇱🇹 Lituania',                        iso: 'lt' },
  { label: '🇱🇻 Letonia',                         iso: 'lv' },
  { label: '🇪🇪 Estonia',                         iso: 'ee' },
  // Europa del Este
  { label: '🇵🇱 Polonia',                         iso: 'pl' },
  { label: '🇷🇺 Rusia',                           iso: 'ru' },
  { label: '🇺🇦 Ucrania',                         iso: 'ua' },
  { label: '🇧🇾 Bielorrusia',                     iso: 'by' },
  { label: '🇲🇩 Moldavia',                        iso: 'md' },
  { label: '🇷🇴 Rumanía',                         iso: 'ro' },
  { label: '🇧🇬 Bulgaria',                        iso: 'bg' },
  { label: '🇨🇿 República Checa',                 iso: 'cz' },
  { label: '🇸🇰 Eslovaquia',                      iso: 'sk' },
  { label: '🇭🇺 Hungría',                         iso: 'hu' },
  // Europa del Sur / Balcanes
  { label: '🇬🇷 Grecia',                          iso: 'gr' },
  { label: '🇨🇾 Chipre',                          iso: 'cy' },
  { label: '🇷🇸 Serbia',                          iso: 'rs' },
  { label: '🇭🇷 Croacia',                         iso: 'hr' },
  { label: '🇸🇮 Eslovenia',                       iso: 'si' },
  { label: '🇧🇦 Bosnia y Herzegovina',            iso: 'ba' },
  { label: '🇲🇰 Macedonia del Norte',             iso: 'mk' },
  { label: '🇦🇱 Albania',                         iso: 'al' },
  { label: '🇲🇪 Montenegro',                      iso: 'me' },
  // Cáucaso
  { label: '🇬🇪 Georgia',                         iso: 'ge' },
  { label: '🇦🇲 Armenia',                         iso: 'am' },
  { label: '🇦🇿 Azerbaiyán',                      iso: 'az' },
  // Oriente Medio
  { label: '🇹🇷 Turquía',                         iso: 'tr' },
  { label: '🇮🇱 Israel',                          iso: 'il' },
  { label: '🇯🇴 Jordania',                        iso: 'jo' },
  { label: '🇱🇧 Líbano',                          iso: 'lb' },
  { label: '🇸🇾 Siria',                           iso: 'sy' },
  { label: '🇮🇶 Irak',                            iso: 'iq' },
  { label: '🇮🇷 Irán',                            iso: 'ir' },
  { label: '🇸🇦 Arabia Saudita',                  iso: 'sa' },
  { label: '🇦🇪 Emiratos Árabes Unidos',          iso: 'ae' },
  { label: '🇶🇦 Catar',                           iso: 'qa' },
  { label: '🇰🇼 Kuwait',                          iso: 'kw' },
  { label: '🇧🇭 Baréin',                          iso: 'bh' },
  { label: '🇴🇲 Omán',                            iso: 'om' },
  { label: '🇾🇪 Yemen',                           iso: 'ye' },
  // Norte de África
  { label: '🇪🇬 Egipto',                          iso: 'eg' },
  { label: '🇱🇾 Libia',                           iso: 'ly' },
  { label: '🇹🇳 Túnez',                           iso: 'tn' },
  { label: '🇩🇿 Argelia',                         iso: 'dz' },
  { label: '🇲🇦 Marruecos',                       iso: 'ma' },
  // África Subsahariana
  { label: '🇳🇬 Nigeria',                         iso: 'ng' },
  { label: '🇿🇦 Sudáfrica',                       iso: 'za' },
  { label: '🇰🇪 Kenia',                           iso: 'ke' },
  { label: '🇪🇹 Etiopía',                         iso: 'et' },
  { label: '🇬🇭 Ghana',                           iso: 'gh' },
  { label: '🇹🇿 Tanzania',                        iso: 'tz' },
  { label: '🇺🇬 Uganda',                          iso: 'ug' },
  { label: '🇷🇼 Ruanda',                          iso: 'rw' },
  { label: '🇸🇳 Senegal',                         iso: 'sn' },
  { label: '🇨🇮 Costa de Marfil',                 iso: 'ci' },
  { label: '🇨🇲 Camerún',                         iso: 'cm' },
  { label: '🇲🇿 Mozambique',                      iso: 'mz' },
  { label: '🇦🇴 Angola',                          iso: 'ao' },
  { label: '🇿🇲 Zambia',                          iso: 'zm' },
  { label: '🇿🇼 Zimbabue',                        iso: 'zw' },
  { label: '🇲🇬 Madagascar',                      iso: 'mg' },
  { label: '🇲🇼 Malaui',                          iso: 'mw' },
  { label: '🇳🇦 Namibia',                         iso: 'na' },
  { label: '🇧🇼 Botsuana',                        iso: 'bw' },
  { label: '🇸🇿 Esuatini',                        iso: 'sz' },
  { label: '🇱🇸 Lesoto',                          iso: 'ls' },
  { label: '🇸🇩 Sudán',                           iso: 'sd' },
  { label: '🇸🇸 Sudán del Sur',                   iso: 'ss' },
  { label: '🇸🇴 Somalia',                         iso: 'so' },
  { label: '🇪🇷 Eritrea',                         iso: 'er' },
  { label: '🇩🇯 Yibuti',                          iso: 'dj' },
  { label: '🇧🇯 Benín',                           iso: 'bj' },
  { label: '🇹🇬 Togo',                            iso: 'tg' },
  { label: '🇬🇳 Guinea',                          iso: 'gn' },
  { label: '🇸🇱 Sierra Leona',                    iso: 'sl' },
  { label: '🇱🇷 Liberia',                         iso: 'lr' },
  { label: '🇬🇼 Guinea-Bisáu',                    iso: 'gw' },
  { label: '🇬🇶 Guinea Ecuatorial',               iso: 'gq' },
  { label: '🇬🇦 Gabón',                           iso: 'ga' },
  { label: '🇨🇬 República del Congo',             iso: 'cg' },
  { label: '🇨🇩 Rep. Democrática del Congo',      iso: 'cd' },
  { label: '🇨🇫 Rep. Centroafricana',             iso: 'cf' },
  { label: '🇲🇱 Malí',                            iso: 'ml' },
  { label: '🇧🇫 Burkina Faso',                    iso: 'bf' },
  { label: '🇳🇪 Níger',                           iso: 'ne' },
  { label: '🇹🇩 Chad',                            iso: 'td' },
  { label: '🇧🇮 Burundi',                         iso: 'bi' },
  { label: '🇰🇲 Comoras',                         iso: 'km' },
  { label: '🇸🇨 Seychelles',                      iso: 'sc' },
  { label: '🇲🇺 Mauricio',                        iso: 'mu' },
  { label: '🇨🇻 Cabo Verde',                      iso: 'cv' },
  { label: '🇸🇹 Santo Tomé y Príncipe',           iso: 'st' },
  // Asia Central
  { label: '🇰🇿 Kazajistán',                      iso: 'kz' },
  { label: '🇺🇿 Uzbekistán',                      iso: 'uz' },
  { label: '🇹🇲 Turkmenistán',                    iso: 'tm' },
  { label: '🇹🇯 Tayikistán',                      iso: 'tj' },
  { label: '🇰🇬 Kirguistán',                      iso: 'kg' },
  // Asia del Sur
  { label: '🇮🇳 India',                           iso: 'in' },
  { label: '🇵🇰 Pakistán',                        iso: 'pk' },
  { label: '🇧🇩 Bangladés',                       iso: 'bd' },
  { label: '🇱🇰 Sri Lanka',                       iso: 'lk' },
  { label: '🇳🇵 Nepal',                           iso: 'np' },
  { label: '🇧🇹 Bután',                           iso: 'bt' },
  { label: '🇲🇻 Maldivas',                        iso: 'mv' },
  { label: '🇦🇫 Afganistán',                      iso: 'af' },
  // Asia Oriental
  { label: '🇨🇳 China',                           iso: 'cn' },
  { label: '🇯🇵 Japón',                           iso: 'jp' },
  { label: '🇰🇷 Corea del Sur',                   iso: 'kr' },
  { label: '🇰🇵 Corea del Norte',                 iso: 'kp' },
  { label: '🇲🇳 Mongolia',                        iso: 'mn' },
  { label: '🇹🇼 Taiwán',                          iso: 'tw' },
  // Asia Sudoriental
  { label: '🇻🇳 Vietnam',                         iso: 'vn' },
  { label: '🇹🇭 Tailandia',                       iso: 'th' },
  { label: '🇲🇾 Malasia',                         iso: 'my' },
  { label: '🇸🇬 Singapur',                        iso: 'sg' },
  { label: '🇮🇩 Indonesia',                       iso: 'id' },
  { label: '🇵🇭 Filipinas',                       iso: 'ph' },
  { label: '🇲🇲 Myanmar',                         iso: 'mm' },
  { label: '🇰🇭 Camboya',                         iso: 'kh' },
  { label: '🇱🇦 Laos',                            iso: 'la' },
  { label: '🇧🇳 Brunéi',                          iso: 'bn' },
  { label: '🇹🇱 Timor Oriental',                  iso: 'tl' },
  // Oceanía
  { label: '🇦🇺 Australia',                       iso: 'au' },
  { label: '🇳🇿 Nueva Zelanda',                   iso: 'nz' },
  { label: '🇫🇯 Fiyi',                            iso: 'fj' },
  { label: '🇵🇬 Papúa Nueva Guinea',              iso: 'pg' },
  { label: '🇸🇧 Islas Salomón',                   iso: 'sb' },
  { label: '🇻🇺 Vanuatu',                         iso: 'vu' },
  { label: '🇼🇸 Samoa',                           iso: 'ws' },
  { label: '🇹🇴 Tonga',                           iso: 'to' },
  { label: '🇰🇮 Kiribati',                        iso: 'ki' },
  { label: '🇫🇲 Micronesia',                      iso: 'fm' },
  { label: '🇲🇭 Islas Marshall',                  iso: 'mh' },
  { label: '🇵🇼 Palaos',                          iso: 'pw' },
  { label: '🇳🇷 Nauru',                           iso: 'nr' },
  { label: '🇹🇻 Tuvalu',                          iso: 'tv' },
];

const PAISES = PAISES_DATA.map(p => p.label);
const ZIPPO_CODES = Object.fromEntries(PAISES_DATA.map(p => [p.label, p.iso]));

const ESTADOS_MEXICO = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua',
  'Ciudad de México','Coahuila de Zaragoza','Colima','Durango','Estado de México','Guanajuato',
  'Guerrero','Hidalgo','Jalisco','Michoacán de Ocampo','Morelos','Nayarit','Nuevo León','Oaxaca',
  'Puebla','Querétaro','Quintana Roo','San Luis Potosí','Sinaloa','Sonora','Tabasco','Tamaulipas',
  'Tlaxcala','Veracruz de Ignacio de la Llave','Yucatán','Zacatecas',
];

const MUNICIPIOS_MEXICO: Record<string, string[]> = {
  'Aguascalientes': ['Aguascalientes','Asientos','Calvillo','Cosío','El Llano','Jesús María','Pabellón de Arteaga','Rincón de Romos','San Francisco de los Romo','San José de Gracia','Tepezalá'],
  'Baja California': ['Ensenada','Mexicali','Playas de Rosarito','Tecate','Tijuana'],
  'Baja California Sur': ['Comondú','La Paz','Los Cabos','Loreto','Mulegé'],
  'Campeche': ['Calkiní','Campeche','Candelaria','Carmen','Champotón','Ciudad del Carmen','Escárcega','Hecelchakán','Hopelchén','Palizada','Tenabo'],
  'Chiapas': ['Comitán de Domínguez','Ocosingo','Palenque','San Cristóbal de las Casas','Tapachula','Tonalá','Tuxtla Gutiérrez','Villaflores'],
  'Chihuahua': ['Chihuahua','Ciudad Juárez','Cuauhtémoc','Delicias','Hidalgo del Parral','Ojinaga'],
  'Ciudad de México': ['Álvaro Obregón','Azcapotzalco','Benito Juárez','Coyoacán','Cuajimalpa de Morelos','Cuauhtémoc','Gustavo A. Madero','Iztacalco','Iztapalapa','La Magdalena Contreras','Miguel Hidalgo','Milpa Alta','Tláhuac','Tlalpan','Venustiano Carranza','Xochimilco'],
  'Coahuila de Zaragoza': ['Acuña','Monclova','Nava','Piedras Negras','Ramos Arizpe','Saltillo','Torreón'],
  'Colima': ['Armería','Colima','Comala','Coquimatlán','Cuauhtémoc','Ixtlahuacán','Manzanillo','Minatitlán','Tecomán','Villa de Álvarez'],
  'Durango': ['Durango','Gómez Palacio','Lerdo','Pueblo Nuevo','Santiago Papasquiaro','Tlahualilo'],
  'Estado de México': ['Atizapán de Zaragoza','Chimalhuacán','Cuautitlán Izcalli','Ecatepec de Morelos','Ixtapaluca','Metepec','Naucalpan de Juárez','Nezahualcóyotl','Nicolás Romero','Tecámac','Texcoco','Tlalnepantla de Baz','Toluca','Tultitlán','Valle de Chalco Solidaridad'],
  'Guanajuato': ['Abasolo','Celaya','Guanajuato','Irapuato','León','Salamanca','San Miguel de Allende','Silao de la Victoria'],
  'Guerrero': ['Acapulco de Juárez','Chilpancingo de los Bravo','Iguala de la Independencia','Taxco de Alarcón','Zihuatanejo de Azueta'],
  'Hidalgo': ['Pachuca de Soto','Tizayuca','Tula de Allende','Tulancingo de Bravo','Zempoala'],
  'Jalisco': ['Guadalajara','Lagos de Moreno','Puerto Vallarta','San Pedro Tlaquepaque','Tepatitlán de Morelos','Tlajomulco de Zúñiga','Tlaquepaque','Tonalá','Zapopan','Zapotlán el Grande'],
  'Michoacán de Ocampo': ['Apatzingán','Lázaro Cárdenas','Morelia','Uruapan','Zamora','Zitácuaro'],
  'Morelos': ['Cuernavaca','Cuautla','Jiutepec','Temixco','Xochitepec','Yautepec de Zaragoza'],
  'Nayarit': ['Bahía de Banderas','Compostela','Santiago Ixcuintla','Tepic','Xalisco'],
  'Nuevo León': ['Apodaca','Cadereyta Jiménez','García','General Escobedo','Guadalupe','Juárez','Linares','Monterrey','San Nicolás de los Garza','San Pedro Garza García','Santa Catarina'],
  'Oaxaca': ['Huajuapan de León','Juchitán de Zaragoza','Oaxaca de Juárez','Puerto Escondido','Salina Cruz','San Bartolo Coyotepec','Tehuantepec','Tuxtepec'],
  'Puebla': ['Atlixco','Cholula','Cuautlancingo','Puebla','San Andrés Cholula','San Martín Texmelucan','Tehuacán','Teziutlán'],
  'Querétaro': ['Corregidora','El Marqués','Querétaro','San Juan del Río','Tequisquiapan'],
  'Quintana Roo': ['Bacalar','Benito Juárez','Cancún','Chetumal','Cozumel','Felipe Carrillo Puerto','Isla Mujeres','Playa del Carmen','Puerto Morelos','Solidaridad','Tulum'],
  'San Luis Potosí': ['Matehuala','Rioverde','San Luis Potosí','Soledad de Graciano Sánchez','Tamazunchale','Valles'],
  'Sinaloa': ['Ahome','Culiacán','Guasave','Los Mochis','Mazatlán','Navolato'],
  'Sonora': ['Cajeme','Ciudad Obregón','Guaymas','Hermosillo','Navojoa','Nogales','San Luis Río Colorado'],
  'Tabasco': ['Cárdenas','Centro','Comalcalco','Cunduacán','Paraíso','Villahermosa'],
  'Tamaulipas': ['Altamira','Madero','Matamoros','Nuevo Laredo','Reynosa','Tampico','Victoria'],
  'Tlaxcala': ['Apizaco','Chiautempan','Huamantla','Tlaxcala','Zacatelco'],
  'Veracruz de Ignacio de la Llave': ['Boca del Río','Coatzacoalcos','Córdoba','Minatitlán','Orizaba','Poza Rica de Hidalgo','Tuxpan','Veracruz','Xalapa'],
  'Yucatán': ['Kanasín','Mérida','Progreso','Umán','Valladolid'],
  'Zacatecas': ['Calera','Fresnillo','Guadalupe','Jerez de García Salinas','Zacatecas'],
};

const LADAS = [
  // ─── América Latina ───────────────────────────────────────────
  { lada: '+52',  bandera: '🇲🇽', nombre: 'México',               digitos: 10 },
  { lada: '+54',  bandera: '🇦🇷', nombre: 'Argentina',             digitos: 10 },
  { lada: '+591', bandera: '🇧🇴', nombre: 'Bolivia',               digitos:  8 },
  { lada: '+55',  bandera: '🇧🇷', nombre: 'Brasil',                digitos: 11 },
  { lada: '+56',  bandera: '🇨🇱', nombre: 'Chile',                 digitos:  9 },
  { lada: '+57',  bandera: '🇨🇴', nombre: 'Colombia',              digitos: 10 },
  { lada: '+506', bandera: '🇨🇷', nombre: 'Costa Rica',            digitos:  8 },
  { lada: '+53',  bandera: '🇨🇺', nombre: 'Cuba',                  digitos:  8 },
  { lada: '+593', bandera: '🇪🇨', nombre: 'Ecuador',               digitos:  9 },
  { lada: '+503', bandera: '🇸🇻', nombre: 'El Salvador',           digitos:  8 },
  { lada: '+502', bandera: '🇬🇹', nombre: 'Guatemala',             digitos:  8 },
  { lada: '+509', bandera: '🇭🇹', nombre: 'Haití',                 digitos:  8 },
  { lada: '+504', bandera: '🇭🇳', nombre: 'Honduras',              digitos:  8 },
  { lada: '+1876',bandera: '🇯🇲', nombre: 'Jamaica',               digitos: 10 },
  { lada: '+505', bandera: '🇳🇮', nombre: 'Nicaragua',             digitos:  8 },
  { lada: '+507', bandera: '🇵🇦', nombre: 'Panamá',                digitos:  8 },
  { lada: '+595', bandera: '🇵🇾', nombre: 'Paraguay',              digitos:  9 },
  { lada: '+51',  bandera: '🇵🇪', nombre: 'Perú',                  digitos:  9 },
  { lada: '+1809',bandera: '🇩🇴', nombre: 'República Dominicana',  digitos: 10 },
  { lada: '+598', bandera: '🇺🇾', nombre: 'Uruguay',               digitos:  9 },
  { lada: '+58',  bandera: '🇻🇪', nombre: 'Venezuela',             digitos: 10 },
  // ─── América del Norte ────────────────────────────────────────
  { lada: '+1',   bandera: '🇺🇸', nombre: 'EE. UU. / Canadá',      digitos: 10 },
  // ─── Europa ───────────────────────────────────────────────────
  { lada: '+49',  bandera: '🇩🇪', nombre: 'Alemania',              digitos: 11 },
  { lada: '+43',  bandera: '🇦🇹', nombre: 'Austria',               digitos: 10 },
  { lada: '+32',  bandera: '🇧🇪', nombre: 'Bélgica',               digitos:  9 },
  { lada: '+359', bandera: '🇧🇬', nombre: 'Bulgaria',              digitos:  9 },
  { lada: '+385', bandera: '🇭🇷', nombre: 'Croacia',               digitos:  9 },
  { lada: '+45',  bandera: '🇩🇰', nombre: 'Dinamarca',             digitos:  8 },
  { lada: '+421', bandera: '🇸🇰', nombre: 'Eslovaquia',            digitos:  9 },
  { lada: '+386', bandera: '🇸🇮', nombre: 'Eslovenia',             digitos:  8 },
  { lada: '+34',  bandera: '🇪🇸', nombre: 'España',                digitos:  9 },
  { lada: '+372', bandera: '🇪🇪', nombre: 'Estonia',               digitos:  8 },
  { lada: '+358', bandera: '🇫🇮', nombre: 'Finlandia',             digitos:  9 },
  { lada: '+33',  bandera: '🇫🇷', nombre: 'Francia',               digitos:  9 },
  { lada: '+30',  bandera: '🇬🇷', nombre: 'Grecia',                digitos: 10 },
  { lada: '+36',  bandera: '🇭🇺', nombre: 'Hungría',               digitos:  9 },
  { lada: '+353', bandera: '🇮🇪', nombre: 'Irlanda',               digitos:  9 },
  { lada: '+354', bandera: '🇮🇸', nombre: 'Islandia',              digitos:  7 },
  { lada: '+39',  bandera: '🇮🇹', nombre: 'Italia',                digitos: 10 },
  { lada: '+371', bandera: '🇱🇻', nombre: 'Letonia',               digitos:  8 },
  { lada: '+370', bandera: '🇱🇹', nombre: 'Lituania',              digitos:  8 },
  { lada: '+352', bandera: '🇱🇺', nombre: 'Luxemburgo',            digitos:  9 },
  { lada: '+356', bandera: '🇲🇹', nombre: 'Malta',                 digitos:  8 },
  { lada: '+373', bandera: '🇲🇩', nombre: 'Moldavia',              digitos:  8 },
  { lada: '+47',  bandera: '🇳🇴', nombre: 'Noruega',               digitos:  8 },
  { lada: '+31',  bandera: '🇳🇱', nombre: 'Países Bajos',          digitos:  9 },
  { lada: '+48',  bandera: '🇵🇱', nombre: 'Polonia',               digitos:  9 },
  { lada: '+351', bandera: '🇵🇹', nombre: 'Portugal',              digitos:  9 },
  { lada: '+40',  bandera: '🇷🇴', nombre: 'Rumanía',               digitos: 10 },
  { lada: '+7',   bandera: '🇷🇺', nombre: 'Rusia',                 digitos: 10 },
  { lada: '+46',  bandera: '🇸🇪', nombre: 'Suecia',                digitos:  9 },
  { lada: '+41',  bandera: '🇨🇭', nombre: 'Suiza',                 digitos:  9 },
  { lada: '+380', bandera: '🇺🇦', nombre: 'Ucrania',               digitos:  9 },
  { lada: '+44',  bandera: '🇬🇧', nombre: 'Reino Unido',           digitos: 10 },
  // ─── Asia ─────────────────────────────────────────────────────
  { lada: '+966', bandera: '🇸🇦', nombre: 'Arabia Saudita',        digitos:  9 },
  { lada: '+994', bandera: '🇦🇿', nombre: 'Azerbaiyán',            digitos:  9 },
  { lada: '+880', bandera: '🇧🇩', nombre: 'Bangladesh',            digitos: 10 },
  { lada: '+86',  bandera: '🇨🇳', nombre: 'China',                 digitos: 11 },
  { lada: '+82',  bandera: '🇰🇷', nombre: 'Corea del Sur',         digitos: 10 },
  { lada: '+971', bandera: '🇦🇪', nombre: 'Emiratos Árabes',       digitos:  9 },
  { lada: '+63',  bandera: '🇵🇭', nombre: 'Filipinas',             digitos: 10 },
  { lada: '+91',  bandera: '🇮🇳', nombre: 'India',                 digitos: 10 },
  { lada: '+62',  bandera: '🇮🇩', nombre: 'Indonesia',             digitos: 11 },
  { lada: '+98',  bandera: '🇮🇷', nombre: 'Irán',                  digitos: 10 },
  { lada: '+964', bandera: '🇮🇶', nombre: 'Irak',                  digitos: 10 },
  { lada: '+972', bandera: '🇮🇱', nombre: 'Israel',                digitos:  9 },
  { lada: '+81',  bandera: '🇯🇵', nombre: 'Japón',                 digitos: 10 },
  { lada: '+962', bandera: '🇯🇴', nombre: 'Jordania',              digitos:  9 },
  { lada: '+7',   bandera: '🇰🇿', nombre: 'Kazajistán',            digitos: 10 },
  { lada: '+965', bandera: '🇰🇼', nombre: 'Kuwait',                digitos:  8 },
  { lada: '+996', bandera: '🇰🇬', nombre: 'Kirguistán',            digitos:  9 },
  { lada: '+961', bandera: '🇱🇧', nombre: 'Líbano',                digitos:  8 },
  { lada: '+60',  bandera: '🇲🇾', nombre: 'Malasia',               digitos:  9 },
  { lada: '+95',  bandera: '🇲🇲', nombre: 'Myanmar',               digitos: 10 },
  { lada: '+977', bandera: '🇳🇵', nombre: 'Nepal',                 digitos: 10 },
  { lada: '+968', bandera: '🇴🇲', nombre: 'Omán',                  digitos:  8 },
  { lada: '+92',  bandera: '🇵🇰', nombre: 'Pakistán',              digitos: 10 },
  { lada: '+970', bandera: '🇵🇸', nombre: 'Palestina',             digitos:  9 },
  { lada: '+974', bandera: '🇶🇦', nombre: 'Catar',                 digitos:  8 },
  { lada: '+65',  bandera: '🇸🇬', nombre: 'Singapur',              digitos:  8 },
  { lada: '+94',  bandera: '🇱🇰', nombre: 'Sri Lanka',             digitos:  9 },
  { lada: '+963', bandera: '🇸🇾', nombre: 'Siria',                 digitos:  9 },
  { lada: '+886', bandera: '🇹🇼', nombre: 'Taiwán',                digitos:  9 },
  { lada: '+66',  bandera: '🇹🇭', nombre: 'Tailandia',             digitos:  9 },
  { lada: '+90',  bandera: '🇹🇷', nombre: 'Turquía',               digitos: 10 },
  { lada: '+998', bandera: '🇺🇿', nombre: 'Uzbekistán',            digitos:  9 },
  { lada: '+84',  bandera: '🇻🇳', nombre: 'Vietnam',               digitos: 10 },
  { lada: '+967', bandera: '🇾🇪', nombre: 'Yemen',                 digitos:  9 },
  // ─── África ───────────────────────────────────────────────────
  { lada: '+27',  bandera: '🇿🇦', nombre: 'Sudáfrica',             digitos:  9 },
  { lada: '+213', bandera: '🇩🇿', nombre: 'Argelia',               digitos:  9 },
  { lada: '+244', bandera: '🇦🇴', nombre: 'Angola',                digitos:  9 },
  { lada: '+229', bandera: '🇧🇯', nombre: 'Benín',                 digitos:  8 },
  { lada: '+267', bandera: '🇧🇼', nombre: 'Botsuana',              digitos:  8 },
  { lada: '+226', bandera: '🇧🇫', nombre: 'Burkina Faso',          digitos:  8 },
  { lada: '+257', bandera: '🇧🇮', nombre: 'Burundi',               digitos:  8 },
  { lada: '+237', bandera: '🇨🇲', nombre: 'Camerún',               digitos:  9 },
  { lada: '+238', bandera: '🇨🇻', nombre: 'Cabo Verde',            digitos:  7 },
  { lada: '+236', bandera: '🇨🇫', nombre: 'Rep. Centroafricana',   digitos:  8 },
  { lada: '+269', bandera: '🇰🇲', nombre: 'Comoras',               digitos:  7 },
  { lada: '+242', bandera: '🇨🇬', nombre: 'Congo',                 digitos:  9 },
  { lada: '+243', bandera: '🇨🇩', nombre: 'RD del Congo',          digitos:  9 },
  { lada: '+253', bandera: '🇩🇯', nombre: 'Yibuti',                digitos:  8 },
  { lada: '+20',  bandera: '🇪🇬', nombre: 'Egipto',                digitos: 10 },
  { lada: '+240', bandera: '🇬🇶', nombre: 'Guinea Ecuatorial',     digitos:  9 },
  { lada: '+291', bandera: '🇪🇷', nombre: 'Eritrea',               digitos:  7 },
  { lada: '+251', bandera: '🇪🇹', nombre: 'Etiopía',               digitos:  9 },
  { lada: '+241', bandera: '🇬🇦', nombre: 'Gabón',                 digitos:  8 },
  { lada: '+220', bandera: '🇬🇲', nombre: 'Gambia',                digitos:  7 },
  { lada: '+233', bandera: '🇬🇭', nombre: 'Ghana',                 digitos:  9 },
  { lada: '+224', bandera: '🇬🇳', nombre: 'Guinea',                digitos:  9 },
  { lada: '+245', bandera: '🇬🇼', nombre: 'Guinea-Bisáu',          digitos:  7 },
  { lada: '+254', bandera: '🇰🇪', nombre: 'Kenia',                 digitos:  9 },
  { lada: '+266', bandera: '🇱🇸', nombre: 'Lesoto',                digitos:  8 },
  { lada: '+231', bandera: '🇱🇷', nombre: 'Liberia',               digitos:  8 },
  { lada: '+218', bandera: '🇱🇾', nombre: 'Libia',                 digitos:  9 },
  { lada: '+261', bandera: '🇲🇬', nombre: 'Madagascar',            digitos:  9 },
  { lada: '+265', bandera: '🇲🇼', nombre: 'Malaui',                digitos:  9 },
  { lada: '+223', bandera: '🇲🇱', nombre: 'Malí',                  digitos:  8 },
  { lada: '+222', bandera: '🇲🇷', nombre: 'Mauritania',            digitos:  8 },
  { lada: '+230', bandera: '🇲🇺', nombre: 'Mauricio',              digitos:  8 },
  { lada: '+212', bandera: '🇲🇦', nombre: 'Marruecos',             digitos:  9 },
  { lada: '+258', bandera: '🇲🇿', nombre: 'Mozambique',            digitos:  9 },
  { lada: '+264', bandera: '🇳🇦', nombre: 'Namibia',               digitos:  9 },
  { lada: '+227', bandera: '🇳🇪', nombre: 'Níger',                 digitos:  8 },
  { lada: '+234', bandera: '🇳🇬', nombre: 'Nigeria',               digitos: 10 },
  { lada: '+250', bandera: '🇷🇼', nombre: 'Ruanda',                digitos:  9 },
  { lada: '+239', bandera: '🇸🇹', nombre: 'Santo Tomé y Príncipe', digitos:  7 },
  { lada: '+221', bandera: '🇸🇳', nombre: 'Senegal',               digitos:  9 },
  { lada: '+232', bandera: '🇸🇱', nombre: 'Sierra Leona',          digitos:  8 },
  { lada: '+252', bandera: '🇸🇴', nombre: 'Somalia',               digitos:  8 },
  { lada: '+249', bandera: '🇸🇩', nombre: 'Sudán',                 digitos:  9 },
  { lada: '+211', bandera: '🇸🇸', nombre: 'Sudán del Sur',         digitos:  9 },
  { lada: '+268', bandera: '🇸🇿', nombre: 'Suazilandia',           digitos:  8 },
  { lada: '+255', bandera: '🇹🇿', nombre: 'Tanzania',              digitos:  9 },
  { lada: '+228', bandera: '🇹🇬', nombre: 'Togo',                  digitos:  8 },
  { lada: '+216', bandera: '🇹🇳', nombre: 'Túnez',                 digitos:  8 },
  { lada: '+256', bandera: '🇺🇬', nombre: 'Uganda',                digitos:  9 },
  { lada: '+260', bandera: '🇿🇲', nombre: 'Zambia',                digitos:  9 },
  { lada: '+263', bandera: '🇿🇼', nombre: 'Zimbabue',              digitos:  9 },
  // ─── Oceanía ──────────────────────────────────────────────────
  { lada: '+61',  bandera: '🇦🇺', nombre: 'Australia',             digitos:  9 },
  { lada: '+679', bandera: '🇫🇯', nombre: 'Fiyi',                  digitos:  7 },
  { lada: '+686', bandera: '🇰🇮', nombre: 'Kiribati',              digitos:  8 },
  { lada: '+692', bandera: '🇲🇭', nombre: 'Islas Marshall',        digitos:  7 },
  { lada: '+691', bandera: '🇫🇲', nombre: 'Micronesia',            digitos:  7 },
  { lada: '+674', bandera: '🇳🇷', nombre: 'Nauru',                 digitos:  7 },
  { lada: '+64',  bandera: '🇳🇿', nombre: 'Nueva Zelanda',         digitos:  9 },
  { lada: '+680', bandera: '🇵🇼', nombre: 'Palaos',                digitos:  7 },
  { lada: '+675', bandera: '🇵🇬', nombre: 'Papua Nueva Guinea',    digitos:  8 },
  { lada: '+685', bandera: '🇼🇸', nombre: 'Samoa',                 digitos:  7 },
  { lada: '+677', bandera: '🇸🇧', nombre: 'Islas Salomón',         digitos:  7 },
  { lada: '+676', bandera: '🇹🇴', nombre: 'Tonga',                 digitos:  7 },
  { lada: '+688', bandera: '🇹🇻', nombre: 'Tuvalu',                digitos:  6 },
  { lada: '+678', bandera: '🇻🇺', nombre: 'Vanuatu',               digitos:  7 },
];
const LADA_DIGITOS: Record<string, number> = Object.fromEntries(LADAS.map(l => [l.lada, l.digitos]));


const ENFERMEDADES_FAMILIARES = [
  'Diabetes', 'Presión alta (Hipertensión)', 'Cáncer',
  'Problemas cardíacos', 'Enfermedades mentales', 'Sordera', 'Otras',
];
const PARIENTES = ['Padre', 'Madre', 'Abuelo', 'Abuela', 'Hijo/a', 'Hermano/a', 'Otro'];
const EXPOSICION_OPCIONES: [string, string][] = [
  ['ruidos', 'Ruidos fuertes'], ['polvos', 'Polvos'],
  ['vapores', 'Vapores'], ['humos', 'Humos'],
  ['riesgoElectrico', 'Riesgo eléctrico'], ['usaEpp', 'Usa EPP'],
];
const ANTECEDENTES_PATOLOGICOS = [
  { condicion: 'Padece o ha padecido alguna enfermedad',  phEsp: 'Ej. Diabetes, hipertensión, asma',           phTiempo: 'Ej. Desde 2015, hace 3 años'      },
  { condicion: '¿Le han realizado alguna cirugía?',        phEsp: 'Ej. Apendicectomía, hernia, rodilla',       phTiempo: 'Ej. Hace 5 años, en 2019'         },
  { condicion: '¿Alguna vez ha convulsionado?',            phEsp: 'Ej. Epilepsia, convulsión febril',           phTiempo: 'Ej. De niño, hace 10 años'        },
  { condicion: '¿Se ha fracturado algún hueso?',           phEsp: 'Ej. Brazo derecho, clavícula, tobillo',     phTiempo: 'Ej. Hace 2 años, en 2020'         },
  { condicion: '¿Usa lentes?',                             phEsp: 'Ej. Miopía, astigmatismo, bifocales',       phTiempo: 'Ej. Desde hace 5 años'            },
  { condicion: '¿Es alérgico a algún medicamento?',        phEsp: 'Ej. Penicilina, ibuprofeno, aspirina',      phTiempo: 'Ej. Desde siempre, hace 2 años'   },
  { condicion: '¿Toma algún medicamento o suplemento?',    phEsp: 'Ej. Metformina 500 mg, vitamina D',         phTiempo: 'Ej. Desde hace 1 año, diariamente' },
  { condicion: 'Enfermedades o accidentes de trabajo',     phEsp: 'Ej. Lumbalgia, sordera, caída en planta',   phTiempo: 'Ej. En 2021, hace 6 meses'        },
];

type Step = 'tipo' | 'buscar' | 'form' | 'done';

const empty = {
  photoUrl: '',
  empresa: '', tipoExamen: '', otroTipo: '', actividades: '',
  nombre: '', edad: '', tipoSangre: '', puestoDeTrabajo: '',
  lada: '+52', celular: '',
  nss: '', fechaNacimiento: '', escolaridad: '', escolaridadEstatus: '', estadoCivil: '',
  lugarNacimientoPais: '🇲🇽 México', lugarNacimientoEstado: '', lugarNacimientoMunicipio: '', correo: '',
  calle: '', numero: '', colonia: '', municipio: '', estado: '', pais: '🇲🇽 México', cp: '',
  practicaDeporte: null as boolean | null, cualDeporte: '', frecuenciaDeporte: '', horasDeporte: '',
  habitosAlimenticios: '', comidasDia: '', consumeFrutasVerduras: '', aguaDia: '',
  calidadSueno: '', horasSueno: '', especifiqueSueno: '',
  fuma: '', edadInicioFuma: '', anosFumando: '', cigarrosDia: '',
  consumeAlcohol: null as boolean | null, tipoBebida: '', cantidadBebidas: '', frecuenciaAlcohol: '',
  consumeDrogas: '',
  drogas: [{ droga: '', estado: '', frecuencia: '', tiempo: '', ultimaVez: '' }],
  esquemaVacunacion: null as boolean | null, dosisAnticovid: '', marcaVacuna: '',
  tieneTatuajes: null as boolean | null, ultimoTatuajeAnios: '', ultimoTatuajeMeses: '', usaAudifonos: null as boolean | null,
  antecedentesFamiliares: ENFERMEDADES_FAMILIARES.map(e => ({
    enfermedad: e, si: null as boolean | null, familiares: [] as string[],
    entradas: [{ especifique: '', familiares: [] as string[] }],
  })),
  edadInicioLaboral: '', trabajoMinas: null as boolean | null, tiempoMinas: '',
  exposiciones: { ruidos: false, polvos: false, vapores: false, humos: false, riesgoElectrico: false, usaEpp: false },
  historialEmpleos: [
    { empresa: '', cargo: '', tiempo: '', exponentes: [] as string[] },
    { empresa: '', cargo: '', tiempo: '', exponentes: [] as string[] },
    { empresa: '', cargo: '', tiempo: '', exponentes: [] as string[] },
  ],
  antecedentesPatologicos: ANTECEDENTES_PATOLOGICOS.map(({ condicion }) => ({ condicion, si: null as boolean | null, entradas: [{ especifique: '', fecha: '' }] })),
};

// ── Pasos del wizard ────────────────────────────────────────────────
const STEP_COLOR = '#3375c8';
const FORM_STEPS = [
  { icon: 'business_center',    label: 'Trabajo',   color: STEP_COLOR },
  { icon: 'person',             label: 'Datos',     color: STEP_COLOR },
  { icon: 'fitness_center',     label: 'Hábitos',   color: STEP_COLOR },
  { icon: 'smoking_rooms',      label: 'Consumo',   color: STEP_COLOR },
  { icon: 'vaccines',           label: 'Salud',     color: STEP_COLOR },
  { icon: 'family_history',     label: 'Familia',   color: STEP_COLOR },
  { icon: 'work',               label: 'Laboral',   color: STEP_COLOR },
  { icon: 'medical_information',label: 'Clínico',   color: STEP_COLOR },
];

// ── Color de paso activo (contexto ligero) ───────────────────────────
const StepColorCtx = createContext('#3375c8');
const useStepColor = () => useContext(StepColorCtx);

// ── Componentes reutilizables ────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5"
      style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
      {children}
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SectionHeader({ icon, title, color }: { icon: string; title: string; color?: string }) {
  const c = color ?? '#3375c8';
  return (
    <div className="flex items-center gap-3 pb-4 mb-1 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${c}20` }}>
        <span className="material-symbols-rounded" style={{ color: c, fontSize: 20 }}>{icon}</span>
      </div>
      <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
    </div>
  );
}

function StepProgress({ current, total, steps, onGoTo }: {
  current: number;
  total: number;
  steps: typeof FORM_STEPS;
  onGoTo: (step: number) => void;
}) {
  return (
    <div className="sticky top-0 z-10 px-4 py-3 border-b"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
      {/* barra de progreso */}
      <div className="w-full h-1 rounded-full mb-3" style={{ background: 'var(--bg-elevated)' }}>
        <div className="h-1 rounded-full transition-all duration-500"
          style={{ width: `${((current - 1) / (total - 1)) * 100}%`, background: steps[current - 1].color }} />
      </div>
      {/* puntos de pasos — clickeables */}
      <div className="flex items-center justify-between">
        {steps.map((s, i) => {
          const done = i + 1 < current;
          const active = i + 1 === current;
          return (
            <button key={i} type="button"
              onClick={() => onGoTo(i + 1)}
              className="flex flex-col items-center gap-1 transition-opacity hover:opacity-80"
              style={{ minWidth: 0, cursor: 'pointer' }}
              title={s.label}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300"
                style={active
                  ? { background: s.color, boxShadow: `0 0 0 3px ${s.color}30` }
                  : done
                    ? { background: s.color, opacity: 0.75 }
                    : { background: 'var(--bg-elevated)', border: '2px solid var(--border-subtle)' }}>
                {done
                  ? <span className="material-symbols-rounded text-white" style={{ fontSize: 14 }}>check</span>
                  : <span className="material-symbols-rounded" style={{ fontSize: 14, color: active ? '#fff' : 'var(--text-muted)' }}>{s.icon}</span>
                }
              </div>
              <span className="text-[9px] font-semibold hidden sm:block transition-all"
                style={{ color: active ? s.color : 'var(--text-muted)' }}>
                {s.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Pills({ options, value, onChange, color: colorProp }: {
  options: { v: string; l: string }[];
  value: string;
  onChange: (v: string) => void;
  color?: string;
}) {
  const color = colorProp ?? useStepColor();
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {options.map(({ v, l }) => {
        const active = value === v;
        return (
          <button key={v} type="button" onClick={() => onChange(v)}
            className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200"
            style={active
              ? { background: color, color: '#fff', boxShadow: `0 2px 10px ${color}45`, transform: 'scale(1.03)' }
              : { background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1.5px solid var(--border-subtle)' }}>
            {l}
          </button>
        );
      })}
    </div>
  );
}

// ── Selector de lada con búsqueda ────────────────────────────────────
function LadaCombobox({ value, onChange }: { value: string; onChange: (lada: string) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);
  const selected = LADAS.find(l => l.lada === value);

  const filtered = query.trim()
    ? LADAS.filter(l =>
        l.lada.includes(query) ||
        l.nombre.toLowerCase().includes(query.toLowerCase())
      )
    : LADAS;

  return (
    <div className="relative" style={{ width: '230px', flexShrink: 0 }}>
      <input
        className="input"
        placeholder="País o código (+52)"
        value={open ? query : (selected ? `${selected.bandera} ${selected.lada} — ${selected.nombre}` : '')}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
      />
      {open && (
        <div
          className="absolute z-50 rounded-xl shadow-2xl border overflow-y-auto"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-subtle)',
            maxHeight: 240,
            width: 300,
            top: '100%',
            left: 0,
            marginTop: 4,
          }}
        >
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>Sin resultados</p>
          )}
          {filtered.map(l => (
            <button
              key={l.lada + l.nombre}
              type="button"
              className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:opacity-80"
              style={l.lada === value
                ? { background: 'rgba(51,117,200,0.12)', color: 'var(--text-primary)' }
                : { color: 'var(--text-primary)' }}
              onMouseDown={() => { onChange(l.lada); setOpen(false); }}
            >
              <span>{l.bandera}</span>
              <span style={{ color: '#3375c8', fontWeight: 600, minWidth: 44 }}>{l.lada}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{l.nombre}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Selector de colonia con búsqueda (igual al de lada) ──────────────
function ColoniaCombobox({ opciones, value, onChange }: {
  opciones: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);

  const filtered = query.trim()
    ? opciones.filter(c => c.toLowerCase().includes(query.toLowerCase()))
    : opciones;

  // Texto visible en el input cuando está cerrado
  const displayValue = open ? query : value;

  return (
    <div className="relative">
      <input
        className="input"
        placeholder={opciones.length ? '— Selecciona tu colonia —' : 'Ej. Centro'}
        value={displayValue}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); }}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
      />
      {/* Ícono de flecha */}
      {!open && (
        <span
          className="material-symbols-rounded absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--text-muted)', fontSize: 18 }}
        >
          expand_more
        </span>
      )}
      {open && (
        <div
          className="absolute z-50 w-full rounded-xl shadow-2xl border overflow-y-auto"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-subtle)',
            maxHeight: 220,
            top: '100%',
            left: 0,
            marginTop: 4,
          }}
        >
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              {opciones.length ? 'Sin coincidencias' : 'Ingresa el CP primero'}
            </p>
          )}
          {filtered.map(c => (
            <button
              key={c}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:opacity-80"
              style={c === value
                ? { background: 'rgba(51,117,200,0.12)', color: 'var(--text-primary)', fontWeight: 600 }
                : { color: 'var(--text-primary)' }}
              onMouseDown={() => { onChange(c); setOpen(false); setQuery(''); }}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchSelect({ options, value, onChange, placeholder }: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen]   = useState(false);

  const filtered = query.trim()
    ? options.filter(o => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div className="relative">
      <input
        className="input"
        placeholder={placeholder ?? '— Seleccionar —'}
        value={open ? query : value}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
      />
      <span className="material-symbols-rounded absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: 'var(--text-muted)', fontSize: 18 }}>
        {open ? 'expand_less' : 'expand_more'}
      </span>
      {open && (
        <div className="absolute z-50 w-full rounded-xl shadow-2xl border overflow-y-auto"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)', maxHeight: 220, top: '100%', left: 0, marginTop: 4 }}>
          {filtered.length === 0
            ? <p className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>Sin coincidencias</p>
            : filtered.map(o => (
              <button key={o} type="button"
                className="w-full text-left px-3 py-2 text-sm hover:opacity-80"
                style={o === value
                  ? { background: 'rgba(51,117,200,0.12)', color: 'var(--text-primary)', fontWeight: 600 }
                  : { color: 'var(--text-primary)' }}
                onMouseDown={() => { onChange(o); setOpen(false); setQuery(''); }}
              >
                {o}
              </button>
            ))
          }
        </div>
      )}
    </div>
  );
}

function ParientesMultiSelect({ selected, onToggle }: {
  selected: string[];
  onToggle: (p: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="input w-full flex items-center flex-wrap gap-1.5 text-left cursor-pointer"
        style={{ height: 'auto', minHeight: 40, paddingTop: 6, paddingBottom: 6 }}
      >
        {selected.length === 0
          ? <span className="text-sm" style={{ color: 'var(--text-muted)' }}>— Seleccionar familiar(es) —</span>
          : selected.map(p => (
            <span key={p} className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: '#3375c8', color: '#fff' }}>
              {p}
              <span className="material-symbols-rounded" style={{ fontSize: 13 }}
                onClick={e => { e.stopPropagation(); onToggle(p); }}>close</span>
            </span>
          ))
        }
        <span className="material-symbols-rounded ml-auto shrink-0" style={{ color: 'var(--text-muted)', fontSize: 18 }}>
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 w-full rounded-xl shadow-2xl border overflow-hidden"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)', top: '100%', left: 0, marginTop: 4 }}>
            {PARIENTES.map(p => {
              const sel = selected.includes(p);
              return (
                <button key={p} type="button"
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors"
                  style={{ background: sel ? 'rgba(51,117,200,0.1)' : 'transparent', color: sel ? '#3375c8' : 'var(--text-primary)' }}
                  onMouseDown={e => { e.preventDefault(); onToggle(p); }}
                >
                  <span className="material-symbols-rounded shrink-0" style={{ fontSize: 18, color: sel ? '#3375c8' : 'var(--text-muted)' }}>
                    {sel ? 'check_box' : 'check_box_outline_blank'}
                  </span>
                  {p}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function BoolPills({ value, onChange, color: colorProp }: { value: boolean | null; onChange: (v: boolean) => void; color?: string }) {
  const color = colorProp ?? useStepColor();
  const opts: { v: boolean; l: string; icon: string }[] = [
    { v: true,  l: 'Sí', icon: 'check' },
    { v: false, l: 'No', icon: 'close' },
  ];
  return (
    <div className="flex gap-2 mt-1">
      {opts.map(({ v, l, icon }) => {
        const active = value === v;
        const bg = active ? (v ? color : '#ef4444') : undefined;
        return (
          <button key={String(v)} type="button" onClick={() => onChange(v)}
            className="flex items-center gap-1.5 px-5 py-1.5 rounded-full text-sm font-semibold transition-all duration-200"
            style={active
              ? { background: bg, color: '#fff', boxShadow: `0 2px 10px ${bg}50`, transform: 'scale(1.03)' }
              : { background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1.5px solid var(--border-subtle)' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 15 }}>{icon}</span>
            {l}
          </button>
        );
      })}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────

export default function SurveyFlow({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('tipo');
  const [formStep, setFormStep] = useState(1);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [empresaBusqueda, setEmpresaBusqueda] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<any[]>([]);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [cpLoading, setCpLoading] = useState(false);
  const [coloniaOpciones, setColoniaOpciones] = useState<string[]>([]);
  const cpCache = useRef<Map<string, { colonias: string[]; municipio: string; estado: string }>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [municipiosDB, setMunicipiosDB] = useState<MunicipiosDB | null>(null);

  useEffect(() => {
    api.get('/public/companies').then(r => setCompanies(r.data)).catch(() => {});
    loadMunicipiosDB().then(db => setMunicipiosDB(db));
  }, []);

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const buscarCP = async (cp: string, pais = form.pais) => {
    const clean = cp.trim();
    const esMexico = pais.includes('México');
    const minLen = esMexico ? 5 : 3;
    if (clean.length < minLen) return;

    const cacheKey = `${pais}:${clean}`;
    if (cpCache.current.has(cacheKey)) {
      const cached = cpCache.current.get(cacheKey)!;
      setColoniaOpciones(cached.colonias);
      setForm(f => ({ ...f, municipio: cached.municipio, estado: cached.estado, colonia: '' }));
      return;
    }

    setCpLoading(true);
    let resultado: { colonias: string[]; municipio: string; estado: string } | null = null;

    if (esMexico) {
      // ── 1. JSON local SEPOMEX — offline, instantáneo ──
      try {
        const local = await loadSepomex();
        if (local?.[clean]) {
          const d = local[clean];
          resultado = { municipio: d.m, estado: d.e, colonias: d.c };
        }
      } catch { /* siguiente */ }

      // ── 2. cp.terio.dev — CORS nativo, datos SEPOMEX reales ──
      if (!resultado) {
        try {
          const r = await fetch(`https://cp.terio.dev/v1/codigos-postales/${clean}`, { signal: AbortSignal.timeout(8000) });
          if (r.ok) {
            const data = await r.json();
            const items: any[] = data.datos ?? [];
            if (items.length) {
              resultado = {
                municipio: items[0].municipio ?? '',
                estado:    items[0].estado    ?? '',
                colonias:  [...new Set<string>(items.map((i: any) => i.asentamiento).filter(Boolean))],
              };
            }
          }
        } catch { /* siguiente */ }
      }
    }

    // ── zippopotam.us — CP internacionales (y fallback México) ──
    if (!resultado) {
      const code = ZIPPO_CODES[pais];
      if (code) {
        try {
          const r = await fetch(`https://api.zippopotam.us/${code}/${clean}`, { signal: AbortSignal.timeout(8000) });
          if (r.ok) {
            const data = await r.json();
            const places: any[] = data.places ?? [];
            if (places.length) {
              resultado = {
                municipio: places[0]['place name'] ?? '',
                estado:    places[0].state         ?? '',
                colonias:  [...new Set<string>(places.map((p: any) => p['place name']).filter(Boolean))],
              };
            }
          }
        } catch { /* fallo silencioso */ }
      }
    }

    if (resultado) {
      cpCache.current.set(cacheKey, resultado);
      setColoniaOpciones(resultado.colonias);
      setForm(f => ({ ...f, municipio: resultado!.municipio, estado: resultado!.estado, colonia: '' }));
    }

    setCpLoading(false);
  };

  const buscar = async (q: string, company: string) => {
    if (!company || !q.trim()) { setResultados([]); return; }
    const { data } = await api.get('/patients', { params: { q, company } });
    setResultados(data);
  };

  useEffect(() => {
    const t = setTimeout(() => buscar(busqueda, empresaBusqueda), 300);
    return () => clearTimeout(t);
  }, [busqueda, empresaBusqueda]);

  const seleccionarPaciente = (p: any) => {
    setPatientId(p.id);
    setForm(f => ({ ...f, nombre: p.fullName, celular: p.phone || '', correo: p.email || '', nss: p.nss || '' }));
    setStep('form');
  };

  const guardar = async () => {
    if (!form.nombre.trim()) { toast.error('El nombre es requerido'); return; }
    setSaving(true);
    try {
      const { lada, estado, pais, municipio, celular, drogas, ultimoTatuajeAnios, ultimoTatuajeMeses, escolaridadEstatus, lugarNacimientoPais, lugarNacimientoEstado, lugarNacimientoMunicipio, ...rest } = form;
      const payload = {
        ...rest,
        patientId,
        celular: [lada, celular].filter(Boolean).join(' '),
        municipio: [municipio, estado, pais].filter(Boolean).join(', '),
        cualDroga:       drogas.filter(d => d.droga.trim()).map(d => d.estado ? `${d.droga}|${d.estado}` : d.droga).join(', '),
        frecuenciaDroga: drogas.map(d => d.frecuencia).filter(Boolean).join(', '),
        tiempoDroga:     drogas.map(d => d.tiempo).filter(Boolean).join(', '),
        ultimaVezDroga:  drogas.map(d => d.ultimaVez).filter(Boolean).join(', '),
        ultimoTatuaje:   [ultimoTatuajeAnios && `${ultimoTatuajeAnios} años`, ultimoTatuajeMeses && `${ultimoTatuajeMeses} meses`].filter(Boolean).join(' '),
        escolaridad:     [rest.escolaridad, escolaridadEstatus].filter(Boolean).join(' — '),
        lugarNacimiento: [lugarNacimientoMunicipio, lugarNacimientoEstado, lugarNacimientoPais].filter(Boolean).join(', '),
      };
      await api.post('/surveys', payload);
      setStep('done');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // ── Pantalla de éxito ──────────────────────────────────────────────
  if (step === 'done') return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto"
        style={{ background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)' }}>
        <span className="material-symbols-rounded text-green-600" style={{ fontSize: 52 }}>check_circle</span>
      </div>
      <div>
        <h2 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>¡Encuesta completada!</h2>
        <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>
          Tus datos han sido guardados. El personal te indicará los siguientes pasos.
        </p>
      </div>
      <button onClick={onClose} className="btn btn-primary px-10 py-3 text-base">Finalizar</button>
    </div>
  );

  // ── Selección nuevo / ya registrado ───────────────────────────────
  if (step === 'tipo') return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3"
          style={{ background: 'linear-gradient(135deg, #3375c8, #51abcd)' }}>
          <span className="material-symbols-rounded text-white" style={{ fontSize: 32 }}>person_search</span>
        </div>
        <h2 className="text-xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          ¿Eres paciente nuevo o ya registrado?
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Selecciona una opción para continuar</p>
      </div>
      <div className="flex gap-4">
        {[
          { label: 'Paciente nuevo', icon: 'person_add', color: '#3375c8', bg: 'rgba(51,117,200,0.1)', action: () => { setPatientId(null); setStep('form'); } },
          { label: 'Ya registrado', icon: 'manage_search', color: '#51abcd', bg: 'rgba(81,171,205,0.1)', action: () => setStep('buscar') },
        ].map(({ label, icon, color, bg, action }) => (
          <button key={label} onClick={action}
            className="card flex flex-col items-center gap-3 p-8 hover:shadow-lg transition cursor-pointer w-44"
            style={{ border: '2px solid var(--border-subtle)' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: bg }}>
              <span className="material-symbols-rounded text-3xl" style={{ color }}>{icon}</span>
            </div>
            <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  // ── Búsqueda de paciente existente ────────────────────────────────
  if (step === 'buscar') return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(51,117,200,0.12)' }}>
            <span className="material-symbols-rounded" style={{ color: '#3375c8', fontSize: 22 }}>manage_search</span>
          </div>
          <div>
            <h2 className="text-lg font-extrabold leading-tight" style={{ color: 'var(--text-primary)' }}>Buscar paciente</h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Selecciona tu empresa y escribe tu nombre o celular</p>
          </div>
        </div>
        {/* Empresa */}
        <select
          className="input text-base mb-3"
          style={{ borderRadius: 14, fontSize: 15 }}
          value={empresaBusqueda}
          onChange={e => { setEmpresaBusqueda(e.target.value); setBusqueda(''); setResultados([]); }}
        >
          <option value="">— Selecciona tu empresa —</option>
          <option value={SIN_EMPRESA}>— Sin empresa / Particular —</option>
          {companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        {/* Input */}
        <div className="relative">
          <span className="material-symbols-rounded absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#3375c8', fontSize: 20 }}>search</span>
          <input
            className="input pl-11 text-base"
            style={{ borderRadius: 14, fontSize: 15, padding: '11px 14px 11px 42px' }}
            placeholder="Ej. Juan García o 811 234 5678"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            disabled={!empresaBusqueda}
            autoFocus
          />
          {busqueda && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2"
              onClick={() => setBusqueda('')}
              style={{ color: 'var(--text-muted)' }}>
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>close</span>
            </button>
          )}
        </div>
      </div>

      {/* Resultados */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {resultados.length > 0 && (
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
            {resultados.length} resultado{resultados.length !== 1 ? 's' : ''}
          </p>
        )}

        {resultados.map(p => (
          <button key={p.id} onClick={() => seleccionarPaciente(p)}
            className="w-full text-left rounded-2xl px-4 py-3.5 flex items-center gap-4 transition-all duration-150"
            style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-subtle)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3375c8'; e.currentTarget.style.background = 'rgba(51,117,200,0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-card)'; }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm text-white"
              style={{ background: '#3375c8' }}>
              {p.fullName?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate" style={{ color: 'var(--text-primary)', fontSize: 14 }}>{p.fullName}</div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {p.phone && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 13 }}>phone</span>
                    {p.phone}
                  </span>
                )}
                {p.nss && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 13 }}>badge</span>
                    {p.nss}
                  </span>
                )}
                {p.company && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 13 }}>business</span>
                    {p.company}
                  </span>
                )}
              </div>
            </div>
            <span className="material-symbols-rounded shrink-0" style={{ color: '#3375c8', fontSize: 20 }}>chevron_right</span>
          </button>
        ))}

        {!empresaBusqueda && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(51,117,200,0.08)' }}>
              <span className="material-symbols-rounded" style={{ color: '#3375c8', fontSize: 32 }}>business</span>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Selecciona tu empresa para poder buscar</p>
          </div>
        )}

        {empresaBusqueda && resultados.length === 0 && busqueda.trim() && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--bg-elevated)' }}>
              <span className="material-symbols-rounded" style={{ color: 'var(--text-muted)', fontSize: 32 }}>person_search</span>
            </div>
            <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Sin resultados</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              No se encontró "{busqueda}" {empresaBusqueda === SIN_EMPRESA ? 'entre los pacientes particulares' : `en ${empresaBusqueda}`}
            </p>
          </div>
        )}

        {empresaBusqueda && !busqueda.trim() && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(51,117,200,0.08)' }}>
              <span className="material-symbols-rounded" style={{ color: '#3375c8', fontSize: 32 }}>search</span>
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Empieza a escribir para buscar</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <button
          onClick={() => { setPatientId(null); setBusqueda(''); setResultados([]); setStep('form'); }}
          className="btn btn-secondary w-full flex items-center justify-center gap-2">
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>person_add</span>
          Registrar como paciente nuevo
        </button>
      </div>
    </div>
  );

  // ── Formulario completo ───────────────────────────────────────────
  const af = form.antecedentesFamiliares;
  const ap = form.antecedentesPatologicos;

  const stepColor = FORM_STEPS[formStep - 1].color;

  return (
    <StepColorCtx.Provider value={stepColor}>
    <div className="flex-1 flex flex-col overflow-hidden">
      <StepProgress current={formStep} total={FORM_STEPS.length} steps={FORM_STEPS}
        onGoTo={n => { setFormStep(n); scrollRef.current?.scrollTo(0, 0); }} />

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
      <div className="p-4 md:p-6 space-y-5 pb-6">

        {/* ── PASO 1: Trabajo ─────────────────────────────── */}
        {formStep === 1 && <section className="card space-y-4">
          <SectionHeader icon="business_center" title="Información general" color={FORM_STEPS[0].color} />

          <Field label="Empresa">
            <select className="input" value={form.empresa} onChange={e => set('empresa', e.target.value)}>
              <option value="">— Selecciona tu empresa —</option>
              <option value="Sin empresa">Sin empresa</option>
              {companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </Field>

          <div>
            <Label>Tipo de examen</Label>
            <Pills
              options={[{ v: 'Ingreso', l: 'Ingreso' }, { v: 'Periódico', l: 'Periódico' }, { v: 'Otro', l: 'Otro' }]}
              value={form.tipoExamen}
              onChange={v => set('tipoExamen', v)}
            />
          </div>

          {form.tipoExamen === 'Otro' && (
            <Field label="Especifique el tipo de examen">
              <input className="input" value={form.otroTipo} onChange={e => set('otroTipo', e.target.value)} />
            </Field>
          )}

          <Field label="Actividades en el puesto de trabajo">
            <textarea className="input" rows={2}
              placeholder="Actividades que realiza o realizará en su puesto de trabajo"
              value={form.actividades} onChange={e => set('actividades', e.target.value)} />
          </Field>
        </section>}

        {/* ── PASO 2: Datos personales ─────────────────────── */}
        {formStep === 2 && <section className="card space-y-4">
          <SectionHeader icon="person" title="Datos personales" color={FORM_STEPS[1].color} />

          <PatientPhotoCapture value={form.photoUrl} onChange={url => set('photoUrl', url)} allowUpload={false} />

          <Field label="Nombre completo *">
            <input className="input" required placeholder="Ej. Juan Pérez García"
              value={form.nombre} onChange={e => set('nombre', e.target.value)} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Edad">
              <input className="input" type="number" min="0" max="120" placeholder="Ej. 32"
                value={form.edad} readOnly={!!form.fechaNacimiento}
                style={form.fechaNacimiento ? { background: 'var(--bg-elevated)', cursor: 'not-allowed' } : undefined}
                title={form.fechaNacimiento ? 'Se calcula a partir de la fecha de nacimiento' : undefined}
                onChange={e => set('edad', e.target.value)} />
            </Field>
            <Field label="Tipo de sangre">
              <select className="input" value={form.tipoSangre} onChange={e => set('tipoSangre', e.target.value)}>
                <option value="">— Seleccionar —</option>
                {BLOOD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Puesto de trabajo">
            <input className="input" placeholder="Ej. Operador de montacargas"
              value={form.puestoDeTrabajo} onChange={e => set('puestoDeTrabajo', e.target.value)} />
          </Field>

          <Field label={`Número de celular (${LADA_DIGITOS[form.lada] ?? 10} dígitos)`}>
            <div className="flex gap-2">
              <LadaCombobox
                value={form.lada}
                onChange={lada => { set('lada', lada); set('celular', ''); }}
              />
              <input
                className="input flex-1"
                type="tel"
                placeholder={`Ej. ${form.lada === '+52' ? '8112345678' : '000 000 0000'}`}
                maxLength={LADA_DIGITOS[form.lada] ?? 10}
                value={form.celular}
                onChange={e => set('celular', e.target.value.replace(/\D/g, '').slice(0, LADA_DIGITOS[form.lada] ?? 10))}
              />
            </div>
          </Field>

          <Field label="NSS — Número de seguro social">
            <input
              className="input"
              type="tel"
              maxLength={11}
              placeholder="Ej. 12345678901 (11 dígitos)"
              value={form.nss}
              onChange={e => set('nss', e.target.value.replace(/\D/g, '').slice(0, 11))} />
          </Field>

          <Field label="Fecha de nacimiento">
            <input className="input" type="date"
              value={form.fechaNacimiento}
              onChange={e => {
                const fecha = e.target.value;
                setForm(f => ({ ...f, fechaNacimiento: fecha, edad: fecha ? calcularEdad(fecha) : f.edad }));
              }} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Field label="Escolaridad">
                <select className="input" value={form.escolaridad}
                  onChange={e => { set('escolaridad', e.target.value); set('escolaridadEstatus', ''); }}>
                  <option value="">— Seleccionar —</option>
                  {ESCOLARIDADES.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </Field>
              {form.escolaridad && form.escolaridad !== 'Sin estudios' && (
                <Field label="Estatus">
                  <select className="input" value={form.escolaridadEstatus} onChange={e => set('escolaridadEstatus', e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    <option value="Completa">Completa</option>
                    <option value="Trunca">Trunca</option>
                    <option value="En curso">En curso</option>
                    <option value="Pasante">Pasante</option>
                    <option value="Titulado/a">Titulado/a</option>
                  </select>
                </Field>
              )}
            </div>
            <Field label="Estado civil">
              <select className="input" value={form.estadoCivil} onChange={e => set('estadoCivil', e.target.value)}>
                <option value="">— Seleccionar —</option>
                {ESTADOS_CIVILES.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </Field>
          </div>

          <div>
            <Label>Lugar de nacimiento</Label>
            <div className="grid grid-cols-3 gap-3">
              <Field label="País">
                <SearchSelect
                  options={PAISES}
                  value={form.lugarNacimientoPais}
                  placeholder="— Seleccionar país —"
                  onChange={v => {
                    set('lugarNacimientoPais', v);
                    set('lugarNacimientoEstado', '');
                    set('lugarNacimientoMunicipio', '');
                  }}
                />
              </Field>
              <Field label="Estado">
                {form.lugarNacimientoPais.includes('México')
                  ? <SearchSelect
                      options={municipiosDB ? Object.keys(municipiosDB).sort() : ESTADOS_MEXICO}
                      value={form.lugarNacimientoEstado}
                      placeholder="— Seleccionar estado —"
                      onChange={v => { set('lugarNacimientoEstado', v); set('lugarNacimientoMunicipio', ''); }}
                    />
                  : <input className="input" placeholder="Ej. California"
                      value={form.lugarNacimientoEstado} onChange={e => set('lugarNacimientoEstado', e.target.value)} />
                }
              </Field>
              <Field label="Municipio / Ciudad">
                {(() => {
                  const muns = form.lugarNacimientoPais.includes('México')
                    ? (municipiosDB?.[form.lugarNacimientoEstado] ?? MUNICIPIOS_MEXICO[form.lugarNacimientoEstado])
                    : null;
                  return muns
                    ? <SearchSelect
                        options={muns}
                        value={form.lugarNacimientoMunicipio}
                        placeholder="— Seleccionar municipio —"
                        onChange={v => set('lugarNacimientoMunicipio', v)}
                      />
                    : <input className="input" placeholder="Ej. Monterrey"
                        value={form.lugarNacimientoMunicipio} onChange={e => set('lugarNacimientoMunicipio', e.target.value)} />;
                })()}
              </Field>
            </div>
          </div>

          <Field label="Correo electrónico">
            <input className="input" type="email" placeholder="Ej. juan.perez@correo.com"
              value={form.correo} onChange={e => set('correo', e.target.value)} />
          </Field>

          {/* Domicilio */}
          <div className="pt-2 space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Domicilio actual
            </p>

            {/* CP — auto-rellena municipio, estado y colonias al llegar a 5 dígitos */}
            <Field label="Código postal">
              <div className="relative">
                <input
                  className="input"
                  type="tel"
                  maxLength={form.pais.includes('México') ? 5 : 10}
                  placeholder={form.pais.includes('México') ? 'Ej. 64000' : form.pais.includes('Estados Unidos') ? 'Ej. 90210' : 'Código postal'}
                  value={form.cp}
                  onChange={e => {
                    const esMx = form.pais.includes('México');
                    const v = esMx
                      ? e.target.value.replace(/\D/g, '').slice(0, 5)
                      : e.target.value.replace(/\s/g, '').slice(0, 10);
                    setForm(f => ({ ...f, cp: v, municipio: '', estado: '', colonia: '' }));
                    setColoniaOpciones([]);
                    const minLen = esMx ? 5 : 3;
                    if (v.length >= minLen) buscarCP(v, form.pais);
                  }} />
                {cpLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-rounded animate-spin text-[20px]"
                    style={{ color: '#3375c8' }}>progress_activity</span>
                )}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Calle">
                <input className="input" placeholder="Ej. Av. Constitución"
                  value={form.calle} onChange={e => set('calle', e.target.value)} />
              </Field>
              <Field label="Número exterior">
                <input className="input" placeholder="Ej. 245 o S/N"
                  value={form.numero} onChange={e => set('numero', e.target.value)} />
              </Field>
            </div>

            <Field label="Colonia">
              <ColoniaCombobox
                opciones={coloniaOpciones}
                value={form.colonia}
                onChange={v => set('colonia', v)}
              />
            </Field>

            <Field label="Municipio / Alcaldía">
              <input className="input" placeholder="Ej. Monterrey"
                value={form.municipio} onChange={e => set('municipio', e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Estado">
                <input className="input" placeholder="Ej. Nuevo León"
                  value={form.estado} onChange={e => set('estado', e.target.value)} />
              </Field>
              <Field label="País">
                <SearchSelect
                  options={PAISES}
                  value={form.pais}
                  placeholder="— Seleccionar país —"
                  onChange={v => {
                    setForm(f => ({ ...f, pais: v, cp: '', municipio: '', estado: '', colonia: '' }));
                    setColoniaOpciones([]);
                  }} />
              </Field>
            </div>
          </div>
        </section>}

        {/* ── PASO 3: Hábitos ──────────────────────────────── */}
        {formStep === 3 && <section className="card space-y-5">
          <SectionHeader icon="fitness_center" title="Hábitos de vida" color={FORM_STEPS[2].color} />

          {/* ── Actividad física ── */}
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Actividad física
          </p>

          <div>
            <Label>¿Practica deporte o actividad física?</Label>
            <BoolPills value={form.practicaDeporte} onChange={v => set('practicaDeporte', v)} />
          </div>

          {form.practicaDeporte && (
            <div className="space-y-4">
              <Field label="¿Qué actividad física practica?">
                <input className="input" placeholder="Ej. Correr, natación, fútbol, gimnasio"
                  value={form.cualDeporte} onChange={e => set('cualDeporte', e.target.value)} />
              </Field>
              <div>
                <Label>Frecuencia</Label>
                <Pills
                  options={[
                    { v: 'Diario', l: 'Diario' },
                    { v: '3-4 veces/sem', l: '3-4×/semana' },
                    { v: '1-2 veces/sem', l: '1-2×/semana' },
                    { v: 'Fines de semana', l: 'Fines de semana' },
                  ]}
                  value={form.frecuenciaDeporte}
                  onChange={v => set('frecuenciaDeporte', v)}
                />
              </div>
              <Field label="Horas por semana">
                <input className="input" placeholder="Ej. 5" type="tel"
                  value={form.horasDeporte} onChange={e => set('horasDeporte', e.target.value.replace(/\D/g, ''))} />
              </Field>
            </div>
          )}

          {/* ── Alimentación ── */}
          <p className="text-[11px] font-semibold uppercase tracking-wide pt-1" style={{ color: 'var(--text-muted)' }}>
            Alimentación
          </p>

          <div>
            <Label>¿Cómo calificarías tu alimentación?</Label>
            <Pills
              options={[{ v: 'Bueno', l: 'Buena' }, { v: 'Regular', l: 'Regular' }, { v: 'Malo', l: 'Mala' }]}
              value={form.habitosAlimenticios}
              onChange={v => set('habitosAlimenticios', v)}
            />
          </div>

          <div>
            <Label>Número de comidas al día</Label>
            <Pills
              options={[
                { v: '1-2', l: '1-2 comidas' },
                { v: '3', l: '3 comidas' },
                { v: '4-5', l: '4-5 comidas' },
                { v: 'Más de 5', l: 'Más de 5' },
              ]}
              value={form.comidasDia}
              onChange={v => set('comidasDia', v)}
            />
          </div>

          <div>
            <Label>¿Con qué frecuencia consumes frutas y verduras?</Label>
            <Pills
              options={[
                { v: 'Diario', l: 'Diario' },
                { v: 'Frecuente', l: 'Frecuente' },
                { v: 'Poco', l: 'Poco' },
                { v: 'Nunca', l: 'Nunca' },
              ]}
              value={form.consumeFrutasVerduras}
              onChange={v => set('consumeFrutasVerduras', v)}
            />
          </div>

          <div>
            <Label>Consumo de agua al día</Label>
            <Pills
              options={[
                { v: 'Menos de 1L', l: 'Menos de 1 L' },
                { v: '1-2L', l: '1-2 litros' },
                { v: '2-3L', l: '2-3 litros' },
                { v: 'Más de 3L', l: 'Más de 3 L' },
              ]}
              value={form.aguaDia}
              onChange={v => set('aguaDia', v)}
            />
          </div>

          {/* ── Sueño ── */}
          <p className="text-[11px] font-semibold uppercase tracking-wide pt-1" style={{ color: 'var(--text-muted)' }}>
            Sueño
          </p>

          <div>
            <Label>Calidad de sueño</Label>
            <Pills
              options={[{ v: 'Bueno', l: 'Buena' }, { v: 'Regular', l: 'Regular' }, { v: 'Malo', l: 'Mala' }]}
              value={form.calidadSueno}
              onChange={v => set('calidadSueno', v)}
            />
          </div>

          <div>
            <Label>Horas de sueño por noche</Label>
            <Pills
              options={[
                { v: 'Menos de 5h', l: 'Menos de 5 h' },
                { v: '5-6h', l: '5-6 horas' },
                { v: '7-8h', l: '7-8 horas' },
                { v: 'Más de 8h', l: 'Más de 8 h' },
              ]}
              value={form.horasSueno}
              onChange={v => set('horasSueno', v)}
            />
          </div>

          {(form.calidadSueno === 'Malo' || form.calidadSueno === 'Regular') && (
            <Field label="¿Por qué? (insomnio, estrés, ronquidos…)">
              <input className="input" placeholder="Ej. Insomnio, me desvelo con el celular, ronco"
                value={form.especifiqueSueno} onChange={e => set('especifiqueSueno', e.target.value)} />
            </Field>
          )}
        </section>}

        {/* ── PASO 4: Consumo ───────────────────────────────── */}
        {formStep === 4 && <section className="card space-y-5">
          <SectionHeader icon="smoking_rooms" title="Hábitos de consumo" color={FORM_STEPS[3].color} />

          <div className="grid grid-cols-3 gap-6">

            {/* ── Tabaquismo ── */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Tabaquismo
              </p>
              <div>
                <Label>¿Usted fuma?</Label>
                <Pills
                  options={[{ v: 'SI', l: 'Sí' }, { v: 'NO', l: 'No' }, { v: 'EXFUMADOR', l: 'Ex fumador/a' }]}
                  value={form.fuma}
                  onChange={v => set('fuma', v)}
                />
              </div>
              {(form.fuma === 'SI' || form.fuma === 'EXFUMADOR') && (
                <div className="space-y-3">
                  <Field label="Edad de inicio">
                    <input className="input" placeholder="Ej. 18"
                      value={form.edadInicioFuma} onChange={e => set('edadInicioFuma', e.target.value)} />
                  </Field>
                  <Field label="Años fumando">
                    <input className="input" placeholder="Ej. 5"
                      value={form.anosFumando} onChange={e => set('anosFumando', e.target.value)} />
                  </Field>
                  <Field label="Cigarros / día">
                    <input className="input" placeholder="Ej. 10"
                      value={form.cigarrosDia} onChange={e => set('cigarrosDia', e.target.value)} />
                  </Field>
                </div>
              )}
            </div>

            {/* ── Alcohol ── */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Alcohol
              </p>
              <div>
                <Label>¿Consume bebidas alcohólicas?</Label>
                <BoolPills value={form.consumeAlcohol} onChange={v => set('consumeAlcohol', v)} />
              </div>
              {form.consumeAlcohol && (
                <div className="space-y-3">
                  <Field label="¿Qué tipo de bebida?">
                    <input className="input" placeholder="Ej. Cerveza, vino, whisky"
                      value={form.tipoBebida} onChange={e => set('tipoBebida', e.target.value)} />
                  </Field>
                  <Field label="¿Cuántas bebidas?">
                    <input className="input" placeholder="Ej. 3 al día"
                      value={form.cantidadBebidas} onChange={e => set('cantidadBebidas', e.target.value)} />
                  </Field>
                  <Field label="Frecuencia">
                    <select className="input" value={form.frecuenciaAlcohol} onChange={e => set('frecuenciaAlcohol', e.target.value)}>
                      <option value="">— Seleccionar —</option>
                      {FRECUENCIAS_ALCOHOL.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </Field>
                </div>
              )}
            </div>

            {/* ── Drogas ── */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Drogas
              </p>
              <div>
                <Label>¿Consume o ha consumido drogas?</Label>
                <Pills
                  options={[
                    { v: 'NO_NUNCA', l: 'No, nunca' },
                    { v: 'SI', l: 'Sí' },
                  ]}
                  value={form.consumeDrogas}
                  onChange={v => set('consumeDrogas', v)}
                />
              </div>
              {form.consumeDrogas === 'SI' && (
                <div className="space-y-3">
                  {form.drogas.map((d, i) => (
                    <div key={i} className="space-y-2 rounded-lg p-2" style={{ background: 'var(--bg-subtle, rgba(0,0,0,.04))' }}>
                      {form.drogas.length > 1 && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                            Droga {i + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => setForm(f => ({ ...f, drogas: f.drogas.filter((_, j) => j !== i) }))}
                            className="flex items-center gap-1 text-xs px-1 rounded"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>delete</span>
                          </button>
                        </div>
                      )}
                      <Field label="¿Cuál droga?">
                        <input className="input" placeholder="Ej. Marihuana, cocaína"
                          value={d.droga}
                          onChange={e => setForm(f => ({ ...f, drogas: f.drogas.map((x, j) => j === i ? { ...x, droga: e.target.value } : x) }))} />
                      </Field>
                      <Field label="¿Sí consume o consumió antes?">
                        <Pills
                          options={[{ v: 'SI_CONSUMO', l: 'Sí, consumo' }, { v: 'CONSUMI', l: 'Consumí antes' }]}
                          value={d.estado}
                          onChange={v => setForm(f => ({ ...f, drogas: f.drogas.map((x, j) => j === i ? { ...x, estado: v } : x) }))} />
                      </Field>
                      <Field label="Frecuencia">
                        <select className="input"
                          value={d.frecuencia}
                          onChange={e => setForm(f => ({ ...f, drogas: f.drogas.map((x, j) => j === i ? { ...x, frecuencia: e.target.value } : x) }))}>
                          <option value="">— Seleccionar —</option>
                          {['Diario', 'Semanal', 'Quincenal', 'Mensual', 'Ocasional'].map(o => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="¿Cuánto tiempo?">
                        <input className="input" placeholder="Ej. 2 años"
                          value={d.tiempo}
                          onChange={e => setForm(f => ({ ...f, drogas: f.drogas.map((x, j) => j === i ? { ...x, tiempo: e.target.value } : x) }))} />
                      </Field>
                      <Field label="Última vez">
                        <input className="input" placeholder="Ej. Hace 6 meses"
                          value={d.ultimaVez}
                          onChange={e => setForm(f => ({ ...f, drogas: f.drogas.map((x, j) => j === i ? { ...x, ultimaVez: e.target.value } : x) }))} />
                      </Field>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, drogas: [...f.drogas, { droga: '', estado: '', frecuencia: '', tiempo: '', ultimaVez: '' }] }))}
                    className="btn w-full text-xs flex items-center justify-center gap-1"
                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: 16 }}>add</span>
                    Agregar otra droga
                  </button>
                </div>
              )}
            </div>

          </div>
        </section>}

        {/* ── PASO 5: Salud ─────────────────────────────────── */}
        {formStep === 5 && <section className="card space-y-4">
          <SectionHeader icon="vaccines" title="Vacunación y otros" color={FORM_STEPS[4].color} />

          <div>
            <Label>¿Esquema de vacunación completo?</Label>
            <BoolPills value={form.esquemaVacunacion} onChange={v => set('esquemaVacunacion', v)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="N° de dosis anticovid">
              <select className="input" value={form.dosisAnticovid} onChange={e => {
                const val = e.target.value;
                setForm(f => ({
                  ...f,
                  dosisAnticovid: val,
                  marcaVacuna: val === '0' ? 'No vacunado' : (f.marcaVacuna === 'No vacunado' ? '' : f.marcaVacuna),
                }));
              }}>
                <option value="">— Seleccionar —</option>
                {['0', '1', '2', '3', '4', '5 o más'].map(d => <option key={d} value={d}>{d === '0' ? '0 (sin dosis)' : d}</option>)}
              </select>
            </Field>
            <Field label="Marca de vacuna COVID-19">
              <select className="input" value={form.marcaVacuna} onChange={e => {
                const val = e.target.value;
                setForm(f => ({
                  ...f,
                  marcaVacuna: val,
                  dosisAnticovid: val === 'No vacunado' ? '0' : (f.dosisAnticovid === '0' ? '' : f.dosisAnticovid),
                }));
              }}>
                <option value="">— Seleccionar —</option>
                <option value="Pfizer-BioNTech (Comirnaty)">Pfizer-BioNTech (Comirnaty)</option>
                <option value="Moderna (Spikevax)">Moderna (Spikevax)</option>
                <option value="AstraZeneca (Vaxzevria)">AstraZeneca (Vaxzevria)</option>
                <option value="Johnson & Johnson (Janssen)">Johnson &amp; Johnson (Janssen)</option>
                <option value="Sputnik V">Sputnik V</option>
                <option value="Sinovac (CoronaVac)">Sinovac (CoronaVac)</option>
                <option value="Sinopharm (BBIBP-CorV)">Sinopharm (BBIBP-CorV)</option>
                <option value="CanSino (Convidecia)">CanSino (Convidecia)</option>
                <option value="Abdala">Abdala</option>
                <option value="Covaxin (Bharat Biotech)">Covaxin (Bharat Biotech)</option>
                <option value="Novavax (Nuvaxovid)">Novavax (Nuvaxovid)</option>
                <option value="No recuerdo">No recuerdo</option>
                <option value="No vacunado">No vacunado</option>
              </select>
            </Field>
          </div>

          <div>
            <Label>¿Tiene tatuajes?</Label>
            <BoolPills value={form.tieneTatuajes} onChange={v => set('tieneTatuajes', v)} />
          </div>
          {form.tieneTatuajes && (
            <div>
              <Label>¿Cuándo fue el más reciente?</Label>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Años">
                  <input className="input" type="tel" placeholder="Ej. 2"
                    value={form.ultimoTatuajeAnios}
                    onChange={e => set('ultimoTatuajeAnios', e.target.value.replace(/\D/g, ''))} />
                </Field>
                <Field label="Meses">
                  <input className="input" type="tel" placeholder="Ej. 6"
                    value={form.ultimoTatuajeMeses}
                    onChange={e => set('ultimoTatuajeMeses', e.target.value.replace(/\D/g, ''))} />
                </Field>
              </div>
            </div>
          )}

          <div>
            <Label>¿Usa audífonos con frecuencia para escuchar música?</Label>
            <BoolPills value={form.usaAudifonos} onChange={v => set('usaAudifonos', v)} />
          </div>
        </section>}

        {/* ── PASO 6: Antecedentes familiares ──────────────── */}
        {formStep === 6 && <section className="card space-y-4">
          <SectionHeader icon="family_history" title="Antecedentes familiares" color={FORM_STEPS[5].color} />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            ¿Algún familiar directo padece o ha padecido alguna de estas enfermedades? Selecciona quién.
          </p>
          <div className="space-y-1">
            {af.map((item, i) => {
              const isOtras = item.enfermedad === 'Otras';
              return (
                <div key={i} className="py-3 border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                  <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>{item.enfermedad}</p>
                  <div className="space-y-2">
                    <BoolPills value={item.si} onChange={v => {
                      const next = [...af]; next[i] = { ...next[i], si: v };
                      set('antecedentesFamiliares', next);
                    }} />
                    {item.si && !isOtras && (
                      <div className="pt-1">
                        <ParientesMultiSelect
                          selected={item.familiares}
                          onToggle={p => {
                            const next = [...af];
                            const fams = item.familiares.includes(p)
                              ? item.familiares.filter(f => f !== p)
                              : [...item.familiares, p];
                            next[i] = { ...next[i], familiares: fams };
                            set('antecedentesFamiliares', next);
                          }}
                        />
                      </div>
                    )}
                    {item.si && isOtras && (
                      <div className="pt-1 space-y-3">
                        {item.entradas.map((entrada, ei) => (
                          <div key={ei} className="space-y-2 rounded-lg p-2" style={{ background: 'var(--bg-subtle, rgba(0,0,0,.04))' }}>
                            <div className="flex items-end gap-2">
                              <div className="flex-1">
                                <Field label="Especifique">
                                  <input className="input" placeholder="Ej. Asma, artritis"
                                    value={entrada.especifique}
                                    onChange={e => {
                                      const next = [...af];
                                      const entradas = [...item.entradas];
                                      entradas[ei] = { ...entradas[ei], especifique: e.target.value };
                                      next[i] = { ...next[i], entradas };
                                      set('antecedentesFamiliares', next);
                                    }} />
                                </Field>
                              </div>
                              {item.entradas.length > 1 && (
                                <button type="button"
                                  onClick={() => {
                                    const next = [...af];
                                    next[i] = { ...next[i], entradas: item.entradas.filter((_, j) => j !== ei) };
                                    set('antecedentesFamiliares', next);
                                  }}
                                  className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 mb-0.5"
                                  style={{ color: 'var(--text-muted)' }}>
                                  <span className="material-symbols-rounded" style={{ fontSize: 18 }}>delete</span>
                                </button>
                              )}
                            </div>
                            <ParientesMultiSelect
                              selected={entrada.familiares}
                              onToggle={p => {
                                const next = [...af];
                                const entradas = [...item.entradas];
                                const fams = entrada.familiares.includes(p)
                                  ? entrada.familiares.filter(f => f !== p)
                                  : [...entrada.familiares, p];
                                entradas[ei] = { ...entradas[ei], familiares: fams };
                                next[i] = { ...next[i], entradas };
                                set('antecedentesFamiliares', next);
                              }}
                            />
                          </div>
                        ))}
                        <button type="button"
                          onClick={() => {
                            const next = [...af];
                            next[i] = { ...next[i], entradas: [...item.entradas, { especifique: '', familiares: [] }] };
                            set('antecedentesFamiliares', next);
                          }}
                          className="flex items-center gap-1 text-xs px-3 py-1 rounded-lg font-semibold"
                          style={{ background: `${stepColor}18`, color: stepColor }}>
                          <span className="material-symbols-rounded" style={{ fontSize: 15 }}>add</span>
                          Añadir
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>}

        {/* ── PASO 7: Laboral ───────────────────────────────── */}
        {formStep === 7 && <section className="card space-y-4">
          <SectionHeader icon="work" title="Antecedentes laborales" color={FORM_STEPS[6].color} />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Edad de inicio laboral">
              <input className="input"
                value={form.edadInicioLaboral} onChange={e => set('edadInicioLaboral', e.target.value)} />
            </Field>
            <div>
              <Label>¿Ha trabajado en minas?</Label>
              <BoolPills value={form.trabajoMinas} onChange={v => set('trabajoMinas', v)} />
            </div>
          </div>
          {form.trabajoMinas && (
            <Field label="¿Cuánto tiempo trabajó en minas?">
              <input className="input" placeholder="Ej. 3 años, 6 meses"
                value={form.tiempoMinas} onChange={e => set('tiempoMinas', e.target.value)} />
            </Field>
          )}

          <div>
            <Label>Ha estado expuesto a:</Label>
            <div className="flex flex-wrap gap-2">
              {EXPOSICION_OPCIONES.map(([k, l]) => (
                <button key={k} type="button"
                  onClick={() => set('exposiciones', { ...form.exposiciones, [k]: !(form.exposiciones as any)[k] })}
                  className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                  style={(form.exposiciones as any)[k]
                    ? { background: stepColor, color: '#fff', boxShadow: `0 2px 8px ${stepColor}50` }
                    : { background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                  {l}
                </button>
              ))}
              {(() => {
                const ninguno = !Object.values(form.exposiciones).some(Boolean);
                return (
                  <button type="button"
                    onClick={() => set('exposiciones', { ruidos: false, polvos: false, vapores: false, humos: false, riesgoElectrico: false, usaEpp: false })}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                    style={ninguno
                      ? { background: stepColor, color: '#fff', boxShadow: `0 2px 8px ${stepColor}50` }
                      : { background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                    Ninguno
                  </button>
                );
              })()}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Historial de empleos (actual primero)</Label>
              <button type="button"
                onClick={() => set('historialEmpleos', [...form.historialEmpleos, { empresa: '', cargo: '', tiempo: '', exponentes: [] as string[] }])}
                className="flex items-center gap-1 text-xs px-3 py-1 rounded-lg font-semibold transition"
                style={{ background: `${stepColor}18`, color: stepColor }}>
                <span className="material-symbols-rounded" style={{ fontSize: 15 }}>add</span>
                Agregar empleo
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {['#', 'Empresa', 'Cargo / Puesto', 'Tiempo', 'Exposiciones', ''].map(h => (
                      <th key={h} className="text-left pb-2 text-[10px] font-semibold uppercase tracking-wide pr-2"
                        style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {form.historialEmpleos.map((emp, i) => (
                    <tr key={i}>
                      <td className="pr-2 pb-2 text-sm" style={{ color: 'var(--text-muted)' }}>{i + 1}.</td>
                      {(['empresa', 'cargo', 'tiempo'] as const).map(col => (
                        <td key={col} className="pr-2 pb-2">
                          <input className="input text-sm" value={(emp as any)[col]}
                            onChange={e => {
                              const next = [...form.historialEmpleos];
                              next[i] = { ...next[i], [col]: e.target.value };
                              set('historialEmpleos', next);
                            }} />
                        </td>
                      ))}
                      <td className="pr-2 pb-2" style={{ minWidth: 180 }}>
                        <div className="flex flex-wrap gap-1">
                          {EXPOSICION_OPCIONES.filter(([k, l]) => (form.exposiciones as any)[k] || (emp.exponentes || []).includes(l)).map(([k, l]) => {
                            const seleccionado = (emp.exponentes || []).includes(l);
                            return (
                              <button key={k} type="button"
                                onClick={() => {
                                  const next = [...form.historialEmpleos];
                                  const actuales = next[i].exponentes || [];
                                  next[i] = {
                                    ...next[i],
                                    exponentes: seleccionado ? actuales.filter(x => x !== l) : [...actuales, l],
                                  };
                                  set('historialEmpleos', next);
                                }}
                                className="px-2 py-1 rounded-lg text-[11px] font-semibold transition"
                                style={seleccionado
                                  ? { background: stepColor, color: '#fff' }
                                  : { background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                                {l}
                              </button>
                            );
                          })}
                          {EXPOSICION_OPCIONES.every(([k]) => !(form.exposiciones as any)[k]) && (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              Selecciona arriba "Ha estado expuesto a"
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="pb-2">
                        {form.historialEmpleos.length > 1 && (
                          <button type="button"
                            onClick={() => set('historialEmpleos', form.historialEmpleos.filter((_, j) => j !== i))}
                            className="flex items-center justify-center w-8 h-8 rounded-lg transition"
                            style={{ color: 'var(--text-muted)' }}>
                            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>delete</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>}

        {/* ── PASO 8: Patológicos ───────────────────────────── */}
        {formStep === 8 && <section className="card space-y-4">
          <SectionHeader icon="medical_information" title="Antecedentes patológicos" color={FORM_STEPS[7].color} />
          <div className="space-y-1">
            {ap.map((item, i) => {
              const meta = ANTECEDENTES_PATOLOGICOS[i];
              const updateEntrada = (ei: number, field: 'especifique' | 'fecha', val: string) => {
                const next = [...ap];
                const entradas = [...item.entradas];
                entradas[ei] = { ...entradas[ei], [field]: val };
                next[i] = { ...next[i], entradas };
                set('antecedentesPatologicos', next);
              };
              return (
                <div key={i} className="py-3 border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                  <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>{item.condicion}</p>
                  <BoolPills value={item.si} onChange={v => {
                    const next = [...ap]; next[i] = { ...next[i], si: v };
                    set('antecedentesPatologicos', next);
                  }} />
                  {item.si && (
                    <div className="mt-2 space-y-2">
                      {item.entradas.map((entrada, ei) => (
                        <div key={ei} className="grid grid-cols-2 gap-3 items-end">
                          <Field label="Especifique">
                            <input className="input" placeholder={meta.phEsp}
                              value={entrada.especifique}
                              onChange={e => updateEntrada(ei, 'especifique', e.target.value)} />
                          </Field>
                          <div className="flex gap-2 items-end">
                            <div className="flex-1">
                              <Field label="¿Hace cuánto tiempo?">
                                <input className="input" placeholder={meta.phTiempo}
                                  value={entrada.fecha}
                                  onChange={e => updateEntrada(ei, 'fecha', e.target.value)} />
                              </Field>
                            </div>
                            {item.entradas.length > 1 && (
                              <button type="button"
                                onClick={() => {
                                  const next = [...ap];
                                  next[i] = { ...next[i], entradas: item.entradas.filter((_, j) => j !== ei) };
                                  set('antecedentesPatologicos', next);
                                }}
                                className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 mb-0.5"
                                style={{ color: 'var(--text-muted)' }}>
                                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      <button type="button"
                        onClick={() => {
                          const next = [...ap];
                          next[i] = { ...next[i], entradas: [...item.entradas, { especifique: '', fecha: '' }] };
                          set('antecedentesPatologicos', next);
                        }}
                        className="flex items-center gap-1 text-xs px-3 py-1 rounded-lg font-semibold"
                        style={{ background: `${stepColor}18`, color: stepColor }}>
                        <span className="material-symbols-rounded" style={{ fontSize: 15 }}>add</span>
                        Agregar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>}

        {/* ── Navegación entre pasos ────────────────────────── */}
        <div className="flex items-center justify-between pt-2 pb-2">
          <button
            onClick={() => formStep > 1 ? setFormStep(s => s - 1) : onClose()}
            className="btn btn-secondary flex items-center gap-2">
            <span className="material-symbols-rounded text-[18px]">
              {formStep > 1 ? 'arrow_back' : 'close'}
            </span>
            {formStep > 1 ? 'Anterior' : 'Cancelar'}
          </button>

          <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            {formStep} / {FORM_STEPS.length}
          </span>

          {formStep < FORM_STEPS.length ? (
            <button
              onClick={() => { setFormStep(s => s + 1); scrollRef.current?.scrollTo(0, 0); }}
              className="btn flex items-center gap-2 text-white"
              style={{ background: stepColor, boxShadow: `0 2px 12px ${stepColor}50` }}>
              Siguiente
              <span className="material-symbols-rounded text-[18px]">arrow_forward</span>
            </button>
          ) : (
            <button onClick={guardar} disabled={saving}
              className="btn flex items-center gap-2"
              style={{ background: stepColor, color: '#fff', boxShadow: `0 2px 12px ${stepColor}50`, opacity: saving ? 0.7 : 1 }}>
              <span className="material-symbols-rounded text-[18px]">save</span>
              {saving ? 'Guardando…' : 'Guardar encuesta'}
            </button>
          )}
        </div>

      </div>
      </div>
    </div>
    </StepColorCtx.Provider>
  );
}
