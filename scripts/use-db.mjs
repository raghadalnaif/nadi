#!/usr/bin/env node
// يبدّل مزوّد قاعدة البيانات في schema.prisma بين sqlite (تطوير محلي)
// و postgresql (الإنتاج على السيرفر) دون المساس ببقية المخطط.
//
//   node scripts/use-db.mjs postgres
//   node scripts/use-db.mjs sqlite

import { readFileSync, writeFileSync } from "fs";

const target = (process.argv[2] ?? "").toLowerCase();
if (!["sqlite", "postgres", "postgresql"].includes(target)) {
  console.error("الاستخدام: node scripts/use-db.mjs <sqlite|postgres>");
  process.exit(1);
}

const SCHEMA = "prisma/schema.prisma";
const SQLITE = `datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}`;
const POSTGRES = `datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}`;

const source = readFileSync(SCHEMA, "utf8");
const block = /datasource db \{[\s\S]*?\n\}/;

if (!block.test(source)) {
  console.error("تعذّر العثور على كتلة datasource في المخطط");
  process.exit(1);
}

const isPg = target !== "sqlite";
const updated = source.replace(block, isPg ? POSTGRES : SQLITE);
writeFileSync(SCHEMA, updated, "utf8");

console.log(`✓ المخطط الآن على ${isPg ? "PostgreSQL (إنتاج)" : "SQLite (تطوير محلي)"}`);
if (isPg) {
  console.log("  الخطوة التالية: اضبط DATABASE_URL ثم شغّل npx prisma migrate deploy");
} else {
  console.log("  الخطوة التالية: npx prisma migrate dev");
}
