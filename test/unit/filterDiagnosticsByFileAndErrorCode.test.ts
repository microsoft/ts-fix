import { Diagnostic, DiagnosticCategory, SourceFile } from "typescript";
import { filterDiagnosticsByFileAndErrorCode } from "../../src";

const default_codes = [];

function makeDiagnostic(code: number, fileName?: string, file?: SourceFile): Diagnostic {
    return {
        category: 1,
        code: code,
        file: file ? {
            ...file,
            fileName: fileName ? fileName : "",
        } : undefined,
        start: undefined,
        length: undefined,
        messageText: {
            messageText: "",
            category: DiagnosticCategory.Error,
            code: 233
        }

    }
}

test("filterDiagnosticsByFileAndErrorCode_noErrorsInOpt_noPaths", () => {
    const originalDiagnostics = [[makeDiagnostic(111), makeDiagnostic(222), makeDiagnostic(333)]];
    const validFiles = [];
    const results = filterDiagnosticsByFileAndErrorCode(originalDiagnostics, default_codes, validFiles);
    expect(results[0]).toEqual(originalDiagnostics);
    expect(results[1]).toEqual(["Found 3 diagnostics in 1 files"]);
})

// test("filterDiagnosticsByFileAndErrorCode_noErrorsInOpt_OnePathNoMathchingFiles", () => {
//     const originalDiagnostics = [[makeDiagnostic(111, "a.ts", sourceFile), makeDiagnostic(222, "a.ts", sourceFile), makeDiagnostic(333, "a.ts", sourceFile)]];
//     const validFiles = ["b.ts"];
//     const results = filterDiagnosticsByFileAndErrorCode(originalDiagnostics, default_codes, validFiles);
//     expect(results[0]).toEqual([]);
//     expect(results[1]).toEqual(["No diagnostics found for files"]);
// })

test("filterDiagnosticsByFileAndErrorCode_noErrorsInOpt_oneFile", () => {
    const originalDiagnostics = [[makeDiagnostic(111), makeDiagnostic(222), makeDiagnostic(333)]];
    const results = filterDiagnosticsByFileAndErrorCode(originalDiagnostics, default_codes);
    expect(results[0]).toEqual(originalDiagnostics);
    expect(results[1]).toEqual(["Found 3 diagnostics in 1 files"]);

    const diagnosticsRepeatedError = [[makeDiagnostic(111), makeDiagnostic(333), makeDiagnostic(111)]];
    const resultsRepeatedError = filterDiagnosticsByFileAndErrorCode(diagnosticsRepeatedError, default_codes);
    expect(resultsRepeatedError[0]).toEqual(diagnosticsRepeatedError);
    expect(resultsRepeatedError[1]).toEqual(["Found 3 diagnostics in 1 files"]);
})

// test("filterDiagnosticsByFileAndErrorCode_noErrorsInOpt_oneValidFilePath", () => {
//     const originalDiagnostics = [[makeDiagnostic(111, "a.ts", sourceFile), makeDiagnostic(222, "a.ts", sourceFile), makeDiagnostic(333, "a.ts", sourceFile)]];
//     const validFiles = ["a.ts"];
//     const results = filterDiagnosticsByFileAndErrorCode(originalDiagnostics, default_codes, validFiles);
//     expect(results[0]).toEqual(originalDiagnostics);
//     expect(results[1]).toEqual(["Found 3 diagnostics for the given files"]);
// })

test("filterDiagnosticsByFileAndErrorCode_noErrorsInOpt_multiFiles", () => {
    const originalDiagnostics = [[makeDiagnostic(111), makeDiagnostic(222), makeDiagnostic(333)],
    [makeDiagnostic(444), makeDiagnostic(444), makeDiagnostic(111)]];
    const results = filterDiagnosticsByFileAndErrorCode(originalDiagnostics, default_codes);
    expect(results[0]).toEqual(originalDiagnostics);
    expect(results[1]).toEqual(["Found 6 diagnostics in 2 files"]);

    const diagnosticsRepeatedFile = [[makeDiagnostic(111), makeDiagnostic(222), makeDiagnostic(333)],
    [makeDiagnostic(111), makeDiagnostic(222), makeDiagnostic(333)],
    [makeDiagnostic(444), makeDiagnostic(444)]];
    const resultsRepeatedFile = filterDiagnosticsByFileAndErrorCode(diagnosticsRepeatedFile, default_codes);
    expect(resultsRepeatedFile[0]).toEqual(diagnosticsRepeatedFile);
    expect(resultsRepeatedFile[1]).toEqual(["Found 8 diagnostics in 3 files"]);
})

// test("filterDiagnosticsByFileAndErrorCode_noErrorsInOpt_oneValidFilePathForMultiFiles", () => {
//     const originalDiagnostics = [[makeDiagnostic(111, "a.ts", sourceFile), makeDiagnostic(222, "a.ts", sourceFile), makeDiagnostic(333, "a.ts", sourceFile)],
//     [makeDiagnostic(444, "b.ts", sourceFile), makeDiagnostic(444, "b.ts", sourceFile), makeDiagnostic(111, "b.ts", sourceFile)]];
//     const validFiles = ["a.ts"];
//     const updatedDiagnostics = [[makeDiagnostic(111, "a.ts", sourceFile), makeDiagnostic(222, "a.ts", sourceFile), makeDiagnostic(333, "a.ts", sourceFile)]];
//     const results = filterDiagnosticsByFileAndErrorCode(originalDiagnostics, default_codes, validFiles);
//     expect(results[0]).toEqual(updatedDiagnostics);
//     expect(results[1]).toEqual(["Found 3 diagnostics for the given files"]);
// })

test("filterDiagnosticsByFileAndErrorCode_oneErrorInOpt_oneFile", () => {
    const originalDiagnostics = [[makeDiagnostic(111), makeDiagnostic(222), makeDiagnostic(333)]];
    const results111 = filterDiagnosticsByFileAndErrorCode(originalDiagnostics, [111]);
    expect(results111[0]).toEqual([[makeDiagnostic(111)]]);
    expect(results111[1]).toEqual(["Found 1 diagnostics with code 111"]);

    const results333 = filterDiagnosticsByFileAndErrorCode(originalDiagnostics, [333]);
    expect(results333[0]).toEqual([[makeDiagnostic(333)]]);
    expect(results333[1]).toEqual(["Found 1 diagnostics with code 333"]);

    const diagnosticsRepeatedError = [[makeDiagnostic(111), makeDiagnostic(333), makeDiagnostic(111)]];
    const resultsRepeatedError = filterDiagnosticsByFileAndErrorCode(diagnosticsRepeatedError, [111]);
    expect(resultsRepeatedError[0]).toEqual([[makeDiagnostic(111), makeDiagnostic(111)]]);
    expect(resultsRepeatedError[1]).toEqual(["Found 2 diagnostics with code 111"]);

    const resultsRepeatedError333 = filterDiagnosticsByFileAndErrorCode(diagnosticsRepeatedError, [333]);
    expect(resultsRepeatedError333[0]).toEqual([[makeDiagnostic(333)]]);
    expect(resultsRepeatedError333[1]).toEqual(["Found 1 diagnostics with code 333"]);
})

// test("filterDiagnosticsByFileAndErrorCode_oneErrorInOpt_oneFilePathAndOneFile", () => {
//     const originalDiagnostics = [[makeDiagnostic(111, "a.ts", sourceFile), makeDiagnostic(222, "a.ts", sourceFile), makeDiagnostic(333, "a.ts", sourceFile)]];
//     const validFiles111 = ["a.ts"];
//     const results111 = filterDiagnosticsByFileAndErrorCode(originalDiagnostics, [111], validFiles111);
//     expect(results111[0]).toEqual([[makeDiagnostic(111, "a.ts", sourceFile)]]);
//     expect(results111[1]).toEqual(["Found 3 diagnostics for the given files", "Found 1 diagnostics with code 111"]);

//     const validFiles333 = ["a.ts"];
//     const results333 = filterDiagnosticsByFileAndErrorCode(originalDiagnostics, [333], validFiles333);
//     expect(results333[0]).toEqual([[makeDiagnostic(333, "a.ts", sourceFile)]]);
//     expect(results333[1]).toEqual(["Found 3 diagnostics for the given files", "Found 1 diagnostics with code 333"]);

//     const validFilesRepeatedError = ["a.ts"];
//     const diagnosticsRepeatedError = [[makeDiagnostic(111, "a.ts", sourceFile), makeDiagnostic(333, "a.ts", sourceFile), makeDiagnostic(111, "a.ts", sourceFile)]];
//     const resultsRepeatedError = filterDiagnosticsByFileAndErrorCode(diagnosticsRepeatedError, [111], validFilesRepeatedError);
//     expect(resultsRepeatedError[0]).toEqual([[makeDiagnostic(111, "a.ts", sourceFile), makeDiagnostic(111, "a.ts", sourceFile)]]);
//     expect(resultsRepeatedError[1]).toEqual(["Found 3 diagnostics for the given files", "Found 2 diagnostics with code 111"]);

//     const validFiles333RepeatedError = ["a.ts"];
//     const resultsRepeatedError333 = filterDiagnosticsByFileAndErrorCode(diagnosticsRepeatedError, [333], validFiles333RepeatedError);
//     expect(resultsRepeatedError333[0]).toEqual([[makeDiagnostic(333, "a.ts", sourceFile)]]);
//     expect(resultsRepeatedError333[1]).toEqual(["Found 3 diagnostics for the given files", "Found 1 diagnostics with code 333"]);
// });

test("filterDiagnosticsByFileAndErrorCode_oneErrorInOptNotFoundInOneFile", () => {
    const originalDiagnostics = [[makeDiagnostic(222), makeDiagnostic(222), makeDiagnostic(333)]];
    const results = filterDiagnosticsByFileAndErrorCode(originalDiagnostics, [111]);
    expect(results[0]).toEqual([]);
    expect(results[1]).toEqual(["No diagnostics found with code 111"]);
});

test("filterDiagnosticsByFileAndErrorCode_manyErrorInOptNotFoundInOneFile", () => {
    const originalDiagnostics = [[makeDiagnostic(222), makeDiagnostic(222), makeDiagnostic(333)]];
    const results = filterDiagnosticsByFileAndErrorCode(originalDiagnostics, [111, 999]);
    expect(results[0]).toEqual([]);
    expect(results[1]).toEqual(["No diagnostics found with code 111", "No diagnostics found with code 999"]);
});

// test("filterDiagnosticsByFileAndErrorCode_manyErrorInOptNotFoundInOneFileAndOneValidFilePath", () => {
//     const originalDiagnostics = [[makeDiagnostic(222, "a.ts", sourceFile), makeDiagnostic(222, "a.ts", sourceFile), makeDiagnostic(333, "a.ts", sourceFile)]];
//     const validFiles = ["a.ts"]
//     const results = filterDiagnosticsByFileAndErrorCode(originalDiagnostics, [111, 999], validFiles);
//     expect(results[0]).toEqual([]);
//     expect(results[1]).toEqual(["Found 3 diagnostics for the given files", "No diagnostics found with code 111", "No diagnostics found with code 999"]);
// })

test("filterDiagnosticsByFileAndErrorCode_oneErrorInOptNotFoundInManyFiles", () => {
    const originalDiagnostics = [[makeDiagnostic(222), makeDiagnostic(222), makeDiagnostic(333)],
    [makeDiagnostic(444), makeDiagnostic(444), makeDiagnostic(777)],
    [makeDiagnostic(777), makeDiagnostic(222), makeDiagnostic(777)],
    [makeDiagnostic(333), makeDiagnostic(222)]];
    const results = filterDiagnosticsByFileAndErrorCode(originalDiagnostics, [111]);
    expect(results[0]).toEqual([]);
    expect(results[1]).toEqual(["No diagnostics found with code 111"]);
})

// test("filterDiagnosticsByFileAndErrorCode_oneErrorInOptNotFoundInManyFilesAndTwoValidFilePaths", () => {
//     const originalDiagnostics = [[makeDiagnostic(222, "a.ts", sourceFile), makeDiagnostic(222, "a.ts", sourceFile), makeDiagnostic(333, "a.ts", sourceFile)],
//     [makeDiagnostic(444), makeDiagnostic(444), makeDiagnostic(777)],
//     [makeDiagnostic(777, "b.ts", sourceFile), makeDiagnostic(222, "b.ts", sourceFile), makeDiagnostic(777, "b.ts", sourceFile)],
//     [makeDiagnostic(333), makeDiagnostic(222)]];
//     const validFiles = ["a.ts", "b.ts"];
//     const results = filterDiagnosticsByFileAndErrorCode(originalDiagnostics, [111], validFiles);
//     expect(results[0]).toEqual([]);
//     expect(results[1]).toEqual(["Found 6 diagnostics for the given files", "No diagnostics found with code 111"]);
// });

test("filterDiagnosticsByFileAndErrorCode_oneErrorInOptSomeFoundInManyFiles", () => {
    const originalDiagnostics = [[makeDiagnostic(222, "f1"), makeDiagnostic(111, "f1"), makeDiagnostic(333, "f1")],
    [makeDiagnostic(444, "f2"), makeDiagnostic(444, "f2"), makeDiagnostic(777, "f2")],
    [makeDiagnostic(777, "f3"), makeDiagnostic(222, "f3"), makeDiagnostic(777, "f3")],
    [makeDiagnostic(333, "f4"), makeDiagnostic(222, "f4")],
    [makeDiagnostic(111, "f5"), makeDiagnostic(222, "f5"), makeDiagnostic(333, "f5")],
    [makeDiagnostic(222, "f6"), makeDiagnostic(111, "f6"), makeDiagnostic(111, "f6")],
    [makeDiagnostic(444, "f7"), makeDiagnostic(444, "f7")],
    [makeDiagnostic(111, "f8")]];
    const results = filterDiagnosticsByFileAndErrorCode(originalDiagnostics, [111]);
    expect(results[0]).toEqual([[makeDiagnostic(111, "f1")],
    [makeDiagnostic(111, "f5")],
    [makeDiagnostic(111, "f6"), makeDiagnostic(111, "f6")],
    [makeDiagnostic(111, "f8")]]);
    expect(results[1]).toEqual(["Found 5 diagnostics with code 111"]);
});

// test("filterDiagnosticsByFileAndErrorCode_oneErrorInOptSomeFoundInManyFilesAndManyFilePaths", () => {
//     const originalDiagnostics = [[makeDiagnostic(222, "f1", sourceFile), makeDiagnostic(111, "f1", sourceFile), makeDiagnostic(333, "f1", sourceFile)],
//     [makeDiagnostic(444, "f2", sourceFile), makeDiagnostic(444, "f2", sourceFile), makeDiagnostic(777, "f2", sourceFile)],
//     [makeDiagnostic(777, "f3", sourceFile), makeDiagnostic(222, "f3", sourceFile), makeDiagnostic(777, "f3", sourceFile)],
//     [makeDiagnostic(333, "f4", sourceFile), makeDiagnostic(222, "f4", sourceFile)],
//     [makeDiagnostic(111, "f5", sourceFile), makeDiagnostic(222, "f5", sourceFile), makeDiagnostic(333, "f5", sourceFile)],
//     [makeDiagnostic(222, "f6", sourceFile), makeDiagnostic(111, "f6", sourceFile), makeDiagnostic(111, "f6", sourceFile)],
//     [makeDiagnostic(444, "f7", sourceFile), makeDiagnostic(444, "f7", sourceFile)],
//     [makeDiagnostic(111, "f8", sourceFile)]];
//     const validFiles = ["f2", "f8", "f7", "f6"];
//     const results = filterDiagnosticsByFileAndErrorCode(originalDiagnostics, [111], validFiles);
//     expect(results[0]).toEqual([[makeDiagnostic(111, "f6", sourceFile), makeDiagnostic(111, "f6", sourceFile)],
//     [makeDiagnostic(111, "f8", sourceFile)]]);
//     expect(results[1]).toEqual(["Found 9 diagnostics for the given files", "Found 3 diagnostics with code 111"]);
// })