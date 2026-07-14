# Mediwork 2.0

Sistema médico empresarial con gestión de pacientes, cuestionarios, resultados de exámenes, citas y agente conversacional.

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Node.js + Express + Prisma ORM
- **Base de datos:** PostgreSQL
- **Infraestructura:** Docker + Docker Compose

---

## Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y corriendo
- Git

---

## Correr el proyecto (Docker)

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/mediwork-2.0.git
cd mediwork-2.0
```

### 2. Configurar variables de entorno

```bash
cp backend/.env.example backend/.env
```

Edita `backend/.env` y completa los valores marcados:

| Variable | Descripción |
|---|---|
| `JWT_SECRET` | Cualquier string largo y aleatorio |
| `GOOGLE_API_KEY` | API key de Google (opcional) |
| `WHATSAPP_ACCESS_TOKEN` | Token de WhatsApp Business (opcional) |

> Las variables de base de datos ya vienen listas para Docker. No las cambies.

### 3. Levantar todo

```bash
docker compose up --build
```

Primera vez tarda unos minutos mientras descarga imágenes y construye. Las siguientes veces es mucho más rápido.

### 4. Abrir la app

- **App:** [http://localhost:3000](http://localhost:3000)
- **API:** [http://localhost:4000](http://localhost:4000)

---

## Roles del sistema

| Rol | Descripción |
|---|---|
| `ADMIN` | Acceso completo: pacientes, empresas, usuarios, inventario, ventas |
| `DOCTOR` | Pacientes, citas, resultados de exámenes |
| `PACIENTE_TABLET` | Vista tablet (kiosco) para llenar cuestionario médico |
| `PACIENTE` | Portal del paciente: ve solo su propio expediente y llena su encuesta |
| `EMPRESA` | Portal de empresa: ve los resultados de sus empleados |

### Cuestionario público (sin login)

Los pacientes pueden registrarse llenando su cuestionario en:

```
http://localhost:3000/encuesta
```

Al enviarlo se crea automáticamente su expediente y aparecen en la lista de pacientes.

---

## Estructura del proyecto

```
mediwork-2.0/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma     # Modelos de la base de datos
│   ├── src/
│   │   ├── routes/           # Endpoints REST
│   │   ├── middleware/        # Autenticación JWT
│   │   └── index.ts
│   ├── .env.example          # Plantilla de variables de entorno
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── admin/        # Vistas de administrador
│   │   │   ├── doctor/       # Vistas de doctor
│   │   │   ├── paciente/     # Vista tablet (cuestionario)
│   │   │   ├── public/       # Cuestionario sin login
│   │   │   └── shared/       # Pacientes, detalle de paciente
│   │   ├── components/       # Layout, componentes reutilizables
│   │   ├── services/         # Cliente HTTP (axios)
│   │   └── stores/           # Auth, tema (claro/oscuro)
│   └── Dockerfile
├── docker-compose.yml
└── nginx.conf
```

---

## Actualizar schema de base de datos

Si modificas `backend/prisma/schema.prisma` mientras Docker está corriendo:

```bash
docker cp backend/prisma/schema.prisma mediwork-backend:/app/prisma/schema.prisma
docker exec mediwork-backend npx prisma db push
docker restart mediwork-backend
```

---

## Desarrollo local (sin Docker)

### Backend

```bash
cd backend
cp .env.example .env
# Cambia DATABASE_URL a tu PostgreSQL local
npm install
npx prisma db push
npm run dev
# API en http://localhost:4000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# App en http://localhost:5173
```
