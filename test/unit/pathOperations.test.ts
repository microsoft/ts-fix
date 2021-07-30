import { getDirectory,getFileName } from "../../src/index";
import path from "path";

const cwd = process.cwd();

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
