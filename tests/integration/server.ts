/**
 * Boots a production server against the real database, and guarantees the
 * database is put back the way it was found.
 *
 * The datasource in prisma/schema.prisma is a fixed `file:./dev.db`, so there
 * is no connection string to point at a throwaway copy. These tests are
 * destructive by nature: they place orders, walk them through the status
 * machine and cancel them, and they register a rival stockist. So instead of
 * redirecting the connection, the database file is copied aside before the run
 * and copied back afterwards, including when the run fails or is interrupted.
 */
import { spawn, type ChildProcess } from "node:child_process"
import { createServer } from "node:net"
import { copyFile, rm } from "node:fs/promises"
import { copyFileSync, existsSync } from "node:fs"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = fileURLToPath(new URL("../..", import.meta.url))
const databaseFile = path.join(projectRoot, "prisma", "dev.db")
const buildIdFile = path.join(projectRoot, ".next", "BUILD_ID")

/** Picks a port the OS confirms is free, so parallel runs do not collide. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.unref()
    probe.on("error", reject)
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address()
      if (typeof address === "string" || address === null) {
        probe.close()
        reject(new Error("Could not determine a free port"))
        return
      }
      const { port } = address
      probe.close(() => resolve(port))
    })
  })
}

async function waitForServer(base: string, child: ChildProcess, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  let lastError = "no response"
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}`)
    }
    try {
      const res = await fetch(`${base}/api/auth/csrf`)
      if (res.ok) return
      lastError = `HTTP ${res.status}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Server did not become ready within ${timeoutMs}ms (${lastError})`)
}

export interface TestServer {
  base: string
  stop: () => Promise<void>
}

export async function startServer(): Promise<TestServer> {
  if (!existsSync(databaseFile)) {
    throw new Error("prisma/dev.db is missing. Run: npx prisma db push && npx prisma db seed")
  }
  if (!existsSync(buildIdFile)) {
    throw new Error("No production build found. Run: npm run build")
  }

  const backup = path.join(await mkdtemp(path.join(tmpdir(), "pharmalink-db-")), "dev.db.backup")
  await copyFile(databaseFile, backup)

  let restored = false
  const restore = async () => {
    if (restored) return
    restored = true
    await copyFile(backup, databaseFile)
    await rm(backup, { force: true })
  }

  const port = await freePort()
  const base = `http://127.0.0.1:${port}`
  const server = spawn("npx", ["next", "start", "--port", String(port)], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: "production" },
  })

  let serverLog = ""
  server.stdout?.on("data", (chunk) => {
    serverLog += String(chunk)
  })
  server.stderr?.on("data", (chunk) => {
    serverLog += String(chunk)
  })

  const stop = async () => {
    if (server.exitCode === null) {
      server.kill("SIGTERM")
      // Give the server a moment to close the database before it is overwritten.
      await new Promise((resolve) => setTimeout(resolve, 500))
      if (server.exitCode === null) server.kill("SIGKILL")
    }
    await restore()
  }

  // If the process is killed outright, still put the database back.
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.once(signal, () => {
      void restore()
    })
  }
  process.once("exit", () => {
    if (!restored) {
      try {
        copyFileSync(backup, databaseFile)
      } catch {
        /* nothing useful to do while exiting */
      }
    }
  })

  try {
    await waitForServer(base, server, 60_000)
  } catch (error) {
    await stop()
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n--- server output ---\n${serverLog}`,
    )
  }

  return { base, stop }
}
