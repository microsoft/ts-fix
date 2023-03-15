import { TextChange } from "typescript";
import { PathLike } from "fs";
import path from "path";
import { Host } from "../../src";

export function normalizeSlashes(path: string): string {
    return path.replace(/\\/g, '/');
}

export function normalizeLineEndings(contents: string): string {
    return contents.replace(/\r\n/g, '\n');
}

export function normalizeTextChange(changes: TextChange[]): TextChange[] {
    return changes.map((c) => {
        return {
            newText: normalizeLineEndings(c.newText),
            span: c.span
        }
    })
}

export class TestHost implements Host {
    private filesWritten = new Map<string, string>();
    private logged: string[] = [];
    private existsChecked: string[] = [];
    private dirMade: string[] = [];
    private remainingChanges: (ReadonlyMap<string, readonly TextChange[]>)[] = [];

    constructor(private cwd: string) { };

    writeFile(fileName: string, content: string) {
        this.filesWritten.set(normalizeSlashes(path.relative(this.cwd, fileName)), content);
    }

    getRemainingChanges() { return this.remainingChanges };

    addRemainingChanges(changeList: ReadonlyMap<string, readonly TextChange[]>) { this.remainingChanges.push(changeList) };


    log(s: string) { this.logged.push(s) };

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
        return this.filesWritten;
    }

    getExistsChecked() { return this.existsChecked; }

    getDirMade() { return this.dirMade; }

    getNewLine() { return "\r\n" }

    write(s: string) { process.stdout.write(s) };

    getCanonicalFileName(fileName: string) { return fileName.toLowerCase() }

    getCurrentDirectory() { return process.cwd() }

}
