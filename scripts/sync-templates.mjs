// Regenerates templates/ from the nuxt-template repo.
// Usage: node scripts/sync-templates.mjs [path-to-nuxt-template]
//
// Every text edit below must match exactly, so the script fails loudly when the
// source repo changes in a way the edits no longer fit.

import { execFileSync } from "node:child_process"
import { cpSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const source = resolve(process.argv[2] ?? join(root, "../nuxt-template"))

const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: source, encoding: "utf8" })
  .split("\0")
  .filter(Boolean)

// Files that only make sense in the template repo itself.
const templateOnly = new Set([".claude/routines/template-update.md"])
const dbOnly = (file) => file.startsWith("layers/db/") || file === ".claude/rules/db.md"

function replace(text, from, to, file) {
  if (!text.includes(from)) throw new Error(`${file}: expected text not found:\n${from}`)
  return text.replace(from, to)
}

function edit(dir, file, ...pairs) {
  const path = join(dir, file)
  let text = readFileSync(path, "utf8")
  for (const [from, to] of pairs) text = replace(text, from, to, file)
  writeFileSync(path, text)
}

function copy(name, include) {
  const dir = join(root, "templates", name)
  rmSync(dir, { recursive: true, force: true })
  for (const file of tracked.filter(include)) {
    mkdirSync(dirname(join(dir, file)), { recursive: true })
    cpSync(join(source, file), join(dir, file))
  }
  return dir
}

function dropRoutine(dir) {
  edit(dir, "README.md", [
    "\n- `.claude/routines/template-update.md` is the prompt of a weekly cloud routine that updates dependencies and brings in new best practices. Delete it in apps made from the template.",
    "",
  ])
  edit(dir, "docs/decisions.md", [
    "## Upkeep routine\n\nA weekly cloud routine (`.claude/routines/`) updates dependencies and adopts new best practices, opening at most one PR. Apps made from the template can delete it.\n\n",
    "",
  ])
}

function dropDb(dir) {
  const pkgPath = join(dir, "package.json")
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
  for (const script of ["db:generate", "db:migrate"]) {
    if (!pkg.scripts[script]) throw new Error(`package.json: script ${script} not found`)
    delete pkg.scripts[script]
  }
  for (const [field, dep] of [
    ["dependencies", "@libsql/client"],
    ["dependencies", "drizzle-orm"],
    ["devDependencies", "drizzle-kit"],
  ]) {
    if (!pkg[field][dep]) throw new Error(`package.json: ${field}.${dep} not found`)
    delete pkg[field][dep]
  }
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

  edit(dir, ".env.example", [
    "\n# layers/db: libsql URL, defaults to file:.data/db.sqlite\n# NUXT_DB_URL=file:.data/db.sqlite\n",
    "",
  ])
  edit(
    dir,
    "README.md",
    ["vp run db:migrate      # only if you keep layers/db\n", ""],
    [
      "### Included as a layer: `layers/db`\n\nSQLite through Drizzle and libsql. The DB file lives in `.data/`. To drop it, delete `layers/db/`, the `db:*` scripts, the `drizzle-orm`, `@libsql/client` and `drizzle-kit` dependencies, `.claude/rules/db.md`, and the `NUXT_DB_URL` line in `.env.example`.\n\n",
      "",
    ],
    [
      "`.claude/rules/` holds path-scoped notes for Vue files and the DB layer.",
      "`.claude/rules/` holds path-scoped notes for Vue files.",
    ],
  )
  edit(dir, "docs/decisions.md", [
    "\n- **`layers/db`:** SQLite through Drizzle and libsql (prebuilt binaries, no native build). The DB file lives in `.data/`.\n",
    "",
  ])
  // Resolve from scratch: an updated lockfile keeps the removed packages as
  // optional peer resolutions (unstorage > db0 > drizzle-orm).
  rmSync(join(dir, "pnpm-lock.yaml"))
  execFileSync("vp", ["install", "--lockfile-only"], { cwd: dir, stdio: "inherit" })
}

// npm drops .gitignore when publishing; vp create renames _gitignore back.
function finish(dir) {
  renameSync(join(dir, ".gitignore"), join(dir, "_gitignore"))
}

const variants = {
  "nuxt-ui-db": (file) => !templateOnly.has(file),
  "nuxt-ui": (file) => !templateOnly.has(file) && !dbOnly(file),
}

for (const [name, include] of Object.entries(variants)) {
  const dir = copy(name, include)
  dropRoutine(dir)
  if (name === "nuxt-ui") dropDb(dir)
  finish(dir)
  console.log(`templates/${name}: done`)
}

const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
  cwd: source,
  encoding: "utf8",
}).trim()
console.log(`Synced from ${source} at ${sha}`)
