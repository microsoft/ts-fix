import fs from "fs";
import path from "path";
import ts from "typescript";
import { describe, expect, test, } from "vitest";
import { codefixProject } from "../../src";
import { makeOptions } from "../../src/cli";
import { normalizeLineEndings, normalizeSlashes, normalizeTextChange, TestHost } from "./testHost";

interface Snapshot {
  dirname: string;
  testName: string;
  cwd: string;
  args: string[];
  logs: string[];
  changes: ReadonlyMap<string, readonly ts.TextChange[]>[];
  filesWritten: Map<string, string>;
}

async function baselineCLI(cwd: string, args: string[], testName: string): Promise<Snapshot> {
  const host = new TestHost(cwd);
  const options = makeOptions(cwd, args);
  await codefixProject(options, host);

  const snapshot: Snapshot = {
    dirname: __dirname,
    testName,
    cwd: normalizeSlashes(path.relative(__dirname, cwd)),
    args,
    logs: host.getLogs(),
    changes: host.getRemainingChanges(),
    filesWritten: host.getFilesWritten(),
  };

  return snapshot;
}

expect.addSnapshotSerializer({
  test(snapshot: Snapshot) {
    return !!snapshot.cwd && !!snapshot.args && !!snapshot.logs && !!snapshot.changes && !!snapshot.filesWritten;
  },
  serialize(snapshot: Snapshot, _config, _indentation, depth, _refs, _printer) {
    function replacer(_key: string, value: any) {
      if (value instanceof Map) {
        return {
          dataType: 'Map',
          value: Array.from(value.entries()).map(([fileName, value]) => {
            if (typeof value === "string") {
              return [normalizeSlashes(fileName), normalizeLineEndings(value)];
            }
            return [normalizeSlashes(path.relative(snapshot.dirname, fileName)), normalizeTextChange(value)];
          }),
        };
      } else {
        return value;
      }
    }

    const snapshotValue = JSON.stringify({
      cwd: snapshot.cwd,
      args: snapshot.args,
      logs: snapshot.logs,
      remainingChanges: snapshot.changes,
      filesWritten: snapshot.filesWritten
    }, replacer, 2);

    return `exports[\`integration tests ${snapshot.testName} ${depth}\`] = \`\n${snapshotValue}\n\`;`;
  }
});

const cases = fs.readdirSync(path.resolve(__dirname, "cases")).flatMap(dirName => {
  const commands = fs.readFileSync(path.resolve(__dirname, "cases", dirName, "cmd.txt"), "utf8").split(/\r?\n/);
  // Split cmd.txt by line, then into space-separated args, and leave off the leading `ts-fix`
  return commands.filter(c => c.trim().length > 0).map(c => c.split(" ").slice(1)).map((args): [string, string[]] => [dirName, args]);
});

describe("integration tests", () => {
  test.each(cases)("%s %#", async (dirName, args) => {
    const cwd = path.resolve(__dirname, "cases", dirName);
    const snapshot = await baselineCLI(path.posix.normalize(cwd), args, dirName);
    await expect(snapshot).toMatchFileSnapshot(path.resolve(__dirname, '__snapshots__', dirName + ".shot"));
  });
});
