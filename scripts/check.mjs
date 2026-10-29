#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGitHubClient, parseGitHubRepository } from './lib/github.mjs'
import { resolveInside } from './lib/paths.mjs'
import { loadAllRegistrations, publicRegistration } from './lib/registration.mjs'
import { resolveLatestRelease } from './lib/release.mjs'
import { formatAjvErrors, loadRegistrationValidator } from './lib/schema.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const offline = args.has('--offline')
const skipRelease = offline || args.has('--skip-release')

const config = JSON.parse(await readFile(path.join(root, 'catalogue.config.json'), 'utf8'))
const validators = {
  plugin: await loadRegistrationValidator(path.join(root, 'schemas/plugin_info.schema.json')),
  adapter: await loadRegistrationValidator(path.join(root, 'schemas/adapter_info.schema.json')),
}

let registrations
try {
  const loaded = await loadAllRegistrations(root)
  registrations = [...loaded.plugins, ...loaded.adapters]
} catch (error) {
  console.error(`[error] ${error.message}`)
  process.exit(1)
}

const token = process.env.GITHUB_TOKEN || process.env.github_api_token
const github = !offline && token ? createGitHubClient({ token }) : null
if (!offline && !token) {
  console.warn('[warn] GITHUB_TOKEN is not set; remote checks are skipped')
}

let failed = 0

for (const registration of registrations) {
  const errors = []
  const validator = validators[registration.kind]

  if (!validator(publicRegistration(registration))) {
    errors.push(formatAjvErrors(validator.errors))
  }
  for (const [language, file] of Object.entries(registration.introduction ?? {})) {
    try {
      await readFile(resolveInside(registration._dir, file, `introduction.${language}`))
    } catch (error) {
      errors.push(error.message)
    }
  }

  if (errors.length === 0 && github) {
    try {
      const { owner, repo } = parseGitHubRepository(registration.repository)
      const repository = await github.getRepository(owner, repo)
      if (repository.private) {
        throw new Error('repository is private')
      }
      await github.getBranch(owner, repo, registration.branch)
      if (registration.related_path !== undefined && registration.related_path !== '.') {
        await github.getContent(owner, repo, registration.related_path, registration.branch)
      }
      if (!skipRelease) {
        const resolved = await resolveLatestRelease({
          github,
          owner,
          repo,
          pluginId: registration.id,
          kind: registration.kind,
          maxReleases: config.update?.maxReleases ?? 20,
        })
        console.log(`[ok] ${registration.id}: ${resolved.version} ${resolved.release.tag_name}`)
        continue
      }
    } catch (error) {
      errors.push(error.message)
    }
  }

  if (errors.length > 0) {
    failed += 1
    for (const error of errors) {
      console.error(`[error] ${registration.id}: ${error}`)
    }
  } else {
    console.log(`[ok] ${registration.id}`)
  }
}

if (failed > 0) {
  console.error(`[error] ${failed} registration(s) failed`)
  process.exit(1)
}
console.log(`Checked ${registrations.length} registration(s).`)
