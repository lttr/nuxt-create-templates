# @lttr/create

Nuxt starter templates for [`vp create`](https://viteplus.dev/guide/create#organization-templates).

```bash
vp create @lttr              # pick a template
vp create @lttr:nuxt-ui      # Nuxt 4 + Nuxt UI on Vite+, with Claude Code setup
vp create @lttr:nuxt-ui-db   # the same, plus SQLite + Drizzle as a Nuxt layer
```

## How it works

`package.json` lists the templates under `createConfig.templates`. Each one is a folder in `templates/`, and `vp create` copies it as-is: no placeholders, no prompts. `vp create` sets `name` in `package.json` to the target folder; the README title still says "Nuxt template".

Both templates are generated from [lttr/nuxt-template](https://github.com/lttr/nuxt-template). Don't edit `templates/` by hand.

## Updating

```bash
vp run sync                  # reads ../nuxt-template, or pass a path: node scripts/sync-templates.mjs <path>
```

The script copies the files git tracks in the source repo, then:

- drops the template repo's upkeep routine from both variants,
- for `nuxt-ui`, removes `layers/db`, its dependencies, scripts, rules and docs, and resolves a fresh lockfile,
- renames `.gitignore` to `_gitignore`, because npm leaves `.gitignore` out of packages. `vp create` renames it back.

Each text edit must match exactly, so the script fails when the source changes in a way it no longer fits. Update the edit, then run it again.

## Publishing

```bash
npm version patch
npm publish
vp create @lttr --no-interactive   # prints the manifest; confirms it is live
```
