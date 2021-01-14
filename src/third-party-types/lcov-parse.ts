declare module 'lcov-parse' {
  type LcovData = LcovEntry[]

  export interface LcovEntry {
    title: string
    file: string
    branches: Branches
    functions: Functions
    lines: Lines
  }

  interface Branches {
    found: number
    hit: number
    details: BranchDetail[]
  }

  interface BranchDetail {
    line: number
    hit: number
  }

  interface Lines {
    found: number
    hit: number
    details: LineDetail[]
  }

  interface LineDetail {
    line: number
    hit: number
  }

  interface Functions {
    hit: number
    found: number
    details: FunctionDetail[]
  }

  interface FunctionDetail {
    name: string
    line: number
    hit: number
  }

  type Callback = (error: string | null, data?: LcovData) => void

  export function source(content: string, cb: Callback): void

  export default function parse(filepath: string, cb: Callback): void
}
