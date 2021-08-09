import fs from "fs";
import path from "path";
import { codefixProject} from "../../src";
import { makeOptions } from "../../src/cli";
import { normalizeSlashes, normalizeLineEndings, TestHost, normalizeTextChange } from "./testHost";
import {addSerializer} from "jest-specific-snapshot";

async function baselineCLI(cwd: string, args: string[]) {
  const host = new TestHost(cwd);
  const options = makeOptions(cwd, args);
  await codefixProject(options, host);
  
  const snapshot = {
    dirname: __dirname,
    cwd: normalizeSlashes(path.relative(__dirname, cwd)),
    args,
    logs: host.getLogs(),
    changes: host.getRemainingChanges(),
    filesWritten: host.getFilesWritten(),
  };
  
  return snapshot;
}

addSerializer({
  test(snapshot: { dirname: string, cwd: any; args: any; logs: any; changes: any; filesWritten: any; }){
    return snapshot.cwd && snapshot.args && snapshot.logs && snapshot.changes && snapshot.filesWritten;
  },
  print(snapshot: { dirname: string,  cwd: string; args: any; logs: any; changes: any; filesWritten: any; }){
    function replacer(_, value:any) {
      if (value instanceof Map) {
        return {
          dataType: 'Map',
          value: Array.from(value.entries()).map(([fileName, value])=>{
            if (typeof value === "string"){
              return [normalizeSlashes(fileName), normalizeLineEndings(value)] 
            }
            return [normalizeSlashes(path.relative(snapshot.dirname, fileName)), normalizeTextChange(value)] 
            }), 
        };
      } else {
        return value;
      }
    }
    return JSON.stringify({ cwd: snapshot.cwd,
                             args: snapshot.args,
                             logs: snapshot.logs,
                             remainingChanges: snapshot.changes,
                             filesWritten: snapshot.filesWritten }, replacer, 2);
  }
})



const cases = fs.readdirSync(path.resolve(__dirname, "cases")).flatMap(dirName => {
  const commands = fs.readFileSync(path.resolve(__dirname, "cases", dirName, "cmd.txt"), "utf8").split(/\r?\n/);
  // Split cmd.txt by line, then into space-separated args, and leave off the leading `ts-fix`
  return commands.filter(c => c.trim().length > 0).map(c => c.split(" ").slice(1)).map((args): [string, string[]] => [dirName, args]);
});

describe("integration tests", () => {
  test.each(cases)("%s %#", async (dirName, args) => {
    const cwd = path.resolve(__dirname, "cases", dirName);
    const snapshot = await baselineCLI(path.posix.normalize(cwd), args);
   expect(snapshot).toMatchSpecificSnapshot(path.resolve(__dirname, '__snapshots__', dirName+".shot"));

  });
});

