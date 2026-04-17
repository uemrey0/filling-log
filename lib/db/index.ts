import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

type DrizzleDb = NodePgDatabase<typeof schema>

let _pool: Pool | undefined
let _db: DrizzleDb | undefined

function initPool(): Pool {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Go to Vercel → Settings → Environment Variables and add DATABASE_URL.',
    )
  }
  _pool = new Pool({
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })
  return _pool
}

function getPool(): Pool {
  return _pool ?? initPool()
}

function getDb(): DrizzleDb {
  if (!_db) _db = drizzle(getPool(), { schema })
  return _db
}

/**
 * Lazy proxy — Pool and DB are only initialized when an API route is actually
 * called at runtime, NOT at build time. This allows deploying to Vercel before
 * DATABASE_URL is configured.
 */
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_, prop: string | symbol) {
    return Reflect.get(getDb(), prop)
  },
})

export const pool = {
  connect: () => getPool().connect(),
}
