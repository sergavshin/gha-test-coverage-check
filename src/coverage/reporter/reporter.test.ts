import path from 'path'
import { Reporter } from './reporter'

describe('Reporter', () => {
  const reporter = new Reporter()
  const abs = (relative: string): string => path.join(__dirname, relative)

  describe('reportFromFile', () => {
    test('empty file', async () => {
      const report = await reporter.reportFromFile(
        abs('./mocks/lcov/empty.info'),
      )

      expect(report).toMatchObject({
        percentage: 0,
        files: [],
      })
    })

    test('throw error, when file content is invalid', async () => {
      await expect(
        reporter.reportFromFile(abs('./mocks/lcov/invalid.info')),
      ).rejects.toThrow()
    })

    test('collect report data', async () => {
      const report = await reporter.reportFromFile(
        abs('./mocks/lcov/uncovered.info'),
      )

      expect(report).toMatchObject({
        percentage: 25,
        files: expect.any(Array),
      })
    })
  })
})
