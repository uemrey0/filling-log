# Deployment op Vercel

## Stappen

### 1. Deploy naar Vercel
Push naar GitHub en koppel het project in Vercel.
De build slaagt ook zonder database — de connectie wordt pas gelegd bij de eerste API-aanroep.

### 2. AWS Aurora koppelen in Vercel
Vercel → Project → **Storage → Connect Database → AWS Aurora**

Vercel voegt automatisch de volgende env vars toe:
- `PGHOST`
- `PGPORT`
- `PGUSER`
- `PGDATABASE`
- `AWS_REGION`
- `AWS_ROLE_ARN`

### 3. Database tabellen aanmaken
Voer eenmalig de migratie SQL uit via de AWS RDS Query Editor of een databasetool:

```
drizzle/migrations/0001_initial.sql
```

### 4. Redeploy
Na het koppelen van de database: Vercel → **Deployments → Redeploy**.

---

## Lokale ontwikkeling

Maak `.env.local` aan op basis van `.env.local.example` en vul de waarden in vanuit Vercel → Settings → Environment Variables.

```bash
bun dev
```
