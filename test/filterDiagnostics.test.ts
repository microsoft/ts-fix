import { Options, filterDiagnosticsByErrorCode } from "../src/index";
import { CodeFixAction, Diagnostic, SourceFile } from "typescript";
import {makeOptions} from "../src/cli";

const default_opt = makeOptions(process.cwd(), {});
function makeDiagnostic(code:number, file?: SourceFile):Diagnostic {
    return {
        category: 1,
        code: code,
        file: file,
        start: undefined,
        length: undefined,
        messageText: undefined
    }
}

test("filterDiagnostics_noErrorsInOpt_oneFile", () => {
    const originalDiagnostics = [[makeDiagnostic(111), makeDiagnostic(222), makeDiagnostic(333)]];
    const results = filterDiagnosticsByErrorCode(originalDiagnostics, default_opt);
    expect(results[0]).toEqual(originalDiagnostics);
    expect(results[1]).toEqual(["found 3 diagnostics in 1 files"]);

    const diagnosticsRepeatedError = [[makeDiagnostic(111), makeDiagnostic(333), makeDiagnostic(111)]];
    const resultsRepeatedError = filterDiagnosticsByErrorCode(diagnosticsRepeatedError, default_opt);
    expect(resultsRepeatedError[0]).toEqual(diagnosticsRepeatedError);
    expect(resultsRepeatedError[1]).toEqual(["found 3 diagnostics in 1 files"]);
})

test("filterDiagnostics_noErrorsInOpt_multiFiles", () => {
    const originalDiagnostics = [[makeDiagnostic(111), makeDiagnostic(222), makeDiagnostic(333)],
        [makeDiagnostic(444), makeDiagnostic(444), makeDiagnostic(111)]];
    const results = filterDiagnosticsByErrorCode(originalDiagnostics, default_opt);
    expect(results[0]).toEqual(originalDiagnostics);
    expect(results[1]).toEqual(["found 6 diagnostics in 2 files"]);

    const diagnosticsRepeatedFile = [[makeDiagnostic(111), makeDiagnostic(222), makeDiagnostic(333)],
        [makeDiagnostic(111), makeDiagnostic(222), makeDiagnostic(333)],
        [makeDiagnostic(444), makeDiagnostic(444)]];
    const resultsRepeatedFile = filterDiagnosticsByErrorCode(diagnosticsRepeatedFile, default_opt);
    expect(resultsRepeatedFile[0]).toEqual(diagnosticsRepeatedFile);
    expect(resultsRepeatedFile[1]).toEqual(["found 8 diagnostics in 3 files"]);
})


test("filterDiagnostics_oneErrorInOpt_oneFile", () => {
    const opt_error111 = makeOptions(process.cwd(), {e:111});
    const opt_error333 = makeOptions(process.cwd(), {e:333});

    const originalDiagnostics = [[makeDiagnostic(111), makeDiagnostic(222), makeDiagnostic(333)]];
    const results111 = filterDiagnosticsByErrorCode(originalDiagnostics, opt_error111);
    expect(results111[0]).toEqual([[makeDiagnostic(111)]]);
    expect(results111[1]).toEqual(["found 1 diagnostics with code 111"]);

    const results333 = filterDiagnosticsByErrorCode(originalDiagnostics, opt_error333);
    expect(results333[0]).toEqual([[makeDiagnostic(333)]]);
    expect(results333[1]).toEqual(["found 1 diagnostics with code 333"]);

    const diagnosticsRepeatedError = [[makeDiagnostic(111), makeDiagnostic(333), makeDiagnostic(111)]];
    const resultsRepeatedError = filterDiagnosticsByErrorCode(diagnosticsRepeatedError, opt_error111);
    expect(resultsRepeatedError[0]).toEqual([[makeDiagnostic(111),makeDiagnostic(111)]]);
    expect(resultsRepeatedError[1]).toEqual(["found 2 diagnostics with code 111"]);

    const resultsRepeatedError333 = filterDiagnosticsByErrorCode(diagnosticsRepeatedError, opt_error333);
    expect(resultsRepeatedError333[0]).toEqual([[makeDiagnostic(333)]]);
    expect(resultsRepeatedError333[1]).toEqual(["found 1 diagnostics with code 333"]);
})

test("filterDiagnostics_oneErrorInOptNotFoundInOneFile", () => {
    const opt_error111 = makeOptions(process.cwd(), {e:111});
    const originalDiagnostics = [[makeDiagnostic(222), makeDiagnostic(222), makeDiagnostic(333)]];

    const results = filterDiagnosticsByErrorCode(originalDiagnostics, opt_error111);
    expect(results[0]).toEqual([]);
    expect(results[1]).toEqual(["no diagnostics found with codes 111"]);
})

