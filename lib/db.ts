import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "data", "vcbrain.db");

declare global {
  // eslint-disable-next-line no-var
  var __vcbrainDb: Database.Database | undefined;
}

function open(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("busy_timeout = 5000");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(path.join(process.cwd(), "lib", "schema.sql"), "utf8");
  db.exec(schema);
  return db;
}

// Lazy singleton: opens on first query, not at module import (parallel Next.js
// build workers import this module and would otherwise race on the schema
// write), and survives dev hot-reload via globalThis.
export const db: Database.Database = new Proxy({} as Database.Database, {
  get(_target, prop) {
    const real = (globalThis.__vcbrainDb ??= open());
    const value = real[prop as keyof Database.Database];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});

export function json<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
