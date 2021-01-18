import * as github from '@actions/github'
import { Coverage } from '../coverage'
import { formatter } from './formatter'

interface GithubReporterParams {
  token: string
  threshold: number
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
  private coverage: Coverage | null
  private octokit: ReturnType<typeof github.getOctokit>

  private coverageAnnotations: Annotation[]

  constructor(params: GithubReporterParams) {
    this.octokit = github.getOctokit(params.token)
    this.coverage = null
    this.threshold = params.threshold
    this.coverageAnnotations = []
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

  async useCoverage(coverage: Coverage): Promise<void> {
    this.coverage = coverage
    this.coverageAnnotations = await this.getAnnotations(coverage)
  }

  private getCoverage(): Coverage {
    if (this.coverage === null) {
      throw new Error(`Coverage is not setup`)
    }

    return this.coverage
  }

  isPRCoverageOk(): boolean {
    return this.coverageAnnotations.length === 0
  }

  isNoCodeToCover(): boolean {
    return this.getCoverage().isEmpty()
  }

  private getStatusIcon(): string {
    return this.isPRCoverageOk() ? icons.positive : icons.negative
  }

  private getStatusMessage(): string {
    if (this.isNoCodeToCover()) {
      return 'No code to cover.'
    }

    if (!this.isPRCoverageOk()) {
      return `PR contains uncovered code!`
    }

    return `All code covered!`
  }

  private getStatusHeader(): string {
    return `### Coverage report ${this.getStatusIcon()}`
  }

  private getStatusFooter(): string {
    const coverage = this.getCoverage()
    const current = formatter.percentage(coverage.getPercentage())
    const required = formatter.percentage(this.threshold)
    return `> _Current: ${current}. Required: ${required}_`
  }

  getWorkflowMessage(): string {
    return `${this.getStatusIcon()} ${this.getStatusMessage()}`
  }

  getCoverageComment(): string {
    return [
      '<!-- coverage-report -->',
      this.getStatusHeader(),
      this.getStatusMessage(),
      this.getStatusFooter(),
    ].join('\n')
  }

  async sendReport(): Promise<void> {
    await Promise.all([this.sendCoverageComment(), this.sendCheck()])
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
    if (this.coverageAnnotations.length === 0) {
      await this.octokit.checks.create({
        name: 'Coverage report',
        repo: github.context.repo.repo,
        owner: github.context.repo.owner,
        head_sha: this.getSha(),
        status: 'completed',
        conclusion: 'success',
      })

      return
    }

    const chunks = this.coverageAnnotations.reduce(
      (acc: Annotation[][], annotation: Annotation): Annotation[][] => {
        const chunk = acc[acc.length - 1]

        if (chunk === undefined) {
          return [[annotation]]
        }

        if (chunk.length < 50) {
          chunk.push(annotation)
        } else {
          acc.push([annotation])
        }

        return acc
      },
      [],
    )

    const [first, ...rest] = chunks
    const title = 'PR coverage check'

    const check = await this.octokit.checks.create({
      name: 'Coverage report',
      repo: github.context.repo.repo,
      owner: github.context.repo.owner,
      head_sha: this.getSha(),
      status: 'completed',
      conclusion: 'failure',
      output: {
        title,
        summary: `${this.coverageAnnotations.length} error(s) found`,
        annotations: first,
      },
    })

    for (const chunk of rest) {
      await this.octokit.checks.update({
        check_run_id: check.data.id,
        repo: github.context.repo.repo,
        owner: github.context.repo.owner,
        output: {
          title,
          summary: `${this.coverageAnnotations.length} error(s) found`,
          annotations: chunk,
        },
      })
    }
  }

  async fetchPRFiles(): Promise<PRFile[]> {
    const pr = this.getPullRequest()
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

  async getAnnotations(coverage: Coverage): Promise<Annotation[]> {
    const removeBasename = (path: string): string =>
      path.replace(`${process.cwd()}/`, '')

    const files = await this.fetchPRFiles()

    return coverage
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
