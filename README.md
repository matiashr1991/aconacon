# aconacon

## Despliegue con Docker Swarm & Traefik (Full Stack)

Este proyecto está optimizado para ejecutarse en contenedores siguiendo la arquitectura de Microservicios en un **Docker Swarm**, incluyendo la aplicación (Next.js) y la base de datos (Postgres).

### Requisitos Previos
1. Docker Swarm inicializado (`docker swarm init`).
2. Una red externa llamada `matdevnet` (para Traefik).
3. Traefik configurado con un CertResolver llamado `letsencryptresolver`.

### Variables de Entorno
Crea un archivo `.env` en el servidor (o usa Docker Secrets) con:
- `POSTGRES_DB`: Nombre de la base de datos (ej: `aconacon`).
- `POSTGRES_USER`: Usuario (ej: `postgres`).
- `POSTGRES_PASSWORD`: Tu contraseña secreta.
- `DOMAIN`: Tu dominio (ej: `testacon.mmatdev.com`).
- `NEXT_PUBLIC_SUPABASE_URL`: Tu URL de Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Tu Anon Key de Supabase.

### Pasos para Desplegar

1. **Construir la imagen**:
   ```bash
   docker build -t aconacon:demo1 \
     --build-arg NEXT_PUBLIC_SUPABASE_URL=... \
     --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
     .
   ```

2. **Desplegar el stack**:
   ```bash
   docker stack deploy -c stack.yml acon
   ```

### Manejo de Base de Datos (Drizzle)

Para sincronizar el esquema con la base de datos interna de Docker:

1. **Push Directo** (Recomendado para cambios rápidos):
   ```bash
   docker exec $(docker ps -q -f name=acon_app) npm run db:push
   ```

2. **Generar Migraciones**:
   ```bash
   npm run db:generate
   ```

### Notas de Producción
- **Persistencia**: Los datos de Postgres se guardan en el volumen `aconacon_pgdata`.
- **Healthcheck**: El servicio `app` esperará (vía healthcheck de Postgres) a que la DB esté lista para aceptar conexiones.
- **Standalone**: La imagen utiliza la salida `standalone` de Next.js para maximizar la velocidad y seguridad.