# openPharmacy API - Docker Setup

This document explains how to run the PostgreSQL database used by the **openPharmacy** API in a local development environment using Docker Compose.

The API is built with **NestJS 11**, uses **Prisma 7** with the official PostgreSQL driver adapter (`@prisma/adapter-pg`) and connects to the database through the `DATABASE_URL` environment variable.

---

## 1. Requirements

Make sure you have the following installed on your machine:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine + Compose v2
- [Node.js](https://nodejs.org/) (version compatible with NestJS 11, recommended >= 20)
- npm (or pnpm / yarn)

Verify your environment:

```bash
docker --version
docker compose version
node --version
npm --version
```

> Note: This project uses **Docker Compose v2** (the `docker compose` command, not the legacy `docker-compose`).

---

## 2. Project Structure (Docker-related files)

```
open-api/
├── docker/
│   └── docker-compose.yml  # PostgreSQL service definition
├── .env                    # Local environment variables (gitignored, used by both Docker and the API)
├── .env.example            # Template committed to the repository
├── package.json            # Includes npm scripts: db:up, db:down, db:logs, db:reset
└── README.md               # This file
```

> The compose file lives under `docker/` to keep all infrastructure configuration in one place. The `.env` file is intentionally kept at the project root so both the Node.js application **and** Docker can read it. The compose file uses `env_file: ../.env` to reach the root file.

---

## 3. Environment Variables

The application and the database are configured through environment variables defined in the `.env` file at the project root.

### `.env.example` (template - committed to the repo)

```env
POSTGRES_USER=openpharmacy
POSTGRES_PASSWORD=openpharmacy
POSTGRES_DB=openpharmacy
POSTGRES_PORT=5432
DATABASE_URL=postgresql://openpharmacy:openpharmacy@localhost:5432/openpharmacy?schema=public
```

### Variable Reference

| Variable           | Description                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| `POSTGRES_USER`    | Username that PostgreSQL will create on first start.                        |
| `POSTGRES_PASSWORD` | Password for the PostgreSQL user.                                          |
| `POSTGRES_DB`      | Name of the default database created on first start.                        |
| `POSTGRES_PORT`    | Host port mapped to the container's `5432`. Default: `5432`.               |
| `DATABASE_URL`     | Full Prisma connection string used by the NestJS application.               |

### How to configure

```bash
# Copy the template and edit it if you want to change any value
cp .env.example .env
```

> The `.env` file is already in `.gitignore`. Never commit real credentials.

---

## 4. What does `docker-compose.yml` do?

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: openpharmacy-postgres
    restart: unless-stopped
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    env_file:
      - ../.env
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-openpharmacy}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-openpharmacy}
      POSTGRES_DB: ${POSTGRES_DB:-openpharmacy}
    volumes:
      - openpharmacy_pg_data:/var/lib/postgresql/data
    healthcheck:
      test:
        - CMD-SHELL
        - pg_isready -U ${POSTGRES_USER:-openpharmacy} -d ${POSTGRES_DB:-openpharmacy}
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  openpharmacy_pg_data:
    name: openpharmacy_pg_data
```

### Key points

- **Image**: `postgres:16-alpine` - lightweight and fully compatible with Prisma 7.
- **`container_name`**: a stable name (`openpharmacy-postgres`) so you can target it directly.
- **`restart: unless-stopped`**: container restarts automatically if Docker restarts.
- **Port mapping**: `${POSTGRES_PORT:-5432}:5432` - falls back to 5432 if the env var is missing.
- **`env_file: ../.env`**: Docker Compose reads the root `.env` file, so there is a single source of truth for credentials (used by both the API and the database). Defaults are still present in `environment` as a safety net.
- **Environment**: user, password and database are read from `.env` with safe defaults.
- **Named volume `openpharmacy_pg_data`**: persists data across container restarts and rebuilds. The volume is owned by Docker, not by the project folder.
- **Healthcheck**: runs `pg_isready` every 10 seconds, so dependent services (or your own scripts) can wait for the DB to be truly ready.

---

## 5. Available npm scripts

The `package.json` exposes convenience scripts so the team does not need to remember the full `docker compose` commands.

| Script            | Description                                                |
| ----------------- | ---------------------------------------------------------- |
| `npm run db:up`   | Starts the PostgreSQL container in detached mode.          |
| `npm run db:down` | Stops and removes the container (the volume is preserved). |
| `npm run db:logs` | Streams the PostgreSQL container logs (Ctrl+C to exit).    |
| `npm run db:reset`| Stops the container, **deletes the volume** and starts fresh. |

> All scripts use `docker compose -f docker/docker-compose.yml` so they can be executed from the project root without changing directory.

---

## 6. Quick Start

### Step 1 - Start the database

```bash
npm run db:up
```

You should see something like:

```
[+] Running 2/2
 ✔ Network open-api_default       Created
 ✔ Container openpharmacy-postgres  Started
```

### Step 2 - Verify the database is healthy

```bash
docker ps
```

The container should show status `Up` (healthy) within a few seconds. If the status shows `starting`, wait a moment - the healthcheck runs every 10 seconds.

You can also check the logs:

```bash
npm run db:logs
```

Look for the line:

```
database system is ready to accept connections
```

### Step 3 - Connect from your application

The API reads `DATABASE_URL` from the `.env` file. With the defaults it will connect to:

```
postgresql://openpharmacy:openpharmacy@localhost:5432/openpharmacy
```

You can then start the API:

```bash
npm run start:dev
```

### Step 4 - Connect from any DB client (optional)

- **Host**: `localhost`
- **Port**: `5432` (or whatever you set in `POSTGRES_PORT`)
- **User**: `openpharmacy`
- **Password**: `openpharmacy`
- **Database**: `openpharmacy`

You can use any client you like: DBeaver, TablePlus, pgAdmin, DataGrip, the `psql` CLI, etc.

---

## 7. Common Operations

### Stop the database (without losing data)

```bash
npm run db:down
```

This stops the container but keeps the volume `openpharmacy_pg_data` intact, so your data survives.

### Reset the database (DESTROYS all data)

```bash
npm run db:reset
```

This removes the container **and** the volume. After running this, the next start will create a brand new empty database.

### View logs

```bash
npm run db:logs
```

Add `--tail=100` if you want only the last 100 lines:

```bash
docker compose -f docker/docker-compose.yml logs --tail=100 postgres
```

### Connect with `psql` from inside the container

```bash
docker exec -it openpharmacy-postgres psql -U openpharmacy -d openpharmacy
```

Useful commands once inside `psql`:

```sql
\dt                 -- list all tables
\l                  -- list all databases
\du                  -- list all users
\q                   -- quit
```

### Connect with `psql` from your host machine

If you have the PostgreSQL client installed locally:

```bash
psql "postgresql://openpharmacy:openpharmacy@localhost:5432/openpharmacy"
```

---

## 8. Data Persistence

All data is stored in a Docker **named volume** called `openpharmacy_pg_data`. The volume is independent of the project folder and the container lifecycle.

Useful commands:

```bash
docker volume ls                          # list all volumes
docker volume inspect openpharmacy_pg_data # see details
docker volume rm openpharmacy_pg_data      # delete the volume (DESTROYS DATA)
```

> If you only run `docker compose down` (or `npm run db:down`) the volume is kept. The data is only destroyed by `npm run db:reset` or by manually removing the volume.

---

## 9. Troubleshooting

### The container keeps restarting / unhealthy

Check the logs:

```bash
npm run db:logs
```

Common causes:

- Port `5432` is already in use on your host. Change `POSTGRES_PORT` in `.env` to something else (e.g. `5433`) and remember to update `DATABASE_URL` accordingly.
- Invalid credentials in `.env` (e.g. special characters in the password). Quote the value or change the password.

### The API cannot connect to the database

Verify the following:

1. The container is running: `docker ps`
2. The `DATABASE_URL` in `.env` matches the values used by Docker Compose.
3. The host is `localhost` (not `postgres` or `db`) when connecting from the host machine.
4. Your firewall / VPN is not blocking port 5432.

### I want to start from scratch

```bash
npm run db:reset
```

This wipes the volume and re-creates the container with an empty database.

### I want to inspect or change the volume location

By default, named volumes live in Docker's data directory. To customize the location you can replace the named volume with a bind mount in `docker/docker-compose.yml`:

```yaml
volumes:
  - ../docker-data/postgres:/var/lib/postgresql/data
```

---

## 10. Production Notes

This `docker-compose.yml` is intended for **local development only**. For production:

- Do not use the default credentials.
- Inject secrets through a secret manager (Doppler, AWS Secrets Manager, etc.) or Docker secrets, not through `.env` files.
- Use a managed PostgreSQL service (RDS, Cloud SQL, Neon, Supabase, etc.) when possible.
- Configure automated backups and point-in-time recovery.
- Place the database in a private network and restrict access with security groups / firewall rules.

---

## 11. Useful References

- [Docker Compose documentation](https://docs.docker.com/compose/)
- [PostgreSQL official image](https://hub.docker.com/_/postgres)
- [Prisma - Database connections](https://www.prisma.io/docs/orm/overview/databases/postgresql)
- [NestJS Documentation](https://docs.nestjs.com/)
