import {describe, it, expect} from 'vitest'
import {CheckInfo} from '../src/annotator.js'

/**
 *   Copyright 2024 Mike Penz
 */

describe('report_url output', () => {
  it('should format single URL correctly', () => {
    const checkInfos: CheckInfo[] = [
      {
        name: 'Test Report 1',
        url: 'https://github.com/owner/repo/runs/123'
      }
    ]

    const reportUrls = checkInfos.map(info => info.url).join('\n')
    expect(reportUrls).toBe('https://github.com/owner/repo/runs/123')
  })

  it('should format multiple URLs with newline separation', () => {
    const checkInfos: CheckInfo[] = [
      {
        name: 'Test Report 1',
        url: 'https://github.com/owner/repo/runs/123'
      },
      {
        name: 'Test Report 2',
        url: 'https://github.com/owner/repo/runs/456'
      },
      {
        name: 'Test Report 3',
        url: 'https://github.com/owner/repo/runs/789'
      }
    ]

    const reportUrls = checkInfos.map(info => info.url).join('\n')
    expect(reportUrls).toBe(
      'https://github.com/owner/repo/runs/123\nhttps://github.com/owner/repo/runs/456\nhttps://github.com/owner/repo/runs/789'
    )
  })

  it('should handle empty checkInfos array', () => {
    const checkInfos: CheckInfo[] = []

    const reportUrls = checkInfos.map(info => info.url).join('\n')
    expect(reportUrls).toBe('')
  })
})
