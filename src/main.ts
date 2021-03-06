import * as core from '@actions/core'
import { Settings } from './settings'
import { Coverage } from './coverage'
import { GithubReporter } from './gh-reporter'

async function run(): Promise<void> {
  try {
    const settings = Settings.fromIO(core)
    const coverage = await Coverage.fromReportFile(settings.reportFilePath)
    const reporter = new GithubReporter({
      token: settings.token,
      threshold: settings.minThreshold,
    })

    await reporter.useCoverage(coverage)
    await reporter.sendReport()

    if (reporter.isPRCoverageOk()) {
      core.info(reporter.getWorkflowMessage())
    } else {
      core.setFailed(reporter.getWorkflowMessage())
    }
  } catch (error) {
    core.setFailed(error?.message || error)
    return
  }
}

run()
