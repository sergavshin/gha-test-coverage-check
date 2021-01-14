import * as fs from 'fs'
import { Settings } from './settings'

jest.mock('fs')

describe('Settings', () => {
  const io = {
    getInput: jest.fn(),
  }
  const fileExistsSpy = jest.spyOn(fs, 'existsSync')

  beforeEach(() => {
    io.getInput.mockClear()
    fileExistsSpy.mockClear()
    Settings.setDefaultMinThreshold(100)
  })

  afterAll(() => fileExistsSpy.mockRestore())

  describe('readToken', () => {
    test('read token', () => {
      io.getInput.mockImplementationOnce(() => 'token')
      expect(Settings.readToken(io)).toBe('token')
    })

    test('token is required', () => {
      io.getInput.mockImplementationOnce(() => '')
      expect(() => Settings.readToken(io)).toThrow()
    })
  })

  describe('readMinThreshold', () => {
    test('read min threshold', () => {
      io.getInput.mockImplementationOnce(() => '90')
      expect(Settings.readMinThreshold(io)).toBe(90)
    })

    test('use default threshold', () => {
      const threshold = 80
      Settings.setDefaultMinThreshold(threshold)
      io.getInput.mockImplementationOnce(() => '')
      expect(Settings.readMinThreshold(io)).toBe(threshold)
    })

    test('error, when threshold is less than 0', () => {
      io.getInput.mockImplementationOnce(() => '-1')
      expect(() => Settings.readMinThreshold(io)).toThrow()
    })

    test('error, when threshold is greater than 100', () => {
      io.getInput.mockImplementationOnce(() => '101')
      expect(() => Settings.readMinThreshold(io)).toThrow()
    })
  })

  describe('readReportFilePath', () => {
    test('returns file path if exists', () => {
      fileExistsSpy.mockReturnValue(true)
      io.getInput.mockImplementationOnce(() => 'coverage.json')
      expect(Settings.readReportFilePath(io)).toBe('coverage.json')
    })

    test('error, when file does not exist', () => {
      fileExistsSpy.mockReturnValue(false)
      io.getInput.mockImplementationOnce(() => 'coverage.json')
      expect(() => Settings.readReportFilePath(io)).toThrow()
    })
  })

  describe('fromIO', () => {
    test('create settings with verified values', () => {
      fileExistsSpy.mockReturnValue(true)

      io.getInput.mockImplementation((input: string): string => {
        switch (input) {
          case 'github_token':
            return 'token'
          case 'min_threshold':
            return '100'
          case 'report_file_path':
            return 'coverage.json'
          default:
            throw new Error(`Unexpected input ${input}`)
        }
      })

      const settings = Settings.fromIO(io)

      expect(settings).toBeInstanceOf(Settings)

      expect(settings).toMatchObject({
        token: 'token',
        minThreshold: 100,
        reportFilePath: 'coverage.json',
      })
    })
  })
})
