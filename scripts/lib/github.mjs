import { Octokit } from '@octokit/rest'

const USER_AGENT = 'nonsplayer-plugin-catalogue'

export function parseGitHubRepository(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`invalid repository URL: ${value}`)
  }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com') {
    throw new Error(`repository must be a public GitHub URL: ${value}`)
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`repository URL must not contain credentials, query or fragment: ${value}`)
  }
  const parts = url.pathname.replace(/^\/|\/$/g, '').split('/')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`repository must point to a GitHub repository root: ${value}`)
  }
  return {
    owner: parts[0],
    repo: parts[1].replace(/\.git$/, ''),
  }
}

export class GitHubClient {
  constructor({ token } = {}) {
    if (!token) throw new Error('GitHub token is required')
    this.octokit = new Octokit({ auth: token, userAgent: USER_AGENT })
  }

  async getRepository(owner, repo) {
    const { data } = await this.octokit.repos.get({ owner, repo })
    return data
  }

  async getBranch(owner, repo, branch) {
    const { data } = await this.octokit.repos.getBranch({ owner, repo, branch })
    return data
  }

  async getContent(owner, repo, contentPath, ref) {
    const { data } = await this.octokit.repos.getContent({ owner, repo, path: contentPath, ref })
    return data
  }

  async listReleases(owner, repo) {
    return this.octokit.paginate(this.octokit.repos.listReleases, {
      owner,
      repo,
      per_page: 100,
    })
  }

  async download(url) {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/octet-stream',
        'User-Agent': USER_AGENT,
      },
      redirect: 'follow',
    })
    if (!response.ok) {
      throw new Error(`download failed: HTTP ${response.status} ${response.statusText}`)
    }
    return new Uint8Array(await response.arrayBuffer())
  }
}

export function createGitHubClient({ token } = {}) {
  return new GitHubClient({ token })
}
