import fs from 'fs'
import parse from 'lcov-parse'
import type { LcovData } from 'lcov-parse'

export interface Report {
  percentage: number
  files: LcovData
}

export class Reporter {
  private async parse(content: string): Promise<LcovData> {
    return new Promise((resolve, reject) => {
      parse(content, (error, data) => {
        if (error !== null) {
          reject(new Error(error.toString()))
          return
        }

        // istanbul ignore next
        if (data === undefined) {
          reject(new Error(`lcov parsed data is undefined`))
          return
        }

        resolve(data)
      })
    })
  }

  private async readFile(filepath: string): Promise<string> {
    return fs.promises.readFile(filepath, 'utf-8')
  }

  private toReport(data: LcovData): Report {
    let hit = 0
    let found = 0

    for (const entry of data) {
      hit += entry.lines.hit
      found += entry.lines.found
    }

    const empty = found === 0
    const percentage = empty ? 0 : (hit / found) * 100

    return {
      percentage,
      files: empty ? [] : data,
    }
  }

  async reportFromFile(filepath: string): Promise<Report> {
    const content = await this.readFile(filepath)

    if (content.trim() !== '') {
      const data = await this.parse(content)
      return this.toReport(data)
    }

    return this.toReport([])
  }
}
