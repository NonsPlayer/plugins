import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { distFileName, distUrl, normalizeCdnConfig, writeDist } from '../scripts/lib/dists.mjs'

test('normalizes a CDN origin and rejects unsafe paths', () => {
  assert.deepEqual(
    normalizeCdnConfig({ directory: 'dists', baseUrl: 'https://nons-dist.example/' }),
    { directory: 'dists', baseUrl: 'https://nons-dist.example' },
  )
  assert.throws(() => normalizeCdnConfig({ directory: '../dists', baseUrl: 'https://nons-dist.example' }))
  assert.throws(() => normalizeCdnConfig({ directory: '.', baseUrl: 'https://nons-dist.example' }))
  assert.throws(() => normalizeCdnConfig({ directory: 'dists', baseUrl: 'https://nons-dist.example/path' }))
  assert.throws(() => normalizeCdnConfig({ directory: 'dists', baseUrl: 'ftp://nons-dist.example' }))
})

test('builds flat, content-addressed artifact names and URLs', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'nons-dists-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const sha256 = 'a'.repeat(64)
  const name = distFileName('plugin', 'demo-plugin', '1.2.3', sha256)

  assert.equal(name, 'plugin-demo-plugin-1.2.3-aaaaaaaaaaaaaaaa.zip')
  assert.equal(distUrl('https://nons-dist.example', name), `https://nons-dist.example/${name}`)

  await writeDist({ directory, kind: 'plugin', id: 'demo-plugin', version: '1.2.3', sha256, bytes: Buffer.from('zip') })
  assert.equal(await readFile(path.join(directory, name), 'utf8'), 'zip')
})

test('rejects invalid artifact identifiers', () => {
  const sha256 = 'a'.repeat(64)
  assert.throws(() => distFileName('other', 'demo-plugin', '1.2.3', sha256))
  assert.throws(() => distFileName('plugin', '../demo', '1.2.3', sha256))
  assert.throws(() => distFileName('plugin', 'demo-plugin', '../1.2.3', sha256))
  assert.throws(() => distFileName('plugin', 'demo-plugin', '1.2.3', 'abc'))
})
