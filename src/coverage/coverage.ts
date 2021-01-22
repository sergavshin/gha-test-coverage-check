import { Reporter, Report } from './reporter'

interface Line {
  file: string
  number: number
}

export class Coverage {
  private report: Report

  static async fromReportFile(filepath: string): Promise<Coverage> {
    const repoter = new Reporter()
    const report = await repoter.reportFromFile(filepath)

    return Coverage.of(report)
  }

  static of(report: Report): Coverage {
    return new Coverage(report)
  }

  private constructor(report: Report) {
    this.report = report
  }

  getPercentage(): number {
    return this.report.percentage
  }

  getUncoveredLines(): Line[] {
    return this.report.files
      .filter(file => file.lines.found > file.lines.hit)
      .flatMap(file =>
        file.lines.details
          .filter(detail => detail.hit === 0)
          .map(detail => ({
            file: file.file,
            number: detail.line,
          })),
      )
  }

  isPassThreshold(threshold: number): boolean {
    return this.isEmpty() || this.report.percentage >= threshold
  }

  isEmpty(): boolean {
    return this.report.files.length === 0
  }
}
