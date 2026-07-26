import type postgres from "postgres";

type SqlValue = string | number | boolean | null;

type D1Result<T = unknown> = {
  results?: T[];
  success: boolean;
};

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
};

type D1Database = {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(
    statements: D1PreparedStatement[],
  ): Promise<D1Result<T>[]>;
};

type Statement = {
  text: string;
  values?: SqlValue[];
};

let postgresClient: ReturnType<typeof postgres> | null = null;
let d1Database: D1Database | null = null;

function databaseUrl(): string | null {
  return process.env.DATABASE_URL?.trim() || null;
}

async function getPostgres(): Promise<ReturnType<typeof postgres>> {
  if (postgresClient) return postgresClient;

  const url = databaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL is required when running outside Cloudflare.");
  }

  const { default: createPostgresClient } = await import("postgres");
  postgresClient = createPostgresClient(url, {
    max: 1,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return postgresClient;
}

async function getD1(): Promise<D1Database> {
  if (d1Database) return d1Database;

  // Vercel's bundler must not resolve the Cloudflare-only URI. Vinext leaves
  // this native import available to workerd, while Vercel never executes it
  // because DATABASE_URL is configured there.
  const moduleName = "cloudflare:workers";
  const cloudflare = (await import(
    /* webpackIgnore: true */
    /* @vite-ignore */
    moduleName
  )) as { env?: { DB?: D1Database } };

  if (!cloudflare.env?.DB) {
    throw new Error(
      "No database is configured. Set DATABASE_URL on Vercel or provide the Cloudflare D1 DB binding.",
    );
  }

  d1Database = cloudflare.env.DB;
  return d1Database;
}

function postgresStatement(text: string): string {
  let sequentialIndex = 0;
  return text.replace(/\?(\d+)?/g, (_match, explicit: string | undefined) => {
    const index = explicit ? Number(explicit) : ++sequentialIndex;
    return `$${index}`;
  });
}

export function usesPostgres(): boolean {
  return Boolean(databaseUrl());
}

export async function queryRows<T>(
  text: string,
  values: SqlValue[] = [],
): Promise<T[]> {
  if (usesPostgres()) {
    const sql = await getPostgres();
    const rows = await sql.unsafe(postgresStatement(text), values);
    return rows as unknown as T[];
  }

  const d1 = await getD1();
  const result = await d1.prepare(text).bind(...values).run<T>();
  return result.results ?? [];
}

export async function queryOne<T>(
  text: string,
  values: SqlValue[] = [],
): Promise<T | null> {
  if (usesPostgres()) {
    const rows = await queryRows<T>(text, values);
    return rows[0] ?? null;
  }

  const d1 = await getD1();
  return d1.prepare(text).bind(...values).first<T>();
}

export async function execute(
  text: string,
  values: SqlValue[] = [],
): Promise<void> {
  if (usesPostgres()) {
    const sql = await getPostgres();
    await sql.unsafe(postgresStatement(text), values);
    return;
  }

  const d1 = await getD1();
  await d1.prepare(text).bind(...values).run();
}

export async function executeBatch(statements: Statement[]): Promise<void> {
  if (usesPostgres()) {
    const sql = await getPostgres();
    await sql.begin(async (transaction) => {
      for (const statement of statements) {
        await transaction.unsafe(
          postgresStatement(statement.text),
          statement.values ?? [],
        );
      }
    });
    return;
  }

  const d1 = await getD1();
  await d1.batch(
    statements.map((statement) =>
      d1.prepare(statement.text).bind(...(statement.values ?? [])),
    ),
  );
}
