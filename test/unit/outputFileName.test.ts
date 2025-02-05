import path from "path";
import { expect, test } from "vitest";
import { makeOptions } from "../../src/cli";
import { getOutputFilePath } from "../../src/index";

test("outputFileName_replace", () => {
    const dir = __dirname;
    const default_opt = makeOptions(dir, []);
    const files = [path.resolve(dir, "file1.ts"), path.resolve(dir, "src/folder/file2.ts")];

    expect(getOutputFilePath(files[0], default_opt)).toEqual(files[0]);
    expect(getOutputFilePath(files[1], default_opt)).toEqual(files[1]);
})

test("outputFileName_output_noneGiven", () => {
    const dir = __dirname;
    const default_opt = makeOptions(dir, ["-o", "../Output"]);
    const files = [path.resolve(dir, "file1.ts"), path.resolve(dir, "src/folder/file2.ts")];

    expect(getOutputFilePath(files[0], default_opt)).toEqual(path.resolve(dir, "../Output", "file1.ts"));
    expect(getOutputFilePath(files[1], default_opt)).toEqual(path.resolve(dir, "../Output", "src/folder/file2.ts"));
})