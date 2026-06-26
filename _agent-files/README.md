# Mediwork + Agente n8n

Agente conversacional de WhatsApp que automatiza el agendado de citas de empresa en la clínica visual. Construido con n8n auto-hospedado y Claude (tool calling) llamando a la API de Mediwork.

## Arquitectura

```
WhatsApp Cloud API
       ↓ webhook
   nginx (puerto 8080)
       ↓ /webhook/*
   n8n (5678)  ← AI Agent + Claude + Memory
       ↓ HTTP con JWT
   backend Mediwork (4000)
       ↓ Prisma
   PostgreSQL
```

n8n no toca la BD directamente. **Todas las reglas de negocio viven en el backend Express**, expuestas como endpoints REST en `/api/agent/*`. Esto preserva validaciones, eventos Socket.io para el dashboard en tiempo real, y auditoría centralizada.

## Qué entrego

```
mediwork-n8n/
├── README.md                           ← este archivo
├── docker-compose.yml                  ← stack completo con n8n agregado
├── nginx.conf                          ← reverse proxy con /webhook/* hacia n8n
├── backend/                            ← cambios al backend existente
│   ├── prisma/
│   │   └── schema.prisma               ← schema actualizado (REEMPLAZA el actual)
│   └── src/
│       ├── routes/
│       │   ├── agent.ts                ← NUEVO: endpoints /api/agent/*
│       │   └── appointments.ts.PATCH   ← cambio a la regla "1 cita/día"
│       ├── scripts/
│       │   └── create-agent-token.ts   ← genera JWT de servicio
│       └── index.ts.PATCH              ← 2 líneas para registrar la ruta
└── n8n/
    └── workflow-mediwork-agent.json    ← workflow listo para importar
```

## Pasos de instalación

### 1. Aplicar cambios al backend

a) **Reemplaza** `backend/prisma/schema.prisma` con el archivo entregado.

b) **Reemplaza** el handler `POST /` de `backend/src/routes/appointments.ts` con el contenido de `appointments.ts.PATCH` (cambia la regla "1 cita por día" por "consultar `DayCapacity`").

c) **Copia** `agent.ts` a `backend/src/routes/agent.ts`.

d) **Copia** `create-agent-token.ts` a `backend/src/scripts/create-agent-token.ts`.

e) **Edita** `backend/src/index.ts`. Agrega:
```typescript
import agent from './routes/agent';
// ...
app.use('/api/agent', agent);
```

### 2. Reemplazar `docker-compose.yml` y `nginx.conf`

Usa los entregados. Los cambios clave:
- Servicio `n8n` nuevo (imagen `n8nio/n8n:1.70.0`).
- nginx routea `/webhook/*` y `/webhook-test/*` hacia n8n.
- n8n usa la misma Postgres pero en schema separado (`n8n`).

### 3. Configurar variables de entorno

En tu `.env` del root:

```bash
# Existentes
JWT_SECRET=algo-largo-y-aleatorio-no-cambies-despues
ANTHROPIC_API_KEY=sk-ant-...

# Nuevas
DEFAULT_DAILY_CAPACITY=20
CLINIC_NAME=Clínica Visual San Pedro
CLINIC_ADDRESS=Av. Hidalgo 123, Zacatecas
CLINIC_PHONE=4921234567

# n8n
N8N_USER=admin
N8N_PASSWORD=cambia-esto
N8N_WEBHOOK_URL=https://tu-dominio-publico-o-ngrok/
N8N_HOST=tu-dominio-publico-o-ngrok
N8N_PROTOCOL=https
TZ=America/Mexico_City
```

**Importante**: si vas a desarrollar local, usa **ngrok** apuntando a `localhost:8080`. La URL https que te dé ngrok es la que va en `N8N_WEBHOOK_URL` y `N8N_HOST`.

### 4. Levantar

```bash
docker compose up --build
```

Esto:
- Crea las tablas nuevas (`prisma db push` automático en el backend).
- Levanta n8n con su esquema en la misma BD.
- Expone n8n en `http://localhost:5678` (basic auth).

### 5. Generar el JWT de servicio

```bash
docker exec -it mediwork-backend npx tsx src/scripts/create-agent-token.ts
```

Copia el token que imprime. **Este token vive 1 año** y solo necesitas regenerarlo si rotas `JWT_SECRET`.

### 6. Importar el workflow a n8n

1. Entra a `http://localhost:5678` (user/pass del `.env`).
2. Menú izquierdo → **Workflows** → **Import from File**.
3. Sube `n8n/workflow-mediwork-agent.json`.
4. Verás 20 nodos. Antes de activarlo, configura las **3 credenciales**:

#### Credencial 1: Mediwork Service JWT
- Tipo: **Header Auth**
- Name: `Authorization`
- Value: `Bearer PEGA_AQUI_EL_JWT_DEL_PASO_5`

#### Credencial 2: Anthropic API
- Tipo: **Anthropic API**
- API Key: tu `sk-ant-...`

#### Credencial 3: WhatsApp Cloud API
- Tipo: **WhatsApp Business Cloud**
- Access Token: el de Meta
- Verify Token: el mismo string que pongas en `WHATSAPP_VERIFY_TOKEN`

5. En cada nodo (las 9 tools, el modelo Claude, los 2 nodos WhatsApp), abre y selecciona la credencial correspondiente del dropdown.

6. Activa el workflow (toggle arriba a la derecha).

### 7. Configurar webhook en Meta

1. Ve a [developers.facebook.com](https://developers.facebook.com) → tu app → WhatsApp → Configuration.
2. Webhook URL: `https://TU_DOMINIO/webhook/whatsapp`
3. Verify Token: el del paso 3 (`WHATSAPP_VERIFY_TOKEN`).
4. Suscríbete al campo `messages`.
5. Manda un mensaje al número de prueba que Meta te asigna.

## Probar sin WhatsApp (modo desarrollo)

n8n permite ejecutar el workflow manualmente con datos de prueba. Pero como el AI Agent depende de memoria por sessionId, lo más fácil es probar el backend solo:

```bash
# Token de servicio
TOKEN=$(docker exec mediwork-backend npx tsx src/scripts/create-agent-token.ts | grep "^eyJ")

# Buscar empresa
curl -X POST http://localhost:4000/api/agent/companies/find \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"acme"}'

# Consultar disponibilidad
curl "http://localhost:4000/api/agent/capacity?from=2026-05-15&to=2026-05-22&required=12" \
  -H "Authorization: Bearer $TOKEN"
```

## Las 9 tools del agente

| Tool | Endpoint | Para qué |
|---|---|---|
| `info_clinica` | `GET /info` | Horarios, ubicación, requisitos |
| `buscar_empresa` | `POST /companies/find` | Buscar empresa por nombre |
| `registrar_empresa` | `POST /companies` | Crear empresa nueva |
| `consultar_disponibilidad` | `GET /capacity` | Días con cupo en un rango |
| `crear_batch` | `POST /batches` | Abrir jornada en BORRADOR |
| `agregar_trabajadores` | `POST /batches/:id/workers` | Crear pacientes + citas |
| `confirmar_batch` | `POST /batches/:id/confirm` | Cerrar batch en CONFIRMADO |
| `cancelar_batch` | `POST /batches/:id/cancel` | Marcar batch CANCELADO |
| `consultar_batch` | `GET /batches/:id` | Ver detalle del batch |

## Flujo de conversación esperado

```
RRHH:     Hola, soy de Acme Corp. Necesitamos revisión visual para 12 trabajadores.
Agente:   [buscar_empresa("Acme Corp")] -> encontrada
          Perfecto, encontré a Acme Corp. ¿Para qué fecha la quieren?
RRHH:     El próximo jueves
Agente:   [consultar_disponibilidad("2026-05-14","2026-05-14",12)] -> alcanza
          El jueves 14 tenemos cupo (faltan 8 espacios para llegar al máximo de 20).
          ¿Confirmamos esa fecha? Solo necesito el contacto y la lista de trabajadores.
RRHH:     Contacto soy yo, Juan Pérez 4925551234. Va la lista:
          1. Ana López 1990-03-15
          2. Pedro García
          3. ...
Agente:   [crear_batch] -> batch_id: abc123
          [agregar_trabajadores(batch_id, [...])] -> agregados: 12
          Listo, registré los 12 trabajadores para el jueves 14 de mayo.
          Resumen: Acme Corp, 14/05/2026, 12 pacientes desde 9:00 AM.
          ¿Lo confirmo?
RRHH:     Sí, confirma
Agente:   [confirmar_batch(abc123)] -> ok
          Confirmado. Los pacientes deben presentar identificación oficial el día de la cita.
```

Cada llamada a tool aparece en tiempo real en el dashboard de la clínica gracias a los eventos Socket.io.

## Cómo modificar el comportamiento del agente

- **Tono / estilo / reglas**: edita el campo `systemMessage` del nodo "AI Agent" en n8n. No requiere reiniciar.
- **Agregar una tool nueva**: duplica un nodo HTTP Request Tool, ajusta nombre/descripción/URL/body, conéctalo al AI Agent vía `ai_tool`.
- **Cambiar cupo por día**: insert en tabla `DayCapacity` con `maxPatients` o `blocked: true`.
- **Cambiar duración de cita**: edita en `agent.ts` la línea `cursor = new Date(cursor.getTime() + 20 * 60 * 1000)`.

## Limitaciones conocidas

- Solo procesa mensajes de **texto** de WhatsApp. Audio/imagen/documentos quedan como mejora futura (Claude tiene visión, pero el flujo actual no la invoca).
- La memoria del agente es **n8n in-memory**: si reinicias n8n, las conversaciones en curso pierden contexto. Para producción seria, agrega Postgres Memory en el AI Agent (es trivial intercambiar `memoryBufferWindow` por `memoryPostgresChat`).
- El doctor asignado a las citas es el primer doctor activo (orden de creación). Si quieres rotar entre varios o por especialidad, edita `pickDoctorForBatch` en `agent.ts`.
- No hay rate-limiting en `/api/agent/*`. Si expones esto a Internet directo (sin pasar por nginx interno), agrega un middleware tipo `express-rate-limit`.

## Próximos pasos sugeridos

1. **Recordatorios**: workflow programado en n8n que mande WhatsApp 24h antes a cada paciente del batch.
2. **Vista de conversaciones**: en el frontend, una pantalla que muestre los batches CONFIRMADOS del día con lista de pacientes (los datos ya están en la BD).
3. **Soporte de archivos**: agregar manejo de `type: 'document'` en el parser para que RRHH pueda subir Excel/CSV con la lista.
4. **Métricas**: contar batches por mes, tasa de no-show por empresa.
