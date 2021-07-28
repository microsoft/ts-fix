import {codefixProject, TestHost} from "../src/index"
import path from "path";




test("singleFile", () => {
    
    const opt = {
        tsconfigPath: path.resolve(__dirname, 'testRepositories\\singleFileNoFolders\\src\\tsconfig.json'),
        replace: true,
        outputFolder:  path.resolve(__dirname, 'testRepositories\\singleFileNoFolders\\src\\tsconfig.json'),
        errorCode: [],
        fixName: [],
        write: false,
        verbose: true
    }
    
    let testhost = new TestHost;
    codefixProject(opt, testhost);
    expect(testhost.getlogged()).not.toEqual(0);
})

  