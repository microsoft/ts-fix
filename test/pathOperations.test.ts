import { getDirectory,getRelativePath } from "../src/index";
import { makeOptions } from "../src/cli";
import path from "path";
import { TextChange } from "typescript";

const cwd = path.resolve();

const nested_argv  = { 
    t: path.resolve("..\\test\\testRepositories\\nestedFolderTest\\src\\tsconfig.json")
};

// This doesn't work... I'm guessing because of how the directories are considered in testing, so the normalize fails. 
// Using normalize because I would like these tests to be runnable on multiple os s

// test("getRelativePath", () => {
//     const cwd = process.cwd();
//     const testBase = path.resolve(cwd);
//     const opt = makeOptions(testBase, {});
//     expect(opt.tsconfigPath).toEqual(path.resolve(cwd, "tsconfig.json"));
//     const file1 = path.resolve("file1.ts");
//     const file2 =path.resolve( "src\\subfolder1\\subfolder2\\file2.ts");
//     const subfolderPath = path.resolve("src\\subfolder1");
//     expect(getRelativePath(file1, opt)).toEqual(path.normalize("file1.ts"));
//     expect(getRelativePath(file2, opt)).toEqual(path.normalize("src\\subfolder1\\subfolder2\\file2.ts"));
//     expect(getRelativePath(subfolderPath, opt)).toEqual(path.normalize("src\\subfolder1"));

// })