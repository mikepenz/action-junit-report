import { parseFile, Transformer } from '../src/testParser';
import { readTransformers } from '../src/utils';

/**
 *   Copyright 2022 Mike Penz
 */
jest.setTimeout(10000)

describe('readTransformers', () => {
    it('should successfully parse default transformer', async () => {
        const transformer = readTransformers('[{"searchValue":"::","replaceValue":"/"}]')
        expect(transformer).toStrictEqual([
            {
              searchValue: "::",
              replaceValue: "/",
            }
        ]);
    })

    it('should successfully parse custom transformer', async () => {
        const transformer = readTransformers('[{"searchValue":"\\\\.","replaceValue":"/"},{"searchValue":"_t\\\\z","replaceValue":".t"}]')
        expect(transformer).toStrictEqual([
            {
              searchValue: "\\.",
              replaceValue: "/",
            },
            {
              searchValue: "_t\\z",
              replaceValue: ".t",
            },
        ]);
    })
})