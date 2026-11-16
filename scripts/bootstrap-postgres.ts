import fs from "node:fs"
import path from "node:path"
import { PrismaClient } from "@prisma/client"

const migrationFile = path.join(
  process.cwd(),
  "prisma/migrations/20261117000000_supabase_postgres_baseline/migration.sql",
)

async function main() {
  const prisma = new PrismaClient()

  try {
    const existing = await prisma.$queryRawUnsafe<Array<{ table_name: string | null }>>(
      `SELECT to_regclass('public."User"') AS table_name`,
    )

    if (existing[0]?.table_name) {
      console.log("PharmaLink PostgreSQL tables already exist; skipping bootstrap.")
      return
    }

    const sql = fs.readFileSync(migrationFile, "utf8")
    const statements = sql
      .split(/;\s*(?=\n|$)/)
      .map((statement) => statement.trim())
      .filter(Boolean)

    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement)
    }

    console.log("PharmaLink PostgreSQL tables created in public schema.")
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
