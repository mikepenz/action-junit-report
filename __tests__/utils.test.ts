import {readTransformers} from '../src/utils.js'

/**
 *   Copyright 2024 Mike Penz
 */
jest.setTimeout(30000)

describe('readTransformers', () => {
  it('should successfully parse default transformer', async () => {
    const transformer = readTransformers('[{"searchValue":"::","replaceValue":"/"}]')
    expect(transformer).toStrictEqual([
      {
        regex: /::/gu,
        searchValue: '::',
        replaceValue: '/'
      }
    ])
  })

  it('should successfully parse custom transformer', async () => {
    const transformer = readTransformers(
      '[{"searchValue":"\\\\.","replaceValue":"/"},{"searchValue":"_t\\\\z","replaceValue":".t"}]'
    )
    expect(transformer).toStrictEqual([
      {
        regex: /\./gu,
        searchValue: '\\.',
        replaceValue: '/'
      },
      {
        searchValue: '_t\\z',
        replaceValue: '.t'
      }
    ])
  })
})
