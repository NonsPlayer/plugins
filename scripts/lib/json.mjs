import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

export async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

export async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function writeText(file, value) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, value.endsWith('\n') ? value : `${value}\n`, 'utf8')
}

export async function removeDir(dir) {
  await rm(dir, { recursive: true, force: true })
}
