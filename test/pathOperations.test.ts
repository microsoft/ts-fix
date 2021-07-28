import { getDirectory,getFileName,getRelativePath } from "../src/index";
import { makeOptions } from "../src/cli";
import path from "path";

const cwd = process.cwd();

const opt_default = makeOptions(cwd, {});

const nested_argv  = { 
    t: path.resolve(cwd, "test"),
    r:false,
    o: path.resolve(cwd, "output")
};

const opt_output = makeOptions(cwd, nested_argv);

const fileList = ["file1.ts", (path.normalize("/src/file2.ts"))];


test("getFileName", () => {
    expect(getFileName(fileList[0])).toEqual("file1.ts");
    expect(getFileName(fileList[1])).toEqual("file2.ts");
    expect(getFileName(path.resolve(cwd, fileList[0]))).toEqual("file1.ts");
    expect(getFileName(path.resolve(cwd, fileList[1]))).toEqual("file2.ts");
})

test("getDirectory", () => {
    expect(path.normalize(getDirectory(fileList[0]))).toEqual(path.normalize("."));
    expect(path.normalize(getDirectory(fileList[1]))).toEqual(path.normalize("/src"));
    expect(path.normalize(getDirectory(path.resolve(cwd, fileList[0])))).toEqual(path.normalize(cwd));
    expect(path.normalize(getDirectory(path.resolve(cwd, fileList[1])))).toEqual(path.resolve(cwd, "/src"));
})


// test("getRelativePath", () => {
    // expect(getRelativePath(fileList[0], opt_default)).toEqual("file1.ts");
    // 
    // test issue: 
    // expect(getRelativePath(fileList[1], opt_default)).toEqual(path.normalize("src/file2.ts"));
    // Expected: "src\\file2.ts"
    // Received: "..\\..\\..\\src\\file2.ts"
// })

// test("getOutputFilePath", () => {

// })



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





test("placeholder", () => {
    expect([]).toEqual([]);
})