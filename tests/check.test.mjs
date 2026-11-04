import assert from 'node:assert/strict'
import test from 'node:test'
import { checkRegistrations } from '../scripts/lib/check.mjs'

const registration = {
  id: 'good-plugin',
  kind: 'plugin',
  repository: 'https://github.com/owner/good',
  branch: 'main',
  authors: [{ name: 'Owner' }],
  license: 'MIT',
}

function logger() {
  const logs = { log: [], error: [] }
  return {
    logs,
    log(message) {
      logs.log.push(message)
    },
    error(message) {
      logs.error.push(message)
    },
  }
}

test('reports a failed registration and checks the remaining registrations', async () => {
  const output = logger()
  const result = await checkRegistrations({
    registrations: [
      { ...registration, id: 'missing-plugin', repository: 'https://github.com/owner/missing' },
      registration,
    ],
    validators: { plugin: () => true, adapter: () => true },
    github: {
      async getRepository(_owner, repo) {
        if (repo === 'missing') throw new Error('Not Found')
        return { private: false }
      },
      async getBranch() {},
    },
    skipRelease: true,
    logger: output,
  })

  assert.equal(result.checked, 2)
  assert.equal(result.failed, 1)
  assert.deepEqual(output.logs.log, ['[ok] good-plugin'])
  assert.deepEqual(output.logs.error, ['[error] missing-plugin: Not Found'])
})

test('counts registration loading errors as failed entries', async () => {
  const output = logger()
  const result = await checkRegistrations({
    registrations: [],
    loadErrors: [{ id: 'broken-plugin', kind: 'plugin', message: 'cannot read plugin_info.json' }],
    validators: { plugin: () => true, adapter: () => true },
    logger: output,
  })

  assert.equal(result.checked, 1)
  assert.equal(result.failed, 1)
  assert.deepEqual(output.logs.error, ['[error] broken-plugin: cannot read plugin_info.json'])
})
