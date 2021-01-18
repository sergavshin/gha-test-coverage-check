import * as core from '@actions/core'
import * as github from '@actions/github'
import { Coverage } from '../coverage'
import { formatter } from './formatter'

interface GithubReporterParams {
  token: string
  threshold: number
  coverage: Coverage
}

type PullRequest = NonNullable<typeof github.context.payload.pull_request>

const icons = {
  positive: '💚',
  negative: '💔',
}

interface Annotation {
  path: string
  start_line: number
  end_line: number
  annotation_level: 'failure' | 'notice' | 'warning'
  message: string
}

interface PRFile {
  name: string
  status: string
}

export class GithubReporter {
  private threshold: number
  private coverage: Coverage
  private octokit: ReturnType<typeof github.getOctokit>

  constructor(params: GithubReporterParams) {
    this.threshold = params.threshold
    this.coverage = params.coverage
    this.octokit = github.getOctokit(params.token)
  }

  private isPullRequest(): boolean {
    return github.context.payload.pull_request !== undefined
  }

  private getPullRequest(): PullRequest {
    const pr = github.context.payload.pull_request

    if (pr === undefined) {
      throw new Error('Cannot find pull_request')
    }

    return pr
  }

  private getSha(): string {
    return this.isPullRequest()
      ? this.getPullRequest().head.sha
      : github.context.sha
  }

  createCoverageMessage(): string {
    if (!this.coverage.isPassThreshold(this.threshold)) {
      const current = formatter.percentage(this.coverage.getPercentage())
      const required = formatter.percentage(this.threshold)
      return `${icons.negative} Code doesn't covered enough.
        Current: ${current}, required: ${
        this.threshold === 100 ? '' : '>='
      } ${required}
      `
    }

    return `${icons.positive} All code covered!`
  }

  getCurrentPercentage(): string {
    return formatter.percentage(this.coverage.getPercentage())
  }

  getRequiredPercentage(): string {
    return formatter.percentage(this.threshold)
  }

  private getStatusIcon(): string {
    return this.coverage.isPassThreshold(this.threshold)
      ? icons.positive
      : icons.negative
  }

  private getStatusMessage(): string {
    if (this.coverage.isEmpty()) {
      return 'No code to cover.'
    }

    if (!this.coverage.isPassThreshold(this.threshold)) {
      const current = this.getCurrentPercentage()
      const required = this.getRequiredPercentage()
      const prefix = this.threshold === 100 ? '' : '>= '

      return `Code doesn't covered enough. Current: ${current}, required: ${prefix}${required}`
    }

    return `All code covered!`
  }

  getWorkflowMessage(): string {
    return `${this.getStatusIcon()} ${this.getStatusMessage()}`
  }

  getCoverageComment(): string {
    return [
      `### ${this.getStatusIcon()} Coverage ${
        this.coverage.isEmpty() ? '' : this.getCurrentPercentage()
      }`,
      this.getStatusMessage(),
    ].join('\n')
  }

  async sendCoverageComment(): Promise<void> {
    if (!this.isPullRequest()) {
      throw Error('Coverage comment supports only in pull_request workflow')
    }

    const pr = this.getPullRequest()
    const comment = this.getCoverageComment()

    core.info('Create comment')

    await this.octokit.issues.createComment({
      repo: github.context.repo.repo,
      owner: github.context.repo.owner,
      issue_number: pr.number,
      body: comment,
    })
  }

  async sendCheck(): Promise<void> {
    const annotations = await this.getAnnotations()

    core.info(`Total annotations ${annotations.length}`)

    try {
      if (annotations.length === 0) {
        await this.octokit.checks.create({
          name: 'Coverage',
          repo: github.context.repo.repo,
          owner: github.context.repo.owner,
          head_sha: this.getSha(),
          status: 'completed',
          conclusion: 'success',
        })

        return
      }

      const chunk = annotations.slice(0, 50)

      core.info(`Send annotations chunk of ${chunk.length} elements`)

      await this.octokit.checks.create({
        name: 'Coverage',
        repo: github.context.repo.repo,
        owner: github.context.repo.owner,
        head_sha: this.getSha(),
        status: 'completed',
        conclusion: 'failure',
        output: {
          title: 'Coverage report',
          summary: `${annotations.length} error(s) found`,
          annotations: [chunk[0]],
        },
      })
    } catch (error) {
      throw new Error(`Cannot create coverage check. Error: ${error.message}`)
    }
  }

  async fetchPRFiles(): Promise<PRFile[]> {
    const pr = this.getPullRequest()
    core.info('Fetch pr files')
    try {
      const response = await this.octokit.pulls.listFiles({
        pull_number: pr.number,
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
      })

      return response.data.map(f => ({ name: f.filename, status: f.status }))
    } catch (error) {
      throw new Error(`Cannot fetch pr files list. Error: ${error.message}`)
    }
  }

  async getAnnotations(): Promise<Annotation[]> {
    const removeBasename = (path: string): string =>
      path.replace(`${process.cwd()}/`, '')

    core.info('Create annotations...')

    const files = await this.fetchPRFiles()

    core.info(`Total lines: ${this.coverage.getUncoveredLines().length}`)
    core.info(`Total files: ${files.length}`)

    return this.coverage
      .getUncoveredLines()
      .flatMap(line => {
        const path = removeBasename(line.file)
        const file = files.find(f => f.name === path)

        if (file === undefined) {
          return []
        }

        return {
          path,
          start_line: line.number,
          end_line: line.number,
          annotation_level: 'failure',
          message: 'Uncovered line',
        } as const
      })
      .map((annotation, idx, all) => ({
        ...annotation,
        message: `${annotation.message} (${idx + 1}/${all.length})`,
      }))
  }
}
