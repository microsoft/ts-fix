import { checkOptions } from "../../src";
import { makeOptions } from "../../src/cli";

test("checkOptions_emptyFilePath", () => {
    const cwd = __dirname;
    const createdOption = makeOptions(cwd, []);
    expect(checkOptions(createdOption)).resolves.toEqual([[], []]);
});

test("checkOptions_oneFilePath", () => {
    const cwd = __dirname;
    const createdOption = makeOptions(cwd, ["--file", "..\\..\\src\\index.ts"]);
    expect(checkOptions(createdOption)).resolves.toEqual([["C:\\Users\\t-danayf\\Repositories\\ts-fix\\src\\index.ts"], []]);
});

test("checkOptions_manyFilePaths", () => {
    const cwd = __dirname;
    const createdOption = makeOptions(cwd, ["--file", "..\\..\\src\\index.ts", "..\\..\\src\\cli.ts", "..\\..\\src\\ts.ts"]);
    expect(checkOptions(createdOption)).resolves.toEqual([["C:\\Users\\t-danayf\\Repositories\\ts-fix\\src\\index.ts", "C:\\Users\\t-danayf\\Repositories\\ts-fix\\src\\cli.ts", "C:\\Users\\t-danayf\\Repositories\\ts-fix\\src\\ts.ts"], []]);
});

test("checkOptions_oneValidOneInvalidPath", () => {
    const cwd = __dirname;
    const createdOption = makeOptions(cwd, ["--file", "..\\..\\src\\index.ts", "..\\invalid"]);
    expect(checkOptions(createdOption)).resolves.toEqual([["C:\\Users\\t-danayf\\Repositories\\ts-fix\\src\\index.ts"], ["C:\\Users\\t-danayf\\Repositories\\ts-fix\\test\\invalid"]]);
});

test("checkOptions_manyValidManyInvalidPaths", () => {
    const cwd = __dirname;
    const createdOption = makeOptions(cwd, ["--file", "..\\..\\src\\index.ts", "..\\..\\src\\cli.ts", "..\\..\\src\\ts.ts", "..\\invalid", "..\\invalid1", "..\\invalid2"]);
    expect(checkOptions(createdOption)).resolves.toEqual([["C:\\Users\\t-danayf\\Repositories\\ts-fix\\src\\index.ts", "C:\\Users\\t-danayf\\Repositories\\ts-fix\\src\\cli.ts", "C:\\Users\\t-danayf\\Repositories\\ts-fix\\src\\ts.ts"], ["C:\\Users\\t-danayf\\Repositories\\ts-fix\\test\\invalid", "C:\\Users\\t-danayf\\Repositories\\ts-fix\\test\\invalid1", "C:\\Users\\t-danayf\\Repositories\\ts-fix\\test\\invalid2"]]);
});