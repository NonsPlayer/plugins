import Ajv2020 from 'ajv/dist/2020.js'
import { readJson } from './json.mjs'

export async function loadPluginInfoValidator(schemaPath) {
  const schema = await readJson(schemaPath)
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  return ajv.compile(schema)
}

export function formatAjvErrors(errors) {
  return (errors ?? [])
    .map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`)
    .join('; ')
}
