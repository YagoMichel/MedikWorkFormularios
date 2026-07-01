import { useState, useEffect, useRef, createContext, useContext } from 'react';
import toast from 'react-hot-toast';

// ── SEPOMEX loader ────────────────────────────────────────────────────
type SepomexRow = { e: string; m: string; c: string[] };
let _sepomexP: Promise<Record<string, SepomexRow> | null> | null = null;
function loadSepomex() {
  if (!_sepomexP) {
    _sepomexP = fetch('/sepomex-cp.json').then(r => r.ok ? r.json() as Promise<Record<string, SepomexRow>> : null).catch(() => null);
  }
  return _sepomexP;
}
type MunicipiosDB = Record<string, string[]>;
let _municipiosP: Promise<MunicipiosDB | null> | null = null;
function loadMunicipiosDB(): Promise<MunicipiosDB | null> {
  if (!_municipiosP) {
    _municipiosP = loadSepomex().then(data => {
      if (!data) return null;
      const db: MunicipiosDB = {};
      for (const row of Object.values(data)) {
        const e = row.e?.trim(); const m = row.m?.trim();
        if (!e || !m) continue;
        if (!db[e]) db[e] = [];
        if (!db[e].includes(m)) db[e].push(m);
      }
      for (const k of Object.keys(db)) db[k].sort();
      return db;
    });
  }
  return _municipiosP;
}

// ── Constantes ────────────────────────────────────────────────────────
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'No sé'];
const ESCOLARIDADES = ['Sin estudios','Primaria','Secundaria','Preparatoria / Bachillerato','Técnico / Tecnológico','Licenciatura','Maestría','Doctorado'];
const ESTADOS_CIVILES = ['Soltero/a','Casado/a','Unión libre','Divorciado/a','Viudo/a','Separado/a'];
const FRECUENCIAS_ALCOHOL = ['Todos los días','Cada fin de semana','Cada 15 días','Cada mes','1 o 2 veces al año'];

const PAISES_DATA: { label: string; iso: string }[] = [
  { label: '🇲🇽 México', iso: 'mx' }, { label: '🇺🇸 Estados Unidos', iso: 'us' }, { label: '🇨🇦 Canadá', iso: 'ca' },
  { label: '🇬🇹 Guatemala', iso: 'gt' }, { label: '🇧🇿 Belice', iso: 'bz' }, { label: '🇭🇳 Honduras', iso: 'hn' },
  { label: '🇸🇻 El Salvador', iso: 'sv' }, { label: '🇳🇮 Nicaragua', iso: 'ni' }, { label: '🇨🇷 Costa Rica', iso: 'cr' },
  { label: '🇵🇦 Panamá', iso: 'pa' }, { label: '🇨🇺 Cuba', iso: 'cu' }, { label: '🇯🇲 Jamaica', iso: 'jm' },
  { label: '🇭🇹 Haití', iso: 'ht' }, { label: '🇩🇴 República Dominicana', iso: 'do' }, { label: '🇵🇷 Puerto Rico', iso: 'pr' },
  { label: '🇹🇹 Trinidad y Tobago', iso: 'tt' }, { label: '🇧🇧 Barbados', iso: 'bb' }, { label: '🇧🇸 Bahamas', iso: 'bs' },
  { label: '🇦🇬 Antigua y Barbuda', iso: 'ag' }, { label: '🇩🇲 Dominica', iso: 'dm' }, { label: '🇬🇩 Granada', iso: 'gd' },
  { label: '🇰🇳 San Cristóbal y Nieves', iso: 'kn' }, { label: '🇱🇨 Santa Lucía', iso: 'lc' },
  { label: '🇻🇨 San Vicente y las Granadinas', iso: 'vc' }, { label: '🇻🇪 Venezuela', iso: 've' },
  { label: '🇨🇴 Colombia', iso: 'co' }, { label: '🇪🇨 Ecuador', iso: 'ec' }, { label: '🇵🇪 Perú', iso: 'pe' },
  { label: '🇧🇴 Bolivia', iso: 'bo' }, { label: '🇨🇱 Chile', iso: 'cl' }, { label: '🇦🇷 Argentina', iso: 'ar' },
  { label: '🇺🇾 Uruguay', iso: 'uy' }, { label: '🇵🇾 Paraguay', iso: 'py' }, { label: '🇧🇷 Brasil', iso: 'br' },
  { label: '🇬🇾 Guyana', iso: 'gy' }, { label: '🇸🇷 Surinam', iso: 'sr' }, { label: '🇪🇸 España', iso: 'es' },
  { label: '🇫🇷 Francia', iso: 'fr' }, { label: '🇩🇪 Alemania', iso: 'de' }, { label: '🇮🇹 Italia', iso: 'it' },
  { label: '🇬🇧 Reino Unido', iso: 'gb' }, { label: '🇵🇹 Portugal', iso: 'pt' }, { label: '🇳🇱 Países Bajos', iso: 'nl' },
  { label: '🇧🇪 Bélgica', iso: 'be' }, { label: '🇨🇭 Suiza', iso: 'ch' }, { label: '🇦🇹 Austria', iso: 'at' },
  { label: '🇮🇪 Irlanda', iso: 'ie' }, { label: '🇮🇸 Islandia', iso: 'is' }, { label: '🇱🇺 Luxemburgo', iso: 'lu' },
  { label: '🇲🇨 Mónaco', iso: 'mc' }, { label: '🇸🇲 San Marino', iso: 'sm' }, { label: '🇦🇩 Andorra', iso: 'ad' },
  { label: '🇲🇹 Malta', iso: 'mt' }, { label: '🇱🇮 Liechtenstein', iso: 'li' }, { label: '🇸🇪 Suecia', iso: 'se' },
  { label: '🇳🇴 Noruega', iso: 'no' }, { label: '🇩🇰 Dinamarca', iso: 'dk' }, { label: '🇫🇮 Finlandia', iso: 'fi' },
  { label: '🇱🇹 Lituania', iso: 'lt' }, { label: '🇱🇻 Letonia', iso: 'lv' }, { label: '🇪🇪 Estonia', iso: 'ee' },
  { label: '🇵🇱 Polonia', iso: 'pl' }, { label: '🇷🇺 Rusia', iso: 'ru' }, { label: '🇺🇦 Ucrania', iso: 'ua' },
  { label: '🇧🇾 Bielorrusia', iso: 'by' }, { label: '🇲🇩 Moldavia', iso: 'md' }, { label: '🇷🇴 Rumanía', iso: 'ro' },
  { label: '🇧🇬 Bulgaria', iso: 'bg' }, { label: '🇨🇿 República Checa', iso: 'cz' }, { label: '🇸🇰 Eslovaquia', iso: 'sk' },
  { label: '🇭🇺 Hungría', iso: 'hu' }, { label: '🇬🇷 Grecia', iso: 'gr' }, { label: '🇨🇾 Chipre', iso: 'cy' },
  { label: '🇷🇸 Serbia', iso: 'rs' }, { label: '🇭🇷 Croacia', iso: 'hr' }, { label: '🇸🇮 Eslovenia', iso: 'si' },
  { label: '🇧🇦 Bosnia y Herzegovina', iso: 'ba' }, { label: '🇲🇰 Macedonia del Norte', iso: 'mk' },
  { label: '🇦🇱 Albania', iso: 'al' }, { label: '🇲🇪 Montenegro', iso: 'me' }, { label: '🇬🇪 Georgia', iso: 'ge' },
  { label: '🇦🇲 Armenia', iso: 'am' }, { label: '🇦🇿 Azerbaiyán', iso: 'az' }, { label: '🇹🇷 Turquía', iso: 'tr' },
  { label: '🇮🇱 Israel', iso: 'il' }, { label: '🇯🇴 Jordania', iso: 'jo' }, { label: '🇱🇧 Líbano', iso: 'lb' },
  { label: '🇸🇾 Siria', iso: 'sy' }, { label: '🇮🇶 Irak', iso: 'iq' }, { label: '🇮🇷 Irán', iso: 'ir' },
  { label: '🇸🇦 Arabia Saudita', iso: 'sa' }, { label: '🇦🇪 Emiratos Árabes Unidos', iso: 'ae' },
  { label: '🇶🇦 Catar', iso: 'qa' }, { label: '🇰🇼 Kuwait', iso: 'kw' }, { label: '🇧🇭 Baréin', iso: 'bh' },
  { label: '🇴🇲 Omán', iso: 'om' }, { label: '🇾🇪 Yemen', iso: 'ye' }, { label: '🇵🇸 Palestina', iso: 'ps' },
  { label: '🇪🇬 Egipto', iso: 'eg' }, { label: '🇱🇾 Libia', iso: 'ly' }, { label: '🇹🇳 Túnez', iso: 'tn' },
  { label: '🇩🇿 Argelia', iso: 'dz' }, { label: '🇲🇦 Marruecos', iso: 'ma' }, { label: '🇳🇬 Nigeria', iso: 'ng' },
  { label: '🇿🇦 Sudáfrica', iso: 'za' }, { label: '🇰🇪 Kenia', iso: 'ke' }, { label: '🇪🇹 Etiopía', iso: 'et' },
  { label: '🇬🇭 Ghana', iso: 'gh' }, { label: '🇹🇿 Tanzania', iso: 'tz' }, { label: '🇺🇬 Uganda', iso: 'ug' },
  { label: '🇷🇼 Ruanda', iso: 'rw' }, { label: '🇸🇳 Senegal', iso: 'sn' }, { label: '🇨🇮 Costa de Marfil', iso: 'ci' },
  { label: '🇨🇲 Camerún', iso: 'cm' }, { label: '🇲🇿 Mozambique', iso: 'mz' }, { label: '🇦🇴 Angola', iso: 'ao' },
  { label: '🇿🇲 Zambia', iso: 'zm' }, { label: '🇿🇼 Zimbabue', iso: 'zw' }, { label: '🇲🇬 Madagascar', iso: 'mg' },
  { label: '🇳🇦 Namibia', iso: 'na' }, { label: '🇸🇩 Sudán', iso: 'sd' }, { label: '🇸🇸 Sudán del Sur', iso: 'ss' },
  { label: '🇰🇿 Kazajistán', iso: 'kz' }, { label: '🇺🇿 Uzbekistán', iso: 'uz' }, { label: '🇮🇳 India', iso: 'in' },
  { label: '🇵🇰 Pakistán', iso: 'pk' }, { label: '🇧🇩 Bangladés', iso: 'bd' }, { label: '🇱🇰 Sri Lanka', iso: 'lk' },
  { label: '🇳🇵 Nepal', iso: 'np' }, { label: '🇨🇳 China', iso: 'cn' }, { label: '🇯🇵 Japón', iso: 'jp' },
  { label: '🇰🇷 Corea del Sur', iso: 'kr' }, { label: '🇹🇼 Taiwán', iso: 'tw' }, { label: '🇻🇳 Vietnam', iso: 'vn' },
  { label: '🇹🇭 Tailandia', iso: 'th' }, { label: '🇲🇾 Malasia', iso: 'my' }, { label: '🇸🇬 Singapur', iso: 'sg' },
  { label: '🇮🇩 Indonesia', iso: 'id' }, { label: '🇵🇭 Filipinas', iso: 'ph' }, { label: '🇲🇲 Myanmar', iso: 'mm' },
  { label: '🇦🇺 Australia', iso: 'au' }, { label: '🇳🇿 Nueva Zelanda', iso: 'nz' }, { label: '🇫🇯 Fiyi', iso: 'fj' },
];
const PAISES = PAISES_DATA.map(p => p.label);
const ZIPPO_CODES = Object.fromEntries(PAISES_DATA.map(p => [p.label, p.iso]));

const LADAS = [
  { lada: '+52', bandera: '🇲🇽', nombre: 'México', digitos: 10 },
  { lada: '+54', bandera: '🇦🇷', nombre: 'Argentina', digitos: 10 },
  { lada: '+55', bandera: '🇧🇷', nombre: 'Brasil', digitos: 11 },
  { lada: '+56', bandera: '🇨🇱', nombre: 'Chile', digitos: 9 },
  { lada: '+57', bandera: '🇨🇴', nombre: 'Colombia', digitos: 10 },
  { lada: '+506', bandera: '🇨🇷', nombre: 'Costa Rica', digitos: 8 },
  { lada: '+53', bandera: '🇨🇺', nombre: 'Cuba', digitos: 8 },
  { lada: '+593', bandera: '🇪🇨', nombre: 'Ecuador', digitos: 9 },
  { lada: '+503', bandera: '🇸🇻', nombre: 'El Salvador', digitos: 8 },
  { lada: '+502', bandera: '🇬🇹', nombre: 'Guatemala', digitos: 8 },
  { lada: '+504', bandera: '🇭🇳', nombre: 'Honduras', digitos: 8 },
  { lada: '+505', bandera: '🇳🇮', nombre: 'Nicaragua', digitos: 8 },
  { lada: '+507', bandera: '🇵🇦', nombre: 'Panamá', digitos: 8 },
  { lada: '+595', bandera: '🇵🇾', nombre: 'Paraguay', digitos: 9 },
  { lada: '+51', bandera: '🇵🇪', nombre: 'Perú', digitos: 9 },
  { lada: '+598', bandera: '🇺🇾', nombre: 'Uruguay', digitos: 9 },
  { lada: '+58', bandera: '🇻🇪', nombre: 'Venezuela', digitos: 10 },
  { lada: '+1', bandera: '🇺🇸', nombre: 'EE. UU. / Canadá', digitos: 10 },
  { lada: '+49', bandera: '🇩🇪', nombre: 'Alemania', digitos: 11 },
  { lada: '+43', bandera: '🇦🇹', nombre: 'Austria', digitos: 10 },
  { lada: '+32', bandera: '🇧🇪', nombre: 'Bélgica', digitos: 9 },
  { lada: '+34', bandera: '🇪🇸', nombre: 'España', digitos: 9 },
  { lada: '+33', bandera: '🇫🇷', nombre: 'Francia', digitos: 9 },
  { lada: '+39', bandera: '🇮🇹', nombre: 'Italia', digitos: 10 },
  { lada: '+31', bandera: '🇳🇱', nombre: 'Países Bajos', digitos: 9 },
  { lada: '+48', bandera: '🇵🇱', nombre: 'Polonia', digitos: 9 },
  { lada: '+351', bandera: '🇵🇹', nombre: 'Portugal', digitos: 9 },
  { lada: '+7', bandera: '🇷🇺', nombre: 'Rusia', digitos: 10 },
  { lada: '+46', bandera: '🇸🇪', nombre: 'Suecia', digitos: 9 },
  { lada: '+41', bandera: '🇨🇭', nombre: 'Suiza', digitos: 9 },
  { lada: '+380', bandera: '🇺🇦', nombre: 'Ucrania', digitos: 9 },
  { lada: '+44', bandera: '🇬🇧', nombre: 'Reino Unido', digitos: 10 },
  { lada: '+966', bandera: '🇸🇦', nombre: 'Arabia Saudita', digitos: 9 },
  { lada: '+86', bandera: '🇨🇳', nombre: 'China', digitos: 11 },
  { lada: '+82', bandera: '🇰🇷', nombre: 'Corea del Sur', digitos: 10 },
  { lada: '+971', bandera: '🇦🇪', nombre: 'Emiratos Árabes', digitos: 9 },
  { lada: '+63', bandera: '🇵🇭', nombre: 'Filipinas', digitos: 10 },
  { lada: '+91', bandera: '🇮🇳', nombre: 'India', digitos: 10 },
  { lada: '+62', bandera: '🇮🇩', nombre: 'Indonesia', digitos: 11 },
  { lada: '+81', bandera: '🇯🇵', nombre: 'Japón', digitos: 10 },
  { lada: '+60', bandera: '🇲🇾', nombre: 'Malasia', digitos: 9 },
  { lada: '+65', bandera: '🇸🇬', nombre: 'Singapur', digitos: 8 },
  { lada: '+66', bandera: '🇹🇭', nombre: 'Tailandia', digitos: 9 },
  { lada: '+90', bandera: '🇹🇷', nombre: 'Turquía', digitos: 10 },
  { lada: '+84', bandera: '🇻🇳', nombre: 'Vietnam', digitos: 10 },
  { lada: '+27', bandera: '🇿🇦', nombre: 'Sudáfrica', digitos: 9 },
  { lada: '+61', bandera: '🇦🇺', nombre: 'Australia', digitos: 9 },
  { lada: '+64', bandera: '🇳🇿', nombre: 'Nueva Zelanda', digitos: 9 },
];
const LADA_DIGITOS: Record<string, number> = Object.fromEntries(LADAS.map(l => [l.lada, l.digitos]));

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
  'Jalisco': ['Guadalajara','Lagos de Moreno','Puerto Vallarta','San Pedro Tlaquepaque','Tepatitlán de Morelos','Tlajomulco de Zúñiga','Tonalá','Zapopan','Zapotlán el Grande'],
  'Michoacán de Ocampo': ['Apatzingán','Lázaro Cárdenas','Morelia','Uruapan','Zamora','Zitácuaro'],
  'Morelos': ['Cuernavaca','Cuautla','Jiutepec','Temixco','Xochitepec','Yautepec de Zaragoza'],
  'Nayarit': ['Bahía de Banderas','Compostela','Santiago Ixcuintla','Tepic','Xalisco'],
  'Nuevo León': ['Apodaca','Cadereyta Jiménez','García','General Escobedo','Guadalupe','Juárez','Linares','Monterrey','San Nicolás de los Garza','San Pedro Garza García','Santa Catarina'],
  'Oaxaca': ['Huajuapan de León','Juchitán de Zaragoza','Oaxaca de Juárez','Puerto Escondido','Salina Cruz','Tehuantepec','Tuxtepec'],
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

const ENFERMEDADES_FAMILIARES = ['Diabetes','Presión alta (Hipertensión)','Cáncer','Problemas cardíacos','Enfermedades mentales','Sordera','Otras'];
const PARIENTES = ['Padre','Madre','Abuelo','Abuela','Hijo/a','Hermano/a','Otro'];
const ANTECEDENTES_PATOLOGICOS = [
  { condicion: 'Padece o ha padecido alguna enfermedad', phEsp: 'Ej. Diabetes, hipertensión, asma', phTiempo: 'Ej. Desde 2015, hace 3 años' },
  { condicion: '¿Le han realizado alguna cirugía?', phEsp: 'Ej. Apendicectomía, hernia, rodilla', phTiempo: 'Ej. Hace 5 años, en 2019' },
  { condicion: '¿Alguna vez ha convulsionado?', phEsp: 'Ej. Epilepsia, convulsión febril', phTiempo: 'Ej. De niño, hace 10 años' },
  { condicion: '¿Se ha fracturado algún hueso?', phEsp: 'Ej. Brazo derecho, clavícula, tobillo', phTiempo: 'Ej. Hace 2 años, en 2020' },
  { condicion: '¿Usa lentes?', phEsp: 'Ej. Miopía, astigmatismo, bifocales', phTiempo: 'Ej. Desde hace 5 años' },
  { condicion: '¿Es alérgico a algún medicamento?', phEsp: 'Ej. Penicilina, ibuprofeno, aspirina', phTiempo: 'Ej. Desde siempre, hace 2 años' },
  { condicion: '¿Toma algún medicamento o suplemento?', phEsp: 'Ej. Metformina 500 mg, vitamina D', phTiempo: 'Ej. Desde hace 1 año, diariamente' },
  { condicion: 'Enfermedades o accidentes de trabajo', phEsp: 'Ej. Lumbalgia, sordera, caída en planta', phTiempo: 'Ej. En 2021, hace 6 meses' },
];

const STEP_COLOR = '#3375c8';
const FORM_STEPS = [
  { icon: 'business_center',     label: 'Trabajo',  color: STEP_COLOR },
  { icon: 'person',              label: 'Datos',    color: STEP_COLOR },
  { icon: 'fitness_center',      label: 'Hábitos',  color: STEP_COLOR },
  { icon: 'smoking_rooms',       label: 'Consumo',  color: STEP_COLOR },
  { icon: 'vaccines',            label: 'Salud',    color: STEP_COLOR },
  { icon: 'family_history',      label: 'Familia',  color: STEP_COLOR },
  { icon: 'work',                label: 'Laboral',  color: STEP_COLOR },
  { icon: 'medical_information', label: 'Clínico',  color: STEP_COLOR },
];

// ── Estado vacío del formulario ───────────────────────────────────────
const empty = {
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
  drogas: [{ droga: '', frecuencia: '', tiempo: '', ultimaVez: '' }],
  esquemaVacunacion: null as boolean | null, dosisAnticovid: '', marcaVacuna: '',
  tieneTatuajes: null as boolean | null, ultimoTatuajeAnios: '', ultimoTatuajeMeses: '', usaAudifonos: null as boolean | null,
  antecedentesFamiliares: ENFERMEDADES_FAMILIARES.map(e => ({ enfermedad: e, si: null as boolean | null, familiares: [] as string[] })),
  edadInicioLaboral: '', trabajoMinas: null as boolean | null, tiempoMinas: '',
  exposiciones: { ruidos: false, polvos: false, vapores: false, humos: false, riesgoElectrico: false, usaEpp: false },
  historialEmpleos: [{ empresa: '', cargo: '', tiempo: '', exponentes: '' }],
  antecedentesPatologicos: ANTECEDENTES_PATOLOGICOS.map(({ condicion }) => ({ condicion, si: null as boolean | null, entradas: [{ especifique: '', fecha: '' }] })),
};

// ── Inicializar form desde encuesta guardada ──────────────────────────
function buildFormFromSurvey(survey: any): typeof empty {
  const f: typeof empty = {
    ...empty,
    drogas: [{ droga: '', frecuencia: '', tiempo: '', ultimaVez: '' }],
    exposiciones: { ...empty.exposiciones },
    antecedentesFamiliares: ENFERMEDADES_FAMILIARES.map(e => ({ enfermedad: e, si: null, familiares: [] })),
    antecedentesPatologicos: ANTECEDENTES_PATOLOGICOS.map(({ condicion }) => ({ condicion, si: null, entradas: [{ especifique: '', fecha: '' }] })),
    historialEmpleos: [{ empresa: '', cargo: '', tiempo: '', exponentes: '' }],
  };
  if (!survey) return f;

  // Campos simples
  const simple: (keyof typeof empty)[] = [
    'empresa','tipoExamen','otroTipo','actividades','nombre','tipoSangre','puestoDeTrabajo',
    'nss','fechaNacimiento','estadoCivil','correo','calle','numero','colonia','cp',
    'cualDeporte','frecuenciaDeporte','horasDeporte','habitosAlimenticios','comidasDia',
    'consumeFrutasVerduras','aguaDia','calidadSueno','horasSueno','especifiqueSueno',
    'fuma','edadInicioFuma','anosFumando','cigarrosDia','tipoBebida','cantidadBebidas',
    'frecuenciaAlcohol','consumeDrogas','dosisAnticovid','marcaVacuna','edadInicioLaboral','tiempoMinas',
  ];
  for (const k of simple) {
    if (survey[k] != null) (f as any)[k] = survey[k];
  }

  // Booleanos
  if (survey.practicaDeporte != null) f.practicaDeporte = survey.practicaDeporte;
  if (survey.consumeAlcohol != null) f.consumeAlcohol = survey.consumeAlcohol;
  if (survey.esquemaVacunacion != null) f.esquemaVacunacion = survey.esquemaVacunacion;
  if (survey.tieneTatuajes != null) f.tieneTatuajes = survey.tieneTatuajes;
  if (survey.usaAudifonos != null) f.usaAudifonos = survey.usaAudifonos;
  if (survey.trabajoMinas != null) f.trabajoMinas = survey.trabajoMinas;

  // Edad
  f.edad = survey.edad != null ? String(survey.edad) : '';

  // celular: "+52 8112345678" → lada + celular
  if (survey.celular) {
    const parts = (survey.celular as string).split(' ');
    if (parts.length >= 2 && parts[0].startsWith('+')) {
      f.lada = parts[0];
      f.celular = parts.slice(1).join('');
    } else {
      f.celular = survey.celular;
    }
  }

  // municipio: "Monterrey, Nuevo León, 🇲🇽 México"
  if (survey.municipio) {
    const parts = (survey.municipio as string).split(', ');
    if (parts.length >= 3) {
      f.municipio = parts[0]; f.estado = parts[1]; f.pais = parts.slice(2).join(', ');
    } else if (parts.length === 2) {
      f.municipio = parts[0]; f.estado = parts[1];
    } else {
      f.municipio = survey.municipio;
    }
  }

  // drogas arrays
  if (survey.cualDroga) {
    const drogas = (survey.cualDroga as string).split(', ');
    const frecuencias = ((survey.frecuenciaDroga as string) || '').split(', ');
    const tiempos = ((survey.tiempoDroga as string) || '').split(', ');
    const ultimasVeces = ((survey.ultimaVezDroga as string) || '').split(', ');
    f.drogas = drogas.map((droga, i) => ({
      droga: droga || '', frecuencia: frecuencias[i] || '', tiempo: tiempos[i] || '', ultimaVez: ultimasVeces[i] || '',
    }));
    if (!f.drogas.length) f.drogas = [{ droga: '', frecuencia: '', tiempo: '', ultimaVez: '' }];
  }

  // ultimoTatuaje: "2 años 6 meses"
  if (survey.ultimoTatuaje) {
    const aniosM = (survey.ultimoTatuaje as string).match(/(\d+)\s*años/);
    const mesesM = (survey.ultimoTatuaje as string).match(/(\d+)\s*meses/);
    f.ultimoTatuajeAnios = aniosM ? aniosM[1] : '';
    f.ultimoTatuajeMeses = mesesM ? mesesM[1] : '';
  }

  // escolaridad: "Secundaria — Completa"
  if (survey.escolaridad) {
    if ((survey.escolaridad as string).includes(' — ')) {
      const [esc, est] = (survey.escolaridad as string).split(' — ');
      f.escolaridad = esc; f.escolaridadEstatus = est;
    } else {
      f.escolaridad = survey.escolaridad;
    }
  }

  // lugarNacimiento: "Monterrey, Nuevo León, 🇲🇽 México"
  if (survey.lugarNacimiento) {
    const parts = (survey.lugarNacimiento as string).split(', ');
    if (parts.length >= 3) {
      f.lugarNacimientoMunicipio = parts[0]; f.lugarNacimientoEstado = parts[1]; f.lugarNacimientoPais = parts.slice(2).join(', ');
    } else if (parts.length === 2) {
      f.lugarNacimientoEstado = parts[0]; f.lugarNacimientoPais = parts[1];
    } else {
      f.lugarNacimientoPais = survey.lugarNacimiento;
    }
  }

  // antecedentes familiares
  if (survey.antecedentesFamiliares?.length) {
    f.antecedentesFamiliares = ENFERMEDADES_FAMILIARES.map(enfermedad => {
      const ex = (survey.antecedentesFamiliares as any[]).find((a: any) => a.enfermedad === enfermedad);
      if (!ex) return { enfermedad, si: null, familiares: [] };
      return {
        enfermedad,
        si: ex.si ?? null,
        familiares: Array.isArray(ex.familiares) ? ex.familiares : (ex.quien ? [ex.quien] : []),
      };
    });
  }

  // antecedentes patológicos
  if (survey.antecedentesPatologicos?.length) {
    f.antecedentesPatologicos = ANTECEDENTES_PATOLOGICOS.map(({ condicion }) => {
      const ex = (survey.antecedentesPatologicos as any[]).find((a: any) => a.condicion === condicion);
      if (!ex) return { condicion, si: null, entradas: [{ especifique: '', fecha: '' }] };
      return {
        condicion,
        si: ex.si ?? null,
        entradas: Array.isArray(ex.entradas) && ex.entradas.length
          ? ex.entradas
          : ex.especifique
            ? [{ especifique: ex.especifique, fecha: ex.fecha || '' }]
            : [{ especifique: '', fecha: '' }],
      };
    });
  }

  // exposiciones e historial
  if (survey.exposiciones) f.exposiciones = { ...empty.exposiciones, ...survey.exposiciones };
  if (survey.historialEmpleos?.length) f.historialEmpleos = survey.historialEmpleos;

  return f;
}

// ── Contexto de color por paso ────────────────────────────────────────
const StepColorCtx = createContext('#3375c8');
const useStepColor = () => useContext(StepColorCtx);

// ── Sub-componentes ───────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5"
      style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
      {children}
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label>{label}</Label>{children}</div>;
}

function SectionHeader({ icon, title, color }: { icon: string; title: string; color?: string }) {
  const c = color ?? '#3375c8';
  return (
    <div className="flex items-center gap-3 pb-4 mb-1 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${c}20` }}>
        <span className="material-symbols-rounded" style={{ color: c, fontSize: 20 }}>{icon}</span>
      </div>
      <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
    </div>
  );
}

function StepProgress({ current, total, steps, onGoTo }: {
  current: number; total: number; steps: typeof FORM_STEPS; onGoTo: (n: number) => void;
}) {
  return (
    <div className="sticky top-0 z-10 px-4 py-3 border-b" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
      <div className="w-full h-1 rounded-full mb-3" style={{ background: 'var(--bg-elevated)' }}>
        <div className="h-1 rounded-full transition-all duration-500"
          style={{ width: `${((current - 1) / (total - 1)) * 100}%`, background: steps[current - 1].color }} />
      </div>
      <div className="flex items-center justify-between">
        {steps.map((s, i) => {
          const done = i + 1 < current; const active = i + 1 === current;
          return (
            <button key={i} type="button" onClick={() => onGoTo(i + 1)}
              className="flex flex-col items-center gap-1 transition-opacity hover:opacity-80"
              style={{ minWidth: 0, cursor: 'pointer' }} title={s.label}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300"
                style={active
                  ? { background: s.color, boxShadow: `0 0 0 3px ${s.color}30` }
                  : done ? { background: s.color, opacity: 0.75 }
                  : { background: 'var(--bg-elevated)', border: '2px solid var(--border-subtle)' }}>
                {done
                  ? <span className="material-symbols-rounded text-white" style={{ fontSize: 14 }}>check</span>
                  : <span className="material-symbols-rounded" style={{ fontSize: 14, color: active ? '#fff' : 'var(--text-muted)' }}>{s.icon}</span>}
              </div>
              <span className="text-[9px] font-semibold hidden sm:block transition-all"
                style={{ color: active ? s.color : 'var(--text-muted)' }}>{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Pills({ options, value, onChange, color: colorProp }: {
  options: { v: string; l: string }[]; value: string; onChange: (v: string) => void; color?: string;
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

function BoolPills({ value, onChange, color: colorProp }: { value: boolean | null; onChange: (v: boolean) => void; color?: string }) {
  const color = colorProp ?? useStepColor();
  return (
    <div className="flex gap-2 mt-1">
      {([{ v: true, l: 'Sí', icon: 'check' }, { v: false, l: 'No', icon: 'close' }] as const).map(({ v, l, icon }) => {
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

function LadaCombobox({ value, onChange }: { value: string; onChange: (lada: string) => void }) {
  const [query, setQuery] = useState(''); const [open, setOpen] = useState(false);
  const selected = LADAS.find(l => l.lada === value);
  const filtered = query.trim() ? LADAS.filter(l => l.lada.includes(query) || l.nombre.toLowerCase().includes(query.toLowerCase())) : LADAS;
  return (
    <div className="relative" style={{ width: 220, flexShrink: 0 }}>
      <input className="input" placeholder="País o código (+52)"
        value={open ? query : (selected ? `${selected.bandera} ${selected.lada} — ${selected.nombre}` : '')}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onBlur={() => setTimeout(() => setOpen(false), 180)} />
      {open && (
        <div className="absolute z-50 rounded-xl shadow-2xl border overflow-y-auto"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)', maxHeight: 240, width: 280, top: '100%', left: 0, marginTop: 4 }}>
          {filtered.length === 0
            ? <p className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>Sin resultados</p>
            : filtered.map(l => (
              <button key={l.lada + l.nombre} type="button"
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:opacity-80"
                style={l.lada === value ? { background: 'rgba(51,117,200,0.12)', color: 'var(--text-primary)' } : { color: 'var(--text-primary)' }}
                onMouseDown={() => { onChange(l.lada); setOpen(false); }}>
                <span>{l.bandera}</span>
                <span style={{ color: '#3375c8', fontWeight: 600, minWidth: 44 }}>{l.lada}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{l.nombre}</span>
              </button>
            ))
          }
        </div>
      )}
    </div>
  );
}

function ColoniaCombobox({ opciones, value, onChange }: { opciones: string[]; value: string; onChange: (v: string) => void }) {
  const [query, setQuery] = useState(''); const [open, setOpen] = useState(false);
  const filtered = query.trim() ? opciones.filter(c => c.toLowerCase().includes(query.toLowerCase())) : opciones;
  return (
    <div className="relative">
      <input className="input" placeholder={opciones.length ? '— Selecciona tu colonia —' : 'Ej. Centro'}
        value={open ? query : value}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); }}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onBlur={() => setTimeout(() => setOpen(false), 180)} />
      {!open && <span className="material-symbols-rounded absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)', fontSize: 18 }}>expand_more</span>}
      {open && (
        <div className="absolute z-50 w-full rounded-xl shadow-2xl border overflow-y-auto"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)', maxHeight: 220, top: '100%', left: 0, marginTop: 4 }}>
          {filtered.length === 0
            ? <p className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>{opciones.length ? 'Sin coincidencias' : 'Ingresa el CP primero'}</p>
            : filtered.map(c => (
              <button key={c} type="button"
                className="w-full text-left px-3 py-2 text-sm hover:opacity-80"
                style={c === value ? { background: 'rgba(51,117,200,0.12)', color: 'var(--text-primary)', fontWeight: 600 } : { color: 'var(--text-primary)' }}
                onMouseDown={() => { onChange(c); setOpen(false); setQuery(''); }}>
                {c}
              </button>
            ))
          }
        </div>
      )}
    </div>
  );
}

function SearchSelect({ options, value, onChange, placeholder }: { options: string[]; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [query, setQuery] = useState(''); const [open, setOpen] = useState(false);
  const filtered = query.trim() ? options.filter(o => o.toLowerCase().includes(query.toLowerCase())) : options;
  return (
    <div className="relative">
      <input className="input" placeholder={placeholder ?? '— Seleccionar —'}
        value={open ? query : value}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onBlur={() => setTimeout(() => setOpen(false), 180)} />
      <span className="material-symbols-rounded absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)', fontSize: 18 }}>
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
                style={o === value ? { background: 'rgba(51,117,200,0.12)', color: 'var(--text-primary)', fontWeight: 600 } : { color: 'var(--text-primary)' }}
                onMouseDown={() => { onChange(o); setOpen(false); setQuery(''); }}>
                {o}
              </button>
            ))
          }
        </div>
      )}
    </div>
  );
}

function ParientesMultiSelect({ selected, onToggle }: { selected: string[]; onToggle: (p: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="input w-full flex items-center flex-wrap gap-1.5 text-left cursor-pointer"
        style={{ height: 'auto', minHeight: 40, paddingTop: 6, paddingBottom: 6 }}>
        {selected.length === 0
          ? <span className="text-sm" style={{ color: 'var(--text-muted)' }}>— Seleccionar familiar(es) —</span>
          : selected.map(p => (
            <span key={p} className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#3375c8', color: '#fff' }}>
              {p}
              <span className="material-symbols-rounded" style={{ fontSize: 13 }} onClick={e => { e.stopPropagation(); onToggle(p); }}>close</span>
            </span>
          ))
        }
        <span className="material-symbols-rounded ml-auto shrink-0" style={{ color: 'var(--text-muted)', fontSize: 18 }}>{open ? 'expand_less' : 'expand_more'}</span>
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
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left"
                  style={{ background: sel ? 'rgba(51,117,200,0.1)' : 'transparent', color: sel ? '#3375c8' : 'var(--text-primary)' }}
                  onMouseDown={e => { e.preventDefault(); onToggle(p); }}>
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

// ── Componente principal ──────────────────────────────────────────────
interface Props {
  survey?: any;
  patientId: string;
  companies: { id: string; name: string }[];
  onSave: (payload: any) => Promise<void>;
}

export function SurveyEditorForm({ survey, patientId, companies, onSave }: Props) {
  const [form, setForm] = useState<typeof empty>(() => buildFormFromSurvey(survey));
  const [formStep, setFormStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [cpLoading, setCpLoading] = useState(false);
  const [coloniaOpciones, setColoniaOpciones] = useState<string[]>([]);
  const cpCache = useRef<Map<string, { colonias: string[]; municipio: string; estado: string }>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [municipiosDB, setMunicipiosDB] = useState<MunicipiosDB | null>(null);
  const prevSurveyId = useRef<string | null>(survey?.id ?? null);

  useEffect(() => { loadMunicipiosDB().then(db => setMunicipiosDB(db)); }, []);

  // Re-initializar cuando cargue la encuesta asíncronamente
  useEffect(() => {
    if (survey?.id !== prevSurveyId.current) {
      prevSurveyId.current = survey?.id ?? null;
      setForm(buildFormFromSurvey(survey));
    }
  }, [survey?.id]);

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
      try {
        const local = await loadSepomex();
        if (local?.[clean]) {
          const d = local[clean];
          resultado = { municipio: d.m, estado: d.e, colonias: d.c };
        }
      } catch { /* siguiente */ }

      if (!resultado) {
        try {
          const r = await fetch(`https://cp.terio.dev/v1/codigos-postales/${clean}`, { signal: AbortSignal.timeout(8000) });
          if (r.ok) {
            const data = await r.json();
            const items: any[] = data.datos ?? [];
            if (items.length) {
              resultado = {
                municipio: items[0].municipio ?? '',
                estado: items[0].estado ?? '',
                colonias: [...new Set<string>(items.map((i: any) => i.asentamiento).filter(Boolean))],
              };
            }
          }
        } catch { /* siguiente */ }
      }
    }

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
                estado: places[0].state ?? '',
                colonias: [...new Set<string>(places.map((p: any) => p['place name']).filter(Boolean))],
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
        cualDroga:       drogas.map(d => d.droga).filter(Boolean).join(', '),
        frecuenciaDroga: drogas.map(d => d.frecuencia).filter(Boolean).join(', '),
        tiempoDroga:     drogas.map(d => d.tiempo).filter(Boolean).join(', '),
        ultimaVezDroga:  drogas.map(d => d.ultimaVez).filter(Boolean).join(', '),
        ultimoTatuaje:   [ultimoTatuajeAnios && `${ultimoTatuajeAnios} años`, ultimoTatuajeMeses && `${ultimoTatuajeMeses} meses`].filter(Boolean).join(' '),
        escolaridad:     [rest.escolaridad, escolaridadEstatus].filter(Boolean).join(' — '),
        lugarNacimiento: [lugarNacimientoMunicipio, lugarNacimientoEstado, lugarNacimientoPais].filter(Boolean).join(', '),
      };
      await onSave(payload);
      toast.success('Encuesta guardada');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const af = form.antecedentesFamiliares;
  const ap = form.antecedentesPatologicos;
  const stepColor = FORM_STEPS[formStep - 1].color;

  const goTo = (n: number) => { setFormStep(n); scrollRef.current?.scrollTo(0, 0); };

  return (
    <StepColorCtx.Provider value={stepColor}>
      <div className="flex flex-col" style={{ minHeight: 0 }}>
        <StepProgress current={formStep} total={FORM_STEPS.length} steps={FORM_STEPS} onGoTo={goTo} />

        <div ref={scrollRef} className="overflow-y-auto">
          <div className="p-4 md:p-6 space-y-5 pb-6">

            {/* ── PASO 1: Trabajo ─────────────────────────────── */}
            {formStep === 1 && <section className="card space-y-4">
              <SectionHeader icon="business_center" title="Información general" color={FORM_STEPS[0].color} />

              <Field label="Empresa">
                <select className="input" value={form.empresa} onChange={e => set('empresa', e.target.value)}>
                  <option value="">— Selecciona la empresa —</option>
                  {companies.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </Field>

              <div>
                <Label>Tipo de examen</Label>
                <Pills
                  options={[{ v: 'Ingreso', l: 'Ingreso' }, { v: 'Periódico', l: 'Periódico' }, { v: 'Egreso', l: 'Egreso' }, { v: 'Otro', l: 'Otro' }]}
                  value={form.tipoExamen} onChange={v => set('tipoExamen', v)} />
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

              <Field label="Nombre completo *">
                <input className="input" required placeholder="Ej. Juan Pérez García"
                  value={form.nombre} onChange={e => set('nombre', e.target.value)} />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Edad">
                  <input className="input" type="number" min="0" max="120" placeholder="Ej. 32"
                    value={form.edad} onChange={e => set('edad', e.target.value)} />
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
                  <LadaCombobox value={form.lada} onChange={lada => { set('lada', lada); set('celular', ''); }} />
                  <input className="input flex-1" type="tel"
                    placeholder={form.lada === '+52' ? 'Ej. 8112345678' : '000 000 0000'}
                    maxLength={LADA_DIGITOS[form.lada] ?? 10}
                    value={form.celular}
                    onChange={e => set('celular', e.target.value.replace(/\D/g, '').slice(0, LADA_DIGITOS[form.lada] ?? 10))} />
                </div>
              </Field>

              <Field label="NSS — Número de seguro social">
                <input className="input" type="tel" maxLength={11} placeholder="Ej. 12345678901"
                  value={form.nss} onChange={e => set('nss', e.target.value.replace(/\D/g, '').slice(0, 11))} />
              </Field>

              <Field label="Fecha de nacimiento">
                <input className="input" type="date" value={form.fechaNacimiento}
                  onChange={e => set('fechaNacimiento', e.target.value)} />
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
                      <select className="input" value={form.escolaridadEstatus}
                        onChange={e => set('escolaridadEstatus', e.target.value)}>
                        <option value="">— Seleccionar —</option>
                        {['Completa','Trunca','En curso','Pasante','Titulado/a'].map(o => <option key={o} value={o}>{o}</option>)}
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
                    <SearchSelect options={PAISES} value={form.lugarNacimientoPais} placeholder="— Seleccionar país —"
                      onChange={v => { set('lugarNacimientoPais', v); set('lugarNacimientoEstado', ''); set('lugarNacimientoMunicipio', ''); }} />
                  </Field>
                  <Field label="Estado">
                    {form.lugarNacimientoPais.includes('México')
                      ? <SearchSelect options={municipiosDB ? Object.keys(municipiosDB).sort() : ESTADOS_MEXICO}
                          value={form.lugarNacimientoEstado} placeholder="— Seleccionar estado —"
                          onChange={v => { set('lugarNacimientoEstado', v); set('lugarNacimientoMunicipio', ''); }} />
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
                        ? <SearchSelect options={muns} value={form.lugarNacimientoMunicipio} placeholder="— Seleccionar municipio —"
                            onChange={v => set('lugarNacimientoMunicipio', v)} />
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

              <div className="pt-2 space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Domicilio actual</p>

                <Field label="Código postal">
                  <div className="relative">
                    <input className="input" type="tel"
                      maxLength={form.pais.includes('México') ? 5 : 10}
                      placeholder={form.pais.includes('México') ? 'Ej. 64000' : 'Código postal'}
                      value={form.cp}
                      onChange={e => {
                        const esMx = form.pais.includes('México');
                        const v = esMx ? e.target.value.replace(/\D/g, '').slice(0, 5) : e.target.value.replace(/\s/g, '').slice(0, 10);
                        setForm(f => ({ ...f, cp: v, municipio: '', estado: '', colonia: '' }));
                        setColoniaOpciones([]);
                        if (v.length >= (esMx ? 5 : 3)) buscarCP(v, form.pais);
                      }} />
                    {cpLoading && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-rounded animate-spin text-[20px]" style={{ color: '#3375c8' }}>progress_activity</span>
                    )}
                  </div>
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Calle">
                    <input className="input" placeholder="Ej. Av. Constitución"
                      value={form.calle} onChange={e => set('calle', e.target.value)} />
                  </Field>
                  <Field label="Número exterior">
                    <input className="input" placeholder="Ej. 245"
                      value={form.numero} onChange={e => set('numero', e.target.value)} />
                  </Field>
                </div>

                <Field label="Colonia">
                  <ColoniaCombobox opciones={coloniaOpciones} value={form.colonia} onChange={v => set('colonia', v)} />
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
                    <SearchSelect options={PAISES} value={form.pais} placeholder="— Seleccionar país —"
                      onChange={v => { setForm(f => ({ ...f, pais: v, cp: '', municipio: '', estado: '', colonia: '' })); setColoniaOpciones([]); }} />
                  </Field>
                </div>
              </div>
            </section>}

            {/* ── PASO 3: Hábitos ──────────────────────────────── */}
            {formStep === 3 && <section className="card space-y-5">
              <SectionHeader icon="fitness_center" title="Hábitos de vida" color={FORM_STEPS[2].color} />

              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Actividad física</p>

              <div>
                <Label>¿Practica deporte o actividad física?</Label>
                <BoolPills value={form.practicaDeporte} onChange={v => set('practicaDeporte', v)} />
              </div>

              {form.practicaDeporte && (
                <div className="space-y-4">
                  <Field label="¿Qué actividad física practica?">
                    <input className="input" placeholder="Ej. Correr, natación, fútbol"
                      value={form.cualDeporte} onChange={e => set('cualDeporte', e.target.value)} />
                  </Field>
                  <div>
                    <Label>Frecuencia</Label>
                    <Pills options={[{ v: 'Diario', l: 'Diario' },{ v: '3-4 veces/sem', l: '3-4×/semana' },{ v: '1-2 veces/sem', l: '1-2×/semana' },{ v: 'Fines de semana', l: 'Fines de semana' }]}
                      value={form.frecuenciaDeporte} onChange={v => set('frecuenciaDeporte', v)} />
                  </div>
                  <Field label="Horas por semana">
                    <input className="input" placeholder="Ej. 5" type="tel"
                      value={form.horasDeporte} onChange={e => set('horasDeporte', e.target.value.replace(/\D/g, ''))} />
                  </Field>
                </div>
              )}

              <p className="text-[11px] font-semibold uppercase tracking-wide pt-1" style={{ color: 'var(--text-muted)' }}>Alimentación</p>

              <div>
                <Label>¿Cómo calificarías tu alimentación?</Label>
                <Pills options={[{ v: 'Bueno', l: 'Buena' },{ v: 'Regular', l: 'Regular' },{ v: 'Malo', l: 'Mala' }]}
                  value={form.habitosAlimenticios} onChange={v => set('habitosAlimenticios', v)} />
              </div>

              <div>
                <Label>Número de comidas al día</Label>
                <Pills options={[{ v: '1-2', l: '1-2 comidas' },{ v: '3', l: '3 comidas' },{ v: '4-5', l: '4-5 comidas' },{ v: 'Más de 5', l: 'Más de 5' }]}
                  value={form.comidasDia} onChange={v => set('comidasDia', v)} />
              </div>

              <div>
                <Label>¿Con qué frecuencia consumes frutas y verduras?</Label>
                <Pills options={[{ v: 'Diario', l: 'Diario' },{ v: 'Frecuente', l: 'Frecuente' },{ v: 'Poco', l: 'Poco' },{ v: 'Nunca', l: 'Nunca' }]}
                  value={form.consumeFrutasVerduras} onChange={v => set('consumeFrutasVerduras', v)} />
              </div>

              <div>
                <Label>Consumo de agua al día</Label>
                <Pills options={[{ v: 'Menos de 1L', l: 'Menos de 1 L' },{ v: '1-2L', l: '1-2 litros' },{ v: '2-3L', l: '2-3 litros' },{ v: 'Más de 3L', l: 'Más de 3 L' }]}
                  value={form.aguaDia} onChange={v => set('aguaDia', v)} />
              </div>

              <p className="text-[11px] font-semibold uppercase tracking-wide pt-1" style={{ color: 'var(--text-muted)' }}>Sueño</p>

              <div>
                <Label>Calidad de sueño</Label>
                <Pills options={[{ v: 'Bueno', l: 'Buena' },{ v: 'Regular', l: 'Regular' },{ v: 'Malo', l: 'Mala' }]}
                  value={form.calidadSueno} onChange={v => set('calidadSueno', v)} />
              </div>

              <div>
                <Label>Horas de sueño por noche</Label>
                <Pills options={[{ v: 'Menos de 5h', l: 'Menos de 5 h' },{ v: '5-6h', l: '5-6 horas' },{ v: '7-8h', l: '7-8 horas' },{ v: 'Más de 8h', l: 'Más de 8 h' }]}
                  value={form.horasSueno} onChange={v => set('horasSueno', v)} />
              </div>

              {(form.calidadSueno === 'Malo' || form.calidadSueno === 'Regular') && (
                <Field label="¿Por qué? (insomnio, estrés, ronquidos…)">
                  <input className="input" placeholder="Ej. Insomnio, me desvelo con el celular"
                    value={form.especifiqueSueno} onChange={e => set('especifiqueSueno', e.target.value)} />
                </Field>
              )}
            </section>}

            {/* ── PASO 4: Consumo ───────────────────────────────── */}
            {formStep === 4 && <section className="card space-y-5">
              <SectionHeader icon="smoking_rooms" title="Hábitos de consumo" color={FORM_STEPS[3].color} />

              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Tabaquismo</p>
                  <div>
                    <Label>¿Usted fuma?</Label>
                    <Pills options={[{ v: 'SI', l: 'Sí' },{ v: 'NO', l: 'No' },{ v: 'EXFUMADOR', l: 'Ex fumador/a' }]}
                      value={form.fuma} onChange={v => set('fuma', v)} />
                  </div>
                  {(form.fuma === 'SI' || form.fuma === 'EXFUMADOR') && (
                    <div className="space-y-3">
                      <Field label="Edad de inicio"><input className="input" placeholder="Ej. 18" value={form.edadInicioFuma} onChange={e => set('edadInicioFuma', e.target.value)} /></Field>
                      <Field label="Años fumando"><input className="input" placeholder="Ej. 5" value={form.anosFumando} onChange={e => set('anosFumando', e.target.value)} /></Field>
                      <Field label="Cigarros / día"><input className="input" placeholder="Ej. 10" value={form.cigarrosDia} onChange={e => set('cigarrosDia', e.target.value)} /></Field>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Alcohol</p>
                  <div>
                    <Label>¿Consume bebidas alcohólicas?</Label>
                    <BoolPills value={form.consumeAlcohol} onChange={v => set('consumeAlcohol', v)} />
                  </div>
                  {form.consumeAlcohol && (
                    <div className="space-y-3">
                      <Field label="¿Qué tipo de bebida?"><input className="input" placeholder="Ej. Cerveza, vino" value={form.tipoBebida} onChange={e => set('tipoBebida', e.target.value)} /></Field>
                      <Field label="¿Cuántas bebidas?"><input className="input" placeholder="Ej. 3 al día" value={form.cantidadBebidas} onChange={e => set('cantidadBebidas', e.target.value)} /></Field>
                      <Field label="Frecuencia">
                        <select className="input" value={form.frecuenciaAlcohol} onChange={e => set('frecuenciaAlcohol', e.target.value)}>
                          <option value="">— Seleccionar —</option>
                          {FRECUENCIAS_ALCOHOL.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </Field>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Drogas</p>
                  <div>
                    <Label>¿Consume o ha consumido drogas?</Label>
                    <Pills options={[{ v: 'NO_NUNCA', l: 'No, nunca' },{ v: 'SI_CONSUMO', l: 'Sí, consumo' },{ v: 'CONSUMI', l: 'Consumí antes' }]}
                      value={form.consumeDrogas} onChange={v => set('consumeDrogas', v)} />
                  </div>
                  {form.consumeDrogas && form.consumeDrogas !== 'NO_NUNCA' && (
                    <div className="space-y-3">
                      {form.drogas.map((d, i) => (
                        <div key={i} className="space-y-2 rounded-lg p-2" style={{ background: 'var(--bg-elevated)' }}>
                          {form.drogas.length > 1 && (
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Droga {i + 1}</span>
                              <button type="button" onClick={() => setForm(f => ({ ...f, drogas: f.drogas.filter((_, j) => j !== i) }))}
                                style={{ color: 'var(--text-muted)' }}>
                                <span className="material-symbols-rounded" style={{ fontSize: 16 }}>delete</span>
                              </button>
                            </div>
                          )}
                          <Field label="¿Cuál droga?"><input className="input" placeholder="Ej. Marihuana" value={d.droga} onChange={e => setForm(f => ({ ...f, drogas: f.drogas.map((x, j) => j === i ? { ...x, droga: e.target.value } : x) }))} /></Field>
                          <Field label="Frecuencia">
                            <select className="input" value={d.frecuencia} onChange={e => setForm(f => ({ ...f, drogas: f.drogas.map((x, j) => j === i ? { ...x, frecuencia: e.target.value } : x) }))}>
                              <option value="">— Seleccionar —</option>
                              {['Diario','Semanal','Quincenal','Mensual','Ocasional'].map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </Field>
                          <Field label="¿Cuánto tiempo?"><input className="input" placeholder="Ej. 2 años" value={d.tiempo} onChange={e => setForm(f => ({ ...f, drogas: f.drogas.map((x, j) => j === i ? { ...x, tiempo: e.target.value } : x) }))} /></Field>
                          <Field label="Última vez"><input className="input" placeholder="Ej. Hace 6 meses" value={d.ultimaVez} onChange={e => setForm(f => ({ ...f, drogas: f.drogas.map((x, j) => j === i ? { ...x, ultimaVez: e.target.value } : x) }))} /></Field>
                        </div>
                      ))}
                      <button type="button"
                        onClick={() => setForm(f => ({ ...f, drogas: [...f.drogas, { droga: '', frecuencia: '', tiempo: '', ultimaVez: '' }] }))}
                        className="btn w-full text-xs flex items-center justify-center gap-1"
                        style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
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
                  <select className="input" value={form.dosisAnticovid} onChange={e => set('dosisAnticovid', e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    {['1','2','3','4','5 o más'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Marca de vacuna COVID-19">
                  <select className="input" value={form.marcaVacuna} onChange={e => set('marcaVacuna', e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    <option value="Pfizer-BioNTech (Comirnaty)">Pfizer-BioNTech (Comirnaty)</option>
                    <option value="Moderna (Spikevax)">Moderna (Spikevax)</option>
                    <option value="AstraZeneca (Vaxzevria)">AstraZeneca (Vaxzevria)</option>
                    <option value="Johnson & Johnson (Janssen)">Johnson &amp; Johnson (Janssen)</option>
                    <option value="Sputnik V">Sputnik V</option>
                    <option value="Sinovac (CoronaVac)">Sinovac (CoronaVac)</option>
                    <option value="Sinopharm (BBIBP-CorV)">Sinopharm (BBIBP-CorV)</option>
                    <option value="CanSino (Convidecia)">CanSino (Convidecia)</option>
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
                    <Field label="Años"><input className="input" type="tel" placeholder="Ej. 2" value={form.ultimoTatuajeAnios} onChange={e => set('ultimoTatuajeAnios', e.target.value.replace(/\D/g, ''))} /></Field>
                    <Field label="Meses"><input className="input" type="tel" placeholder="Ej. 6" value={form.ultimoTatuajeMeses} onChange={e => set('ultimoTatuajeMeses', e.target.value.replace(/\D/g, ''))} /></Field>
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
                {af.map((item, i) => (
                  <div key={i} className="py-3 border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                    <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>{item.enfermedad}</p>
                    <BoolPills value={item.si} onChange={v => {
                      const next = [...af]; next[i] = { ...next[i], si: v };
                      set('antecedentesFamiliares', next);
                    }} />
                    {item.si && (
                      <div className="pt-1">
                        <ParientesMultiSelect
                          selected={item.familiares}
                          onToggle={p => {
                            const next = [...af];
                            const fams = item.familiares.includes(p) ? item.familiares.filter(f => f !== p) : [...item.familiares, p];
                            next[i] = { ...next[i], familiares: fams };
                            set('antecedentesFamiliares', next);
                          }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>}

            {/* ── PASO 7: Laboral ───────────────────────────────── */}
            {formStep === 7 && <section className="card space-y-4">
              <SectionHeader icon="work" title="Antecedentes laborales" color={FORM_STEPS[6].color} />

              <div className="grid grid-cols-2 gap-4">
                <Field label="Edad de inicio laboral">
                  <input className="input" value={form.edadInicioLaboral} onChange={e => set('edadInicioLaboral', e.target.value)} />
                </Field>
                <div>
                  <Label>¿Ha trabajado en minas?</Label>
                  <BoolPills value={form.trabajoMinas} onChange={v => set('trabajoMinas', v)} />
                </div>
              </div>
              {form.trabajoMinas && (
                <Field label="¿Cuánto tiempo trabajó en minas?">
                  <input className="input" placeholder="Ej. 3 años, 6 meses" value={form.tiempoMinas} onChange={e => set('tiempoMinas', e.target.value)} />
                </Field>
              )}

              <div>
                <Label>Ha estado expuesto a:</Label>
                <div className="flex flex-wrap gap-2">
                  {([['ruidos','Ruidos fuertes'],['polvos','Polvos'],['vapores','Vapores'],['humos','Humos'],['riesgoElectrico','Riesgo eléctrico'],['usaEpp','Usa EPP']] as [string, string][]).map(([k, l]) => (
                    <button key={k} type="button"
                      onClick={() => set('exposiciones', { ...form.exposiciones, [k]: !(form.exposiciones as any)[k] })}
                      className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                      style={(form.exposiciones as any)[k]
                        ? { background: stepColor, color: '#fff', boxShadow: `0 2px 8px ${stepColor}50` }
                        : { background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                      {l}
                    </button>
                  ))}
                  <button type="button"
                    onClick={() => set('exposiciones', { ruidos: false, polvos: false, vapores: false, humos: false, riesgoElectrico: false, usaEpp: false })}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                    style={!Object.values(form.exposiciones).some(Boolean)
                      ? { background: stepColor, color: '#fff', boxShadow: `0 2px 8px ${stepColor}50` }
                      : { background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                    Ninguno
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Historial de empleos (actual primero)</Label>
                  <button type="button"
                    onClick={() => set('historialEmpleos', [...form.historialEmpleos, { empresa: '', cargo: '', tiempo: '', exponentes: '' }])}
                    className="flex items-center gap-1 text-xs px-3 py-1 rounded-lg font-semibold"
                    style={{ background: `${stepColor}18`, color: stepColor }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 15 }}>add</span>
                    Agregar empleo
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>{['#','Empresa','Cargo / Puesto','Tiempo','Exposiciones',''].map(h => (
                        <th key={h} className="text-left pb-2 text-[10px] font-semibold uppercase tracking-wide pr-2" style={{ color: 'var(--text-muted)' }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {form.historialEmpleos.map((emp, i) => (
                        <tr key={i}>
                          <td className="pr-2 pb-2 text-sm" style={{ color: 'var(--text-muted)' }}>{i + 1}.</td>
                          {(['empresa','cargo','tiempo','exponentes'] as const).map(col => (
                            <td key={col} className="pr-2 pb-2">
                              <input className="input text-sm" value={(emp as any)[col]}
                                onChange={e => {
                                  const next = [...form.historialEmpleos];
                                  next[i] = { ...next[i], [col]: e.target.value };
                                  set('historialEmpleos', next);
                                }} />
                            </td>
                          ))}
                          <td className="pb-2">
                            {form.historialEmpleos.length > 1 && (
                              <button type="button"
                                onClick={() => set('historialEmpleos', form.historialEmpleos.filter((_, j) => j !== i))}
                                className="flex items-center justify-center w-8 h-8 rounded-lg"
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
                                <input className="input" placeholder={meta.phEsp} value={entrada.especifique}
                                  onChange={e => updateEntrada(ei, 'especifique', e.target.value)} />
                              </Field>
                              <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                  <Field label="¿Hace cuánto tiempo?">
                                    <input className="input" placeholder={meta.phTiempo} value={entrada.fecha}
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

            {/* ── Navegación ───────────────────────────────────── */}
            <div className="flex items-center justify-between pt-2 pb-2">
              <button onClick={() => formStep > 1 && goTo(formStep - 1)}
                className="btn btn-secondary flex items-center gap-2"
                disabled={formStep === 1}>
                <span className="material-symbols-rounded text-[18px]">arrow_back</span>
                Anterior
              </button>

              <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                {formStep} / {FORM_STEPS.length}
              </span>

              {formStep < FORM_STEPS.length ? (
                <button onClick={() => goTo(formStep + 1)}
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
