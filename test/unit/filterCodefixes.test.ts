import { ChangedFile, filterCodeFixesByFixName, FixAndDiagnostic } from "../../src/index";
import { CodeFixAction, DiagnosticCategory } from "typescript";
import { createProject } from "../../src/ts";

const codefixes: CodeFixAction[] = [
    {
        fixName: 'fixOverrideModifier',
        description: 'Add \'override\' modifier',
        changes: [{ fileName: 'C:/Users/t-isabelduan/Project/ts-codefix-api-example/test-project/index.ts', textChanges: [{ span: { start: 165, length: 0 }, newText: 'override ' }] }],
        commands: undefined,
        fixId: 'fixAddOverrideModifier'
    },
    {
        fixName: 'fixOverrideModifier',
        description: 'Add \'override\' modifier',
        changes: [{ fileName: 'C:/Users/t-isabelduan/Project/ts-codefix-api-example/test-project/index.ts', textChanges: [{ span: { start: 244, length: 0 }, newText: 'override ' }] }],
        commands: undefined,
        fixId: 'fixAddOverrideModifier'
    },
    {
        fixName: 'addConvertToUnknownForNonOverlappingTypes',
        description: 'Add \'unknown\' conversion for non-overlapping types',
        changes: [{ fileName:  'C:/Users/t-isabelduan/Project/ts-codefix-api-example/test-project/index2.ts', textChanges: [{ span: { start: 8, length: 9 }, newText: '<unknown>["words"]' }] }],
        commands: undefined,
        fixId: 'addConvertToUnknownForNonOverlappingTypes'
    },
    {
        fixName: 'addConvertToUnknownForNonOverlappingTypes',
        description: 'Add \'unknown\' conversion for non-overlapping types',
        changes: [{ fileName: 'C:/Users/t-isabelduan/Project/ts-codefix-api-example/test-project/index2.ts', textChanges: [{ span: { start: 30, length: 7 }, newText: '<unknown>"words"' }] }],
        commands: undefined,
        fixId: 'addConvertToUnknownForNonOverlappingTypes'
    },
    {
        fixName: 'addConvertToUnknownForNonOverlappingTypes',
        description: 'Add \'unknown\' conversion for non-overlapping types',
        changes: [{ fileName:  'C:/Users/t-isabelduan/Project/ts-codefix-api-example/test-project/index2.ts', textChanges: [{ span: { start: 50, length: 1 }, newText: '<unknown>0' }] }],
        commands: undefined,
        fixId: 'addConvertToUnknownForNonOverlappingTypes'
    }
]

const fixesAndDiagnostics: FixAndDiagnostic[] = [];

codefixes.forEach((codefix) => {
    fixesAndDiagnostics.push({
        fix: codefix, diagnostic: 
         {
            category: DiagnosticCategory.Error,
            code: 322,
            file: undefined,
            start: 233,
            length: 10,
            messageText: 'test'
        }
    });
})

test("filterCodeFixesByFixName_noNamesPassedIn", () => {
    const opt = [];
    // empty argument behavior... currently, we just keep all fixes if none are specified
    const result = filterCodeFixesByFixName(fixesAndDiagnostics, opt);
    expect(result[0]).toEqual(fixesAndDiagnostics);
    expect(result[1]).toEqual(["Found 5 codefixes"]);
})


test("filterCodeFixesByFixName_allNamesPassedIn", () => {
    const result = filterCodeFixesByFixName(fixesAndDiagnostics, ['fixOverrideModifier', 'addConvertToUnknownForNonOverlappingTypes']);
    expect(result[0]).toEqual(fixesAndDiagnostics);
    expect(result[1]).toEqual([
        "Found 2 codefixes with name fixOverrideModifier",
        "Found 3 codefixes with name addConvertToUnknownForNonOverlappingTypes"
    ])
})

test("filterCodeFixesByFixName_singleStringPassedIn", () => {
    const result = filterCodeFixesByFixName(fixesAndDiagnostics, ['fixOverrideModifier']);
    expect(result[0]).toEqual(fixesAndDiagnostics.slice(0, 2));
    expect(result[1]).toEqual([
        "Found 2 codefixes with name fixOverrideModifier"])
})

test("filterCodeFixesByFixName_singleStringListPassedIn", () => {
    const result = filterCodeFixesByFixName(fixesAndDiagnostics, ['addConvertToUnknownForNonOverlappingTypes']);
    expect(result[0]).toEqual(fixesAndDiagnostics.slice(2, 5));
    expect(result[1]).toEqual([
        "Found 3 codefixes with name addConvertToUnknownForNonOverlappingTypes"
    ])
})

test("filterCodeFixesByFixName_noMatch", () => {
    const result = filterCodeFixesByFixName(fixesAndDiagnostics, ['add']);
    expect(result[0]).toEqual([]);
    expect(result[1]).toEqual(["No codefixes found with name add"]);
})

test("filterCodeFixesByFixName_noAndSomeMatch", () => {
    const result = filterCodeFixesByFixName(fixesAndDiagnostics, ['fixOverrideModifier', 'add']);
    expect(result[0]).toEqual(fixesAndDiagnostics.slice(0, 2));
    expect(result[1]).toEqual([
        "Found 2 codefixes with name fixOverrideModifier",
        "No codefixes found with name add"]);
})