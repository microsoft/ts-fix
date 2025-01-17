import {  getTextChangeDict } from "../../src/index";
import { CodeFixAction } from "typescript";

const codefixes: CodeFixAction[] = [
    {
        fixName: 'fixOverrideModifier',
        description: 'Add \'override\' modifier',
        changes: [{ fileName: 'foo.ts', textChanges: [{ span: { start: 2, length: 0 }, newText: 'override ' }, { span: { start: 3, length: 0 }, newText: 'override ' }] }],
        commands: undefined,
        fixId: 'fixAddOverrideModifier'
    },
    {
        fixName: 'fixOverrideModifier',
        description: 'Add \'override\' modifier',
        changes: [{ fileName: 'foo.ts', textChanges: [{ span: { start: 1, length: 0 }, newText: 'override ' }] }],
        commands: undefined,
        fixId: 'fixAddOverrideModifier'
    },
    {
        fixName: 'addConvertToUnknownForNonOverlappingTypes',
        description: 'Add \'unknown\' conversion for non-overlapping types',
        changes: [{ fileName:  'foo.ts', textChanges: [{ span: { start: 8, length: 9 }, newText: '<unknown>["words"]' }] }],
        commands: undefined,
        fixId: 'addConvertToUnknownForNonOverlappingTypes'
    },
]

test("should merge text changes in order", () => {
    const result = getTextChangeDict(codefixes);
    const changes = result.get('foo.ts');
    const spanStarts = changes?.map(c => c.span.start);
    expect(spanStarts).toEqual([1, 2, 3, 8]);
})

