import { CodeFixAction, DiagnosticCategory } from "typescript";
import { Choices, FixAndDiagnostic, removeMultipleDiagnostics } from "../../src";

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

function makeFixAndDiagnostic(codefix: CodeFixAction, code: number, lenght: number, start: number): FixAndDiagnostic {
    return {
        fix: codefix,
        diagnostic: {
            category: 1,
            code: code,
            file: undefined,
            start: start,
            length: lenght,
            messageText: {
                messageText: '',
                category: DiagnosticCategory.Error,
                code: 233
            },
        }
    }
}

test("removeDuplicatedFixes_twoEqualDiagnostics", () => {
    const fixesAndDiagnostics: FixAndDiagnostic[] = [];
    const codefixes = [makeCodeFix('fixOverrideModifier', 165, 0), makeCodeFix('fixOverrideModifier', 165, 0)];
    codefixes.forEach((codefix) => {
        fixesAndDiagnostics.push(makeFixAndDiagnostic(codefix, 435, 4, 5));
    })
    const result = removeMultipleDiagnostics(fixesAndDiagnostics);
    expect(result).toEqual([fixesAndDiagnostics[0]]);
});

test("removeDuplicatedFixes_threeEqualDiagnostics", () => {
    const fixesAndDiagnostics: FixAndDiagnostic[] = [];
    const codefixes = [makeCodeFix('fixOverrideModifier', 165, 0), makeCodeFix('fixOverrideModifier', 165, 0), makeCodeFix('fixOverrideModifier', 165, 0)];
    codefixes.forEach((codefix) => {
        fixesAndDiagnostics.push(makeFixAndDiagnostic(codefix, 435, 4, 5));
    })
    const result = removeMultipleDiagnostics(fixesAndDiagnostics);
    expect(result).toEqual([fixesAndDiagnostics[0]]);
});

test("removeDuplicatedFixes_manyEqualDiagnostics", () => {
    const fixesAndDiagnostics: FixAndDiagnostic[] = [];
    let i = 0;
    while (i < 10) {
        fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('fixOverrideModifier', 165, 0), 435, 4, 5));
        i++;
    }
    const result = removeMultipleDiagnostics(fixesAndDiagnostics);
    expect(result).toEqual([fixesAndDiagnostics[0]]);
});

test("removeDuplicatedFixes_allDifferentDiagnostics", () => {
    const fixesAndDiagnostics: FixAndDiagnostic[] = [];
    const codefixes = [makeCodeFix('fixOverrideModifier', 165, 0), makeCodeFix('addConvertToUnknownForNonOverlappingTypes', 8, 9), makeCodeFix('fixOverrideModifier', 165, 0),
    makeCodeFix('addConvertToUnknownForNonOverlappingTypes', 9, 64), makeCodeFix('addConvertToUnknownForNonOverlappingTypes', 40, 73)];
    fixesAndDiagnostics.push(makeFixAndDiagnostic(codefixes[0], 435, 4, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(codefixes[1], 455, 4, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(codefixes[2], 4333, 5, 64));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(codefixes[3], 764, 7, 64));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(codefixes[4], 422, 2, 544));
    const result = removeMultipleDiagnostics(fixesAndDiagnostics);
    expect(result).toEqual(fixesAndDiagnostics);
});

test("removeDuplicatedFixes_twoEqualDiagnosticsAndOneDifferent", () => {
    const fixesAndDiagnostics: FixAndDiagnostic[] = [];
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('fixOverrideModifier', 165, 0), 435, 4, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('addConvertToUnknownForNonOverlappingTypes', 8, 9), 543, 4, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('fixOverrideModifier', 165, 0), 435, 4, 5));
    const result = removeMultipleDiagnostics(fixesAndDiagnostics);
    expect(result).toEqual(fixesAndDiagnostics);
});

test("removeDuplicatedFixes_someDifferentAndSomeDuplicatedDiagnostics", () => {
    const fixesAndDiagnostics: FixAndDiagnostic[] = [];
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('fixOverrideModifier', 165, 0), 435, 4, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('addConvertToUnknownForNonOverlappingTypes', 9, 64), 435, 4, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('fixOverrideModifier', 165, 0), 543, 4, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('fixOverrideModifier', 165, 0), 435, 4, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('fixOverrideModifier', 165, 0), 543, 4, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('addConvertToUnknownForNonOverlappingTypes', 8, 9), 765, 4, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('fixOverrideModifier', 165, 0), 435, 4, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('fixOverrideModifier', 165, 0), 435, 4, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('addConvertToUnknownForNonOverlappingTypes', 40, 73), 765, 44, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('fixOverrideModifier', 165, 0), 435, 4, 5));
    const result = removeMultipleDiagnostics(fixesAndDiagnostics);
    expect(result).toEqual(fixesAndDiagnostics);
});

test("removeDuplicatedFixes_acceptOneOutofOne", () => {
    const fixesAndDiagnostics: FixAndDiagnostic[] = [];
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('fixOverrideModifier', 165, 0), 435, 4, 5));
    const result = removeMultipleDiagnostics(fixesAndDiagnostics, Choices.ACCEPT);
    expect(result).toEqual(fixesAndDiagnostics);
});


test("removeDuplicatedFixes_acceptAllTheSameCode", () => {
    const fixesAndDiagnostics: FixAndDiagnostic[] = [];
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('fixOverrideModifier', 165, 0), 435, 4, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('addConvertToUnknownForNonOverlappingTypes', 9, 64), 435, 4, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('fixOverrideModifier', 165, 0), 435, 4, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('fixOverrideModifier', 165, 0), 435, 6, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('fixOverrideModifier', 165, 0), 435, 4, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('addConvertToUnknownForNonOverlappingTypes', 8, 9), 435, 9, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('fixOverrideModifier', 165, 0), 435, 4, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('fixOverrideModifier', 165, 0), 435, 4, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('addConvertToUnknownForNonOverlappingTypes', 40, 73), 435, 44, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(makeCodeFix('fixOverrideModifier', 165, 0), 435, 4, 5));
    const result = removeMultipleDiagnostics(fixesAndDiagnostics, Choices.ACCEPT);
    expect(result).toEqual(fixesAndDiagnostics);
});

test("removeDuplicatedFixes_allTheSameCode", () => {
    const fixesAndDiagnostics: FixAndDiagnostic[] = [];
    const codefixes = [makeCodeFix('fixOverrideModifier', 165, 0), makeCodeFix('addConvertToUnknownForNonOverlappingTypes', 9, 64),
    makeCodeFix('fixOverrideModifier', 165, 0), makeCodeFix('fixOverrideModifier', 165, 0),
    makeCodeFix('fixOverrideModifier', 165, 0)];
    fixesAndDiagnostics.push(makeFixAndDiagnostic(codefixes[0], 435, 4, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(codefixes[1], 543, 4, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(codefixes[2], 545, 4, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(codefixes[3], 435, 6, 5));
    fixesAndDiagnostics.push(makeFixAndDiagnostic(codefixes[4], 212, 4, 5));
    const result = removeMultipleDiagnostics(fixesAndDiagnostics, Choices.ACCEPT);
    expect(result).toEqual(fixesAndDiagnostics);
});
