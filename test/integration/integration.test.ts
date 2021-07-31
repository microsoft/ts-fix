import fs from "fs";
import path from "path";
import { codefixProject, Host, getOutputFilePath, getDirectory, ChangedFile, Options } from "../../src";
import { PathLike } from "fs";
import { makeOptions } from "../../src/cli";
import { TextChange } from "typescript";

export class TestHost implements Host {
  private filesWritten = new Map<string, string>();
  private logged: string[] = [];
  private existsChecked: string[] = [];
  private dirMade: string[] = [];
  private remainingChanges : (ReadonlyMap<string, readonly TextChange[]>)[] = [];

  constructor(private cwd: string) {};
  
  writeFile(fileName: string, content: string) {
      this.filesWritten.set(normalizeSlashes(path.relative(this.cwd, fileName)), content);
  }
  
  getRemainingChanges() {return this.remainingChanges};

  addRemainingChanges(changeList: ReadonlyMap<string, readonly TextChange[]>) {this.remainingChanges.push(changeList)};


  log(s:string) {this.logged.push(s)};

  exists(fileName: PathLike) {
    this.existsChecked.push(normalizeSlashes(fileName.toString()));
    return true;
  }
  mkdir(fileName: PathLike) {
    this.dirMade.push(normalizeSlashes(fileName.toString()));
    return undefined;
  }

  getLogs() {
    return this.logged;
  }

  getFilesWritten() {
      return this.filesWritten;  }
  
  getExistsChecked() {  return this.existsChecked;  }

  getDirMade() {  return this.dirMade;  }
}

function normalizeSlashes(path:string) : string{
    return  path.replace(/\\/g, '/');
}

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
  expect(snapshot).toMatchSnapshot();
}

const cases = fs.readdirSync(path.resolve(__dirname, "cases")).flatMap(dirName => {
  const commands = fs.readFileSync(path.resolve(__dirname, "cases", dirName, "cmd.txt"), "utf8").split(/\r?\n/);
  // Split cmd.txt by line, then into space-separated args, and leave off the leading `ts-fix`
  return commands.filter(c => c.trim().length > 0).map(c => c.split(" ").slice(1)).map((args): [string, string[]] => [dirName, args]);
});

describe("integration tests", () => {
  test.each(cases)("%s %#", async (dirName, args) => {
    const cwd = path.resolve(__dirname, "cases", dirName);
    await baselineCLI(path.posix.normalize(cwd), args);
  });
});

