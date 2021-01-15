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
      `### ${this.getStatusIcon()} Coverage ${this.getCurrentPercentage()}`,
      this.getStatusMessage(),
    ].join('\n')
  }

  async sendCoverageComment(): Promise<void> {
    if (!this.isPullRequest()) {
      throw Error('Coverage comment supports only in pull_request workflow')
    }

    const pr = this.getPullRequest()
    const comment = this.getCoverageComment()

    await this.octokit.issues.createComment({
      repo: github.context.repo.repo,
      owner: github.context.repo.owner,
      issue_number: pr.number,
      body: comment,
    })
  }

  async sendCheck(): Promise<void> {
    const annotations = this.getAnnotations()

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
        annotations: this.getAnnotations(),
      },
    })
  }

  getAnnotations(): Annotation[] {
    return this.coverage.getUncoveredLines().map(line => ({
      path: line.file.replace(`${process.cwd()}/`, ''),
      start_line: line.number,
      end_line: line.number,
      annotation_level: 'failure',
      message: 'Uncovered line',
    }))
  }
}
