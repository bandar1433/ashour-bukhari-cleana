import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

function secureConnectionString(raw:string){
  try{
    const url=new URL(raw);
    const mode=url.searchParams.get('sslmode');
    if(!mode||['prefer','require','verify-ca'].includes(mode))url.searchParams.set('sslmode','verify-full');
    return url.toString();
  }catch{return raw}
}

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool(): pg.Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }

  if (!pool) {
    pool = new Pool({
      connectionString: secureConnectionString(process.env.DATABASE_URL),
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    });
  }

  return pool;
}

export async function query<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await getPool().query(sql, params);
  return result.rows as T[];
}
