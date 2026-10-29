import { unzipSync } from 'fflate'

export const MAX_MANIFEST_BYTES = 64 * 1024

export function readManifestFromZip(bytes) {
  let files
  try {
    files = unzipSync(bytes, {
      filter: (file) => file.name === 'manifest.json' && file.originalSize <= MAX_MANIFEST_BYTES,
    })
  } catch (error) {
    throw new Error(`invalid ZIP: ${error.message}`)
  }
  const entry = files['manifest.json']
  if (!entry) {
    throw new Error('ZIP root must contain manifest.json (max 64 KiB)')
  }
  try {
    return JSON.parse(new TextDecoder().decode(entry))
  } catch (error) {
    throw new Error(`manifest.json is not valid JSON: ${error.message}`)
  }
}
