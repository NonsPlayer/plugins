import { readFile } from 'node:fs/promises'
import { parseGitHubRepository } from './github.mjs'
import { resolveInside } from './paths.mjs'
import { publicRegistration } from './registration.mjs'
import { resolveLatestRelease } from './release.mjs'
import { formatAjvErrors } from './schema.mjs'

export async function checkRegistrations({
  registrations,
  loadErrors = [],
  validators,
  github = null,
  skipRelease = false,
  maxReleases = 20,
  logger = console,
}) {
  let failed = 0

  for (const error of loadErrors) {
    failed += 1
    logger.error(`[error] ${error.id}: ${error.message}`)
  }

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
            distribution: registration.distribution,
            maxReleases,
          })
          logger.log(`[ok] ${registration.id}: ${resolved.version} ${resolved.release.tag_name}`)
          continue
        }
      } catch (error) {
        errors.push(error.message)
      }
    }

    if (errors.length > 0) {
      failed += 1
      for (const error of errors) {
        logger.error(`[error] ${registration.id}: ${error}`)
      }
    } else {
      logger.log(`[ok] ${registration.id}`)
    }
  }

  return {
    checked: registrations.length + loadErrors.length,
    failed,
  }
}
