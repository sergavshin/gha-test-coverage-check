import * as fs from 'fs'

interface SettingsInputs {
  token: string
  reportFilePath: string
  minThreshold: number
}

export interface SettingsIO {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getInput(input: string, options?: { required: boolean }): string
}

export class Settings {
  readonly token: string
  readonly reportFilePath: string
  readonly minThreshold: number

  private static DEFAULT_MIN_THRESHOLD = 100

  static setDefaultMinThreshold(threshold: number): void {
    Settings.DEFAULT_MIN_THRESHOLD = threshold
  }

  static fromIO(io: SettingsIO): Settings {
    return new Settings({
      token: Settings.readToken(io),
      minThreshold: Settings.readMinThreshold(io),
      reportFilePath: Settings.readReportFilePath(io),
    })
  }

  static readToken(io: SettingsIO): string {
    const token = io.getInput('github_token', { required: true })

    if (token.trim() === '') {
      throw new Error('github_token is required')
    }

    return token
  }

  static readMinThreshold(io: SettingsIO): number {
    const input = io.getInput('min_threshold')
    const threshold = parseInt(input, 10)

    if (Number.isNaN(threshold)) {
      return Settings.DEFAULT_MIN_THRESHOLD
    } else if (threshold < 0) {
      throw new Error('"min_threshold" cannot be negative')
    } else if (threshold > 100) {
      throw new Error('"min_threshold" cannot be greater then 100')
    } else {
      return threshold
    }
  }

  static readReportFilePath(io: SettingsIO): string {
    const path = io.getInput('report_file_path', { required: true })

    if (fs.existsSync(path)) {
      return path
    }

    throw new Error(`No coverage report found at '${path}'`)
  }

  private constructor(inputs: SettingsInputs) {
    this.token = inputs.token
    this.reportFilePath = inputs.reportFilePath
    this.minThreshold = inputs.minThreshold
  }
}
