import {
    tsConfigFilePathDefault,
    codefixProject, 
    applyCodefixesOverProject,
    getProject, 
    getDiagnostics,
    getCodeFixesForFile,
    getTextChangeDict,
    doTextChanges,
} from "../src/index";
import path from "path";

const tsConfigFilePath = path.resolve(__dirname, "../test/exampleTest/tsconfig.json");


test("completeEntireExampleTest", async () => {
    // this test may fail because the boolean behavior (error diagnostic)
    // has not been checked for expected behavior / debugged / finalized
    expect(await codefixProject(tsConfigFilePath)).toEqual(false); 
});

// test("", async () =>{
//     const project = getProject(tsConfigFilePath);


// });