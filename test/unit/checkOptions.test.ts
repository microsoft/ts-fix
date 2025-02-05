import { expect, test } from "vitest";
import { checkOptions } from "../../src";
import { makeOptions } from "../../src/cli";

const cwd = __dirname;

test("checkOptions_emptyFilePath", async () => {
    const createdOption = makeOptions(cwd, []);
    await expect(checkOptions(createdOption)).resolves.toEqual([[], []]);
});

test('checkOptions_oneInvalidFilePath', async () => {
    const createdOption = makeOptions(cwd, ["--file", "\\src\\index.ts"]);
    await expect(checkOptions(createdOption)).rejects.toThrow('All provided files are invalid');
  });

test('checkOptions_oneValidFilePath', async () => {
    const createdOption = makeOptions(cwd, ["--file", "..\\..\\src\\index.ts"]);
    try {
        await checkOptions(createdOption);
    } catch (e) {
        await expect(checkOptions(createdOption)).rejects.toThrow(e as Error);
    }
});

test("checkOptions_manyFilePaths", async () => {
    const createdOption = makeOptions(cwd, ["--file", "..\\..\\src\\index.ts", "..\\..\\src\\cli.ts", "..\\..\\src\\ts.ts"]);
    try {
        await checkOptions(createdOption);
    } catch (e) {
        await expect(checkOptions(createdOption)).rejects.toThrow(e as Error);
    }
});

test("checkOptions_oneValidOneInvalidPath", async () => {
    const createdOption = makeOptions(cwd, ["--file", "..\\..\\src\\index.ts", "..\\invalid"]);
    try {
        await checkOptions(createdOption);
    } catch (e) {
        await expect(checkOptions(createdOption)).rejects.toThrow(e as Error);
    }
});

test("checkOptions_manyValidManyInvalidPaths", async () => {
    const createdOption = makeOptions(cwd, ["--file", "..\\..\\src\\index.ts", "..\\..\\src\\cli.ts", "..\\..\\src\\ts.ts", "..\\invalid", "..\\invalid1", "..\\invalid2"]);
    try {
        await checkOptions(createdOption);
    } catch (e) {
        await expect(checkOptions(createdOption)).rejects.toThrow(e as Error);
    }
});
