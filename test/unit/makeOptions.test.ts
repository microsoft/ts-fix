import path from "path";
import { expect, test } from "vitest";
import { makeOptions } from "../../src/cli";

// TODO: uhh the defult cwd may not nessssrily resolve to correct path on non windows
// TODO: the way to resolve above is never use absolute paths in any test. :(
test("makeOptions_empty_argv", () => {
    const cwd = __dirname;
    const createdOption = makeOptions(cwd, []);
    expect(createdOption.tsconfig).toEqual(path.resolve(cwd, "tsconfig.json"));
    expect(createdOption.outputFolder).toEqual(path.resolve(cwd));
    expect(createdOption.errorCode).toEqual([]);
    expect(createdOption.fixName).toEqual([]);
});

test("makeOptions_withOutputFolder", () => {
    const cwd = __dirname;
    const createdOption_partial = makeOptions(cwd, ["-o", "..\\DifferentOutput2"]);
    expect(createdOption_partial.outputFolder).toEqual(path.resolve(path.dirname(createdOption_partial.tsconfig), "..\\DifferentOutput2"));
});

test("makeOptions_errorCode_singleError", () => {
    const cwd = __dirname;
    const createdOption = makeOptions(cwd, ["-e", "1"]);
    expect(createdOption.errorCode).toEqual([1]);
})

test("makeOptions_errorCode_manyError", () => {
    const cwd = __dirname;
    const createdOption = makeOptions(cwd, ["-e", "0", "123", "41", "1"]);
    expect(createdOption.errorCode).toEqual([0, 123, 41, 1]);
})

test("makeOptions_fixName_singlefixName", () => {
    const cwd = __dirname;
    const createdOption = makeOptions(cwd, ["-f", "fixOverride"]);
    expect(createdOption.fixName).toEqual(["fixOverride"]);
})

test("makeOptions_fixName_manyfixName", () => {
    // these names aren't necessarily real errors
    const cwd = __dirname;
    const createdOption = makeOptions(cwd, ["-f", "fixOverride", "fixUnknown", "fixUndefined"]);
    expect(createdOption.fixName).toEqual(["fixOverride", "fixUnknown", "fixUndefined"]);
})

test("makeOptions_singleFilePaths", () => {
    const cwd = __dirname;
    const createdOption = makeOptions(cwd, ["--file", "..\\src\\index.ts"]);
    expect(createdOption.file).toEqual(["..\\src\\index.ts"]);
});


test("makeOptions_manyFilePaths", () => {
    const cwd = __dirname;
    const createdOption = makeOptions(cwd, ["--file", "..\\src\\index.ts", "..\\src\\cli.ts", "..\\src\\ts.ts"]);
    expect(createdOption.file).toEqual(["..\\src\\index.ts", "..\\src\\cli.ts", "..\\src\\ts.ts"]);
});

test("makeOptions_showMultiple", () => {
    const cwd = __dirname;
    const createdOption = makeOptions(cwd, ["--showMultiple"]);
    expect(createdOption.showMultiple).toEqual(true);
});

test("makeOptions_MutlipleOptions", () => {
    const cwd = __dirname;
    const createdOption = makeOptions(cwd, ["-f", "fixOverride", "--file", "..\\src\\index.ts", "--showMultiple", "--ignoreGitStatus"]);
    expect(createdOption.fixName).toEqual(["fixOverride"]);
    expect(createdOption.file).toEqual(["..\\src\\index.ts"]);
    expect(createdOption.showMultiple).toEqual(true);
    expect(createdOption.write).toEqual(false);
    expect(createdOption.ignoreGitStatus).toEqual(true);
});

test("makeOptions_MutlipleOptions1", () => {
    const cwd = __dirname;
    const createdOption = makeOptions(cwd, ["-f", "fixOverride", "--file", "..\\src\\index.ts", "..\\src\\cli.ts", "..\\src\\ts.ts", "--showMultiple", "-w", "-o", "..\\DifferentOutput2"]);
    expect(createdOption.fixName).toEqual(["fixOverride"]);
    expect(createdOption.file).toEqual(["..\\src\\index.ts", "..\\src\\cli.ts", "..\\src\\ts.ts"]);
    expect(createdOption.showMultiple).toEqual(true);
    expect(createdOption.write).toEqual(true);
    expect(createdOption.outputFolder).toEqual(path.resolve(path.dirname(createdOption.tsconfig), "..\\DifferentOutput2"));
    expect(createdOption.errorCode).toEqual([]);
    expect(createdOption.ignoreGitStatus).toEqual(false);
});






