import fs from "fs";
import path from "path";
import ts from "typescript";
import { describe, expect, test } from "vitest";
import { codefixProject } from "../../src";
import { makeOptions } from "../../src/cli";
import { normalizeLineEndings, normalizeSlashes, normalizeTextChange, TestHost } from "./testHost";

interface Snapshot {
  dirname: string;
  cwd: string;
  args: string[];
  logs: string[];
  changes: ReadonlyMap<string, readonly ts.TextChange[]>[];
  filesWritten: Map<string, string>;
}

async function baselineCLI(cwd: string, args: string[]): Promise<Snapshot> {
  const host = new TestHost(cwd);
  const options = makeOptions(cwd, args);
  await codefixProject(options, host);

  const snapshot: Snapshot = {
    dirname: __dirname,
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
  serialize(snapshot: Snapshot) {
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

    return snapshotValue + "\n";
  }
});


describe("integration tests", () => {
  const casesDir = path.resolve(__dirname, "cases")
  const cases = fs.readdirSync(casesDir);

  test.each(cases)("%s", async (dirName) => {
    const cwd = path.resolve(casesDir, dirName);

    const cmdFile = fs.readFileSync(path.resolve(cwd, "cmd.txt"), "utf8");
    // Split cmd.txt by line, then into space-separated args, and leave off the leading `ts-fix`
    const commands = cmdFile.split(/\r?\n|\s/).map(c => c.trim()).filter(c => c.length > 0).slice(1).concat("-w", "--ignoreGitStatus");

    const snapshot = await baselineCLI(path.posix.normalize(cwd), commands);
    await expect(snapshot).toMatchFileSnapshot(path.resolve(__dirname, '__snapshots__', `${dirName}.shot`));
  });
});
