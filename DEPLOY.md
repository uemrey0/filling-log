# Deployment op Vercel

## Stappen

### 1. Deploy naar Vercel
Push naar GitHub en koppel het project in Vercel. De build slaagt ook zonder DATABASE_URL.

### 2. Maak de database aan
In Vercel: **Storage → Create Database → Postgres (Aurora Serverless / Neon / Supabase)**
Of gebruik een externe AWS Aurora PostgreSQL cluster.

### 3. Voeg DATABASE_URL toe
Vercel → Project → **Settings → Environment Variables**

```
DATABASE_URL = postgresql://user:password@host:5432/dbname
```

### 4. Voer de migratie uit
Eenmalig na het instellen van DATABASE_URL:

```bash
DATABASE_URL="postgresql://..." bun drizzle-kit migrate
```

Of kopieer de SQL uit `drizzle/migrations/0001_initial.sql` en voer het uit via de databaseconsole.

### 5. Herstart de deployment
Na het instellen van de env var: Vercel → **Deployments → Redeploy**.

---

## Lokale ontwikkeling

Maak `.env.local` aan:
```
DATABASE_URL=postgresql://localhost:5432/fillerlog
```

```bash
bun dev
```
