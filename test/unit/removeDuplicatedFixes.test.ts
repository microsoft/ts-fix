import { CodeFixAction, DiagnosticCategory } from "typescript";
import { expect, test } from "vitest";
import { FixAndDiagnostic, removeDuplicatedFixes } from "../../src";

//This test is probably not be too effective since splice is being used
function makeCodeFix(fixName: string, start: number, length: number): CodeFixAction {
    return {
        fixName: fixName,
        description: 'fix description goes here',
        changes: [{ fileName: '', textChanges: [{ span: { start: start, length: length }, newText: 'override ' }] }],
        commands: undefined,
        fixId: fixName
    }
}

function makeFixAndDiagnostic(codefix: CodeFixAction, messageText: string): FixAndDiagnostic {
    return {
        fix: codefix,
        diagnostic: {
            category: 1,
            code: 324,
            file: undefined,
            start: undefined,
            length: undefined,
            messageText: {
                messageText: messageText,
                category: DiagnosticCategory.Error,
                code: 233
            },
        }
    }
}

test("removeDuplicatedFixes_twoEqualFixes", () => {
    const fixesAndDiagnostics: FixAndDiagnostic[] = [];
    const codefixes = [makeCodeFix('fixOverrideModifier', 165, 0), makeCodeFix('fixOverrideModifier', 165, 0)];
    codefixes.forEach((codefix) => {
        fixesAndDiagnostics.push(makeFixAndDiagnostic(codefix, 'codefix'));
    })
    const result = removeDuplicatedFixes(fixesAndDiagnostics);
    expect(result).toEqual(fixesAndDiagnostics);
});

test("removeDuplicatedFixes_threeEqualFixes", () => {
    const fixesAndDiagnostics: FixAndDiagnostic[] = [];
    const codefixes = [makeCodeFix('fixOverrideModifier', 165, 0), makeCodeFix('fixOverrideModifier', 165, 0), makeCodeFix('fixOverrideModifier', 165, 0)];
    codefixes.forEach((codefix) => {
        fixesAndDiagnostics.push(makeFixAndDiagnostic(codefix, 'codefix'));
    })
    const result = removeDuplicatedFixes(fixesAndDiagnostics);
    expect(result).toEqual(fixesAndDiagnostics);
});

test("removeDuplicatedFixes_manyEqualFixes", () => {
    const fixesAndDiagnostics: FixAndDiagnostic[] = [];
    let i = 0;
    while (i < 10) {
        fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('fixOverrideModifier', 165, 0), 'codefix'));
        i++;
    }
    const result = removeDuplicatedFixes(fixesAndDiagnostics);
    expect(result).toEqual(fixesAndDiagnostics);
});

test("removeDuplicatedFixes_allDifferentFixes", () => {
    const fixesAndDiagnostics: FixAndDiagnostic[] = [];
    const codefixes = [makeCodeFix('fixOverrideModifier', 165, 0), makeCodeFix('addConvertToUnknownForNonOverlappingTypes', 8, 9), makeCodeFix('fixOverrideModifier', 165, 0),
    makeCodeFix('addConvertToUnknownForNonOverlappingTypes', 9, 64), makeCodeFix('addConvertToUnknownForNonOverlappingTypes', 40, 73)];
    codefixes.forEach((codefix) => {
        fixesAndDiagnostics.push(makeFixAndDiagnostic(codefix, 'codefix'));
    })
    const result = removeDuplicatedFixes(fixesAndDiagnostics);
    expect(result).toEqual(fixesAndDiagnostics);
});

test("removeDuplicatedFixes_twoEqualFixesAndOneDifferent", () => {
    const fixesAndDiagnostics: FixAndDiagnostic[] = [];
    const codefixes = [makeCodeFix('fixOverrideModifier', 165, 0), makeCodeFix('addConvertToUnknownForNonOverlappingTypes', 8, 9), makeCodeFix('fixOverrideModifier', 165, 0)];
    codefixes.forEach((codefix) => {
        fixesAndDiagnostics.push(makeFixAndDiagnostic(codefix, 'codefix'));
    })
    const result = removeDuplicatedFixes(fixesAndDiagnostics);
    expect(result).toEqual(fixesAndDiagnostics);
});

test("removeDuplicatedFixes_someDifferentAndSomeDuplicatedFixes", () => {
    const fixesAndDiagnostics: FixAndDiagnostic[] = [];
    const codefixes = [makeCodeFix('fixOverrideModifier', 165, 0), makeCodeFix('addConvertToUnknownForNonOverlappingTypes', 9, 64),
    makeCodeFix('fixOverrideModifier', 165, 0), makeCodeFix('fixOverrideModifier', 165, 0),
    makeCodeFix('fixOverrideModifier', 165, 0), makeCodeFix('addConvertToUnknownForNonOverlappingTypes', 8, 9),
    makeCodeFix('fixOverrideModifier', 165, 0), makeCodeFix('fixOverrideModifier', 165, 0), makeCodeFix('addConvertToUnknownForNonOverlappingTypes', 40, 73),
    makeCodeFix('fixOverrideModifier', 165, 0)];
    codefixes.forEach((codefix) => {
        fixesAndDiagnostics.push(makeFixAndDiagnostic(codefix, 'codefix'));
    })
    const result = removeDuplicatedFixes(fixesAndDiagnostics);
    expect(result).toEqual(fixesAndDiagnostics);
});