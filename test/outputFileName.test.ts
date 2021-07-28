import { getOutputFilePath } from "../src/index";
import { makeOptions } from "../src/cli";
import path from "path";
import { createDo } from "typescript";


test("outputFileName_replace", () => {
    let argv = {};
    const dir = __dirname;
    const default_opt = makeOptions(dir, argv);
    const files = [path.resolve(dir, "file1.ts"), path.resolve(dir, "src/folder/file2.ts")];
    
    expect(getOutputFilePath(files[0], default_opt)).toEqual(files[0]);
    expect(getOutputFilePath(files[1], default_opt)).toEqual(files[1]);
})

test("outputFileName_output_noneGiven", () => {
    let argv = {r:false};
    const dir = __dirname;
    const default_opt = makeOptions(dir, argv);
    const files = [path.resolve(dir, "file1.ts"), path.resolve(dir, "src/folder/file2.ts")];
    
    expect(getOutputFilePath(files[0], default_opt)).toEqual(path.resolve(dir, "../Output", "file1.ts"));
    expect(getOutputFilePath(files[1], default_opt)).toEqual(path.resolve(dir, "../Output", "src/folder/file2.ts"));
})