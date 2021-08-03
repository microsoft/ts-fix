import fs from "fs";
import path from "path";
import { codefixProject} from "../../src";
import { makeOptions } from "../../src/cli";
import { normalizeSlashes, TestHost } from "./testHost";
import {addSerializer, toMatchSpecificSnapshot} from "jest-specific-snapshot";

async function baselineCLI(cwd: string, args: string[]) {
  const host = new TestHost(cwd);
  const options = makeOptions(cwd, args);
  await codefixProject(options, host);
  
  const snapshot = {
    cwd: normalizeSlashes(path.relative(__dirname, cwd)),
    args,
    logs: host.getLogs(),
    filesWritten: host.getFilesWritten(),
  };
  
  return snapshot;
}

addSerializer({
  test(snapshot: { cwd: any; args: any; logs: any; filesWritten: any; }){
    return snapshot.cwd && snapshot.args && snapshot.logs && snapshot.filesWritten;
  },
  print(snapshot: { cwd: any; args: any; logs: any; filesWritten: any; }){
    function replacer(_, value:any) {
      if(value instanceof Map) {
        return {
          dataType: 'Map',
          value: Array.from(value.entries()), // or with spread: value: [...value]
        };
      } else {
        return value;
      }
    }
    return JSON.stringify(snapshot, replacer,2);
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

