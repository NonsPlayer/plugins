export function buildPluginRecord(registration) {
  return {
    schema_version: 1,
    id: registration.id,
    repository: registration.repository,
    branch: registration.branch,
    authors: registration.authors,
    license: registration.license,
    related_path: registration.related_path ?? '.',
    labels: registration.labels ?? [],
    preview: registration.preview ?? null,
    introduction: registration.introduction ?? {},
    deprecated: registration.deprecated ?? false,
    blocked: registration.blocked ?? false,
    official: registration.official === true,
  }
}

export function buildEntry(registration, resolved) {
  const plugin = buildPluginRecord(registration)
  const meta = {
    schema_version: 1,
    ...resolved.summary,
  }
  const release = {
    schema_version: 1,
    id: registration.id,
    latest_version: resolved.version,
    latest_version_index: 0,
    releases: [
      {
        url: resolved.release.html_url,
        name: resolved.release.name ?? '',
        tag_name: resolved.release.tag_name,
        created_at: resolved.release.created_at ?? null,
        description: resolved.release.body ?? '',
        prerelease: resolved.release.prerelease === true,
        asset: {
          id: resolved.asset.id,
          name: resolved.asset.name,
          size: resolved.asset.size ?? null,
          download_count: resolved.asset.download_count ?? 0,
          created_at: resolved.asset.created_at ?? null,
          browser_download_url: resolved.asset.browser_download_url,
          hash_md5: resolved.md5,
          hash_sha256: resolved.sha256,
        },
        meta,
      },
    ],
    history: resolved.history,
  }
  return { plugin, release, meta, all: { plugin, release, meta } }
}

export function buildIndex(entries, { generatedAt = new Date().toISOString() } = {}) {
  const sorted = [...entries].sort((a, b) => a.plugin.id.localeCompare(b.plugin.id))
  return {
    schema_version: 1,
    generated_at: generatedAt,
    plugins: sorted.map(({ plugin, release, meta }) => {
      const asset = release.releases[0].asset
      return {
        id: plugin.id,
        name: meta.name,
        version: meta.version,
        description: meta.description,
        authors: plugin.authors,
        license: plugin.license,
        repository: plugin.repository,
        labels: plugin.labels,
        preview: plugin.preview,
        official: plugin.official,
        deprecated: plugin.deprecated,
        blocked: plugin.blocked,
        unavailable: false,
        engines: meta.engines,
        permissions: meta.permissions,
        httpHosts: meta.httpHosts ?? [],
        fileRoots: meta.fileRoots ?? [],
        artifact: {
          url: asset.browser_download_url,
          size: asset.size,
          sha256: asset.hash_sha256,
          md5: asset.hash_md5,
        },
        release: {
          tag: release.releases[0].tag_name,
          created_at: release.releases[0].created_at,
        },
      }
    }),
  }
}

export function buildAuthors(entries) {
  const authors = new Map()
  for (const { plugin } of entries) {
    for (const author of plugin.authors) {
      const key = author.name
      if (!authors.has(key)) {
        authors.set(key, { name: key, links: new Set(), plugins: new Set() })
      }
      const item = authors.get(key)
      if (author.link) item.links.add(author.link)
      item.plugins.add(plugin.id)
    }
  }
  return Object.fromEntries(
    [...authors.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [
        key,
        {
          name: value.name,
          links: [...value.links].sort(),
          plugins: [...value.plugins].sort(),
        },
      ]),
  )
}
