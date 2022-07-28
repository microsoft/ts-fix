import path from "path";
import type { CodeFixAction, Diagnostic, FileTextChanges, TextChange } from "typescript";
import os from "os";
import _ from "lodash";
import { createProject, Project } from "./ts";
import { PathLike, writeFileSync, mkdirSync, existsSync } from "fs";
import { diffChars } from "diff";
import inquirer from 'inquirer';

export interface Logger {
  (...args: any[]): void;
  error?(...args: any[]): void;
  warn?(...args: any[]): void;
  info?(...args: any[]): void;
  verbose?(...args: any[]): void;
}

export interface Host {
  // Emits one particular file with input fileName and content string
  writeFile(fileName: string, content: string): void;

  // Returns all text changes that were not applied
  getRemainingChanges: () => (ReadonlyMap<string, readonly TextChange[]>)[];

  // Adds map of text changes that were not applied
  addRemainingChanges: (changelist: ReadonlyMap<string, readonly TextChange[]>) => void;
  log: Logger;
  write: Logger;
  mkdir: typeof import("fs").mkdirSync;
  exists: typeof import("fs").existsSync;
}

export class CLIHost implements Host {
  private remainingChanges: (ReadonlyMap<string, readonly TextChange[]>)[] = [];

  constructor(private cwd: string) { };

  writeFile(fileName: string, content: string) { writeFileSync(fileName, content, 'utf8') };

  getRemainingChanges() { return this.remainingChanges };

  addRemainingChanges(changeList: ReadonlyMap<string, readonly TextChange[]>) { this.remainingChanges.push(changeList) };

  log(s: string) { console.log(s) };

  write(s: string) { process.stdout.write(s) };

  mkdir(directoryPath: PathLike) { return mkdirSync(directoryPath, { recursive: true }) };

  exists(fileName: PathLike) { return existsSync(fileName) };
}

export interface Options {
  cwd: string;
  tsconfig: string;
  outputFolder: string;
  errorCode: number[];
  fixName: string[];
  write: boolean,
  verbose: boolean,
  fix: boolean,
  interactiveMode: boolean,
}

const isAdditionalPassRequired = (opt: Options, passCount: number): boolean => {
  let isAdditionalPassRequired = true;
  let totalPossiblePassCount = 2; //For when -f or -e are provided
  if (opt.errorCode.length && opt.fixName.length && passCount === totalPossiblePassCount) { //&& !opt.interactiveMode TODOFIX, it might not be needed 2 runs for interactive mode seem enough
    isAdditionalPassRequired = false;
  }
  return isAdditionalPassRequired;
}

export async function codefixProject(opt: Options, host: Host): Promise<string> {
  if (opt.errorCode.length === 0 && opt.fixName.length === 0) {
    host.log("Please be aware that not specifying either code fix names or error codes often results in unwanted changes.");
  }

  const allChangedFiles = new Map<string, ChangedFile>();
  let passCount = 0;

  while (isAdditionalPassRequired(opt, passCount)) {
    const project = createProject({ tsConfigFilePath: opt.tsconfig }, allChangedFiles);
    if (!project) {
      return "Error: Could not create project.";
    }

    if (passCount === 0) {
      host.log("Using TypeScript " + project.ts.version);
    } else {
      host.log("Initiating additional pass...");
    }

    const [textChangesByFile, pendingChangesByFile] = await getCodeFixesFromProject(project, opt, host);
    const { changedFiles, excessChanges } = await getChangedFiles(project, textChangesByFile);
    changedFiles.forEach((change, fileName) => {
      allChangedFiles.set(fileName, change)
    });
    host.addRemainingChanges(excessChanges);

    if (hasOnlyEmptyLists(excessChanges)) {
      host.log("No changes remaining for ts-fix");
      if (pendingChangesByFile.size) {
        host.log("The following files still have pending changes: ");
        pendingChangesByFile.forEach((change, fileName) => {
          host.log(`${change} ${fileName}`);
        })
      }
      break;
    } else {
      host.log(excessChanges.size + " changes remaining\n");
      if (excessChanges.size === 9) {
        break;
      }
    }

    passCount++;
  }

  if (opt.write) {
    host.log("Changes detected in the following files:");
    allChangedFiles.forEach((changedFile, fileName) => {
      writeToFile(fileName, changedFile.newText, opt, host);
      host.log("   " + fileName);
    })
  }

  return "Done";
}

export async function getCodeFixesFromProject(project: Project, opt: Options, host: Host): Promise<[Map<string, TextChange[]>, Map<string, TextChange[]>]> {

  // pull all codefixes.
  const diagnosticsPerFile = await getDiagnostics(project);

  if (diagnosticsPerFile.length === 0) { // TODO fix equalty
    host.log("No more diagnostics.");
    return [new Map<string, TextChange[]>(), new Map<string, TextChange[]>()];
  }
  // pull codefixes from diagnostics.  If errorCode is specified, only pull fixes for that/those errors. 
  //    Otherwise, pull all fixes

  const [filteredDiagnostics, acceptedDiagnosticsOut] = filterDiagnosticsByErrorCode(diagnosticsPerFile, opt.errorCode);
  acceptedDiagnosticsOut.forEach((string_describe: unknown) => {
    host.log(string_describe);
  });

  const codefixesPerFile = filteredDiagnostics.map(function (d: readonly Diagnostic[]) {
    const codefixes = (getCodeFixesForFile(project, d))
    return codefixes;
  });

  const flatCodefixes = <CodeFixAction[]>_.flatten(codefixesPerFile);
  let codefixes = flatCodefixes.filter((codefix) => codefix.changes.length > 0);
  // && codefix.fixName !== "fixMissingMember"); TODOFIX I probably wont need this once 49993 it's fixed
  let updatedCodefixes = new Array<CodeFixAction>();
  const pendingFiles = flatCodefixes.filter((codefix) => codefix.changes.length === 0);

  if (opt.interactiveMode) {
    for (let i = 0; i < codefixes.length; i++) {
      let accepted = await getFileFixes(project, host, codefixes[i]);
      if (accepted) {
        updatedCodefixes.push(codefixes[i])
      }
    }
  }

  // filter for codefixes if applicable, then organize textChanges by what file they alter
  const [textChangesByFile, filterCodefixOut] = opt.interactiveMode ? getTextChangeDict(opt, updatedCodefixes, codefixes.length) : getTextChangeDict(opt, codefixes);
  const [pendingChangesByFile, filterCodefixOut1] = getTextChangeDict(opt, pendingFiles); //TODOFIX use this for summary

  filterCodefixOut.forEach((s: unknown) => {
    host.log(s);
  });

  return [textChangesByFile, pendingChangesByFile];
}

export function getDiagnostics(project: Project): (readonly Diagnostic[])[] {
  const diagnostics = project.program.getSourceFiles().map(function (file) {
    return project.program.getSemanticDiagnostics(file);
  });
  return diagnostics;
}

export function filterDiagnosticsByErrorCode(diagnostics: (readonly Diagnostic[])[], errorCodes: number[]): [(readonly Diagnostic[])[], string[]] {
  // if errorCodes were passed in, only use the specified errors
  // diagnostics is guarenteed to not be [] or [[]]
  if (errorCodes.length !== 0) {

    let errorCounter = new Map<number, number>();
    let filteredDiagnostics = <(readonly Diagnostic[])[]>[];

    for (let i = 0; i < diagnostics.length; i++) {
      //for every diagnostic list
      // get rid of not matched errors
      const filteredDiagnostic = _.filter(diagnostics[i], function (d) {
        if (errorCodes.includes(d.code)) {
          const currentVal = errorCounter.get(d.code);
          if (currentVal !== undefined) {
            errorCounter.set(d.code, currentVal + 1);
          } else {
            errorCounter.set(d.code, 1);
          }
          return true;
        }
        return false;
      });
      if (filteredDiagnostic.length > 0) {
        filteredDiagnostics.push(filteredDiagnostic);
      }
    }
    let returnStrings = <string[]>[];
    errorCodes.forEach((code: number) => {
      const count = errorCounter.get(code);
      if (count === undefined) {
        returnStrings.push("No diagnostics found with code " + code)
      } else {
        returnStrings.push("Found " + count + " diagnostics with code " + code);
      }
    });

    return [filteredDiagnostics, returnStrings];
  }
  // otherwise, use all errors
  return [diagnostics, ["Found " + _.reduce(diagnostics.map((d: { length: any; }) => d.length), function (sum, n) {
    return sum + n;
  }, 0) + " diagnostics in " + diagnostics.length + " files"]];
}

export function getCodeFixesForFile(project: Project, diagnostics: readonly Diagnostic[]): readonly CodeFixAction[] {
  // expects already filtered diagnostics
  const service = project.languageService;
  const codefixes = (<CodeFixAction[]>[]).concat.apply([], diagnostics.map(function (d: Diagnostic) {
    if (d.file && d.start !== undefined && d.length !== undefined) {
      return service.getCodeFixesAtPosition(
        d.file.fileName,
        d.start,
        d.start + d.length,
        [d.code],
        project.ts.getDefaultFormatCodeSettings(os.EOL),
        {});
    } else {
      return [];
    }
  })).filter((d: CodeFixAction) => d !== undefined);
  return codefixes;
}

function getFileTextChangesFromCodeFix(codefix: CodeFixAction): readonly FileTextChanges[] {
  return codefix.changes;
}

export function getTextChangeDict(opt: Options, codefixes: readonly CodeFixAction[], length?: number): [Map<string, TextChange[]>, string[]] {
  let textChangeDict = new Map<string, TextChange[]>();

  const [filteredFixes, out] = filterCodeFixesByFixName(codefixes, opt.fixName, length);

  for (let i = 0; i < filteredFixes.length; i++) {
    const fix = filteredFixes[i];
    const changes = getFileTextChangesFromCodeFix(fix);

    for (let j = 0; j < changes.length; j++) {
      let change = changes[j];
      let validChanges = getFileNameAndTextChangesFromCodeFix(change);
      if (validChanges === undefined) {
        continue
      }
      let [key, value] = validChanges;
      const prevVal = textChangeDict.get(key);
      if (prevVal === undefined) {
        textChangeDict.set(key, value);
      } else {
        textChangeDict.set(key, prevVal.concat(value));
      }
    }
  }

  return [textChangeDict, out];
}

export function filterCodeFixesByFixName(codefixes: readonly CodeFixAction[], fixNames: string[], length?: number): [readonly CodeFixAction[], string[]] {
  if (fixNames.length === 0) {
    // empty argument behavior... currently, we just keep all fixes if none are specified
    let returnStrings = <string[]>[];
    let codeFixes = new Set<string>();
    let fixesNames = new Array<string>();
    let fixesString = <string[]>[];
    length ? fixesString.push(`Found ${length} codefixes but only ${codefixes.length} were accepted by the user`) : fixesString.push(`Found ${codefixes.length} codefixes`);
    codefixes.forEach((codeFix: CodeFixAction) => {
      if (codeFix.fixName !== undefined && !codeFixes.has(codeFix.fixName)) {
        codeFixes.add(codeFix.fixName);
        fixesNames.push(codeFix.fixName);
      }
    })
    const fixesLength = fixesNames.length
    if (fixesLength === 1) {
      fixesString.push(`. Fix ${fixesNames[0]} was found`);
    }
    if (fixesLength >= 2) {
      fixesString.push(`. The codefixes found are: `);
      for (let i = 0; i < fixesLength; i++) {
        fixesString.push(fixesNames[i]);
        if (i !== fixesLength - 1) {
          fixesString.push(`, `);
        }
      }
    }
    return [codefixes, [fixesString.join('')]];
  }
  
  // cannot sort by fixId right now since fixId is a {}
  // do we want to distinguish the case when no codefixes are picked? (no hits)

  let fixCounter = new Map<string, number>();
  let out = <string[]>[];
  const filteredFixes = codefixes.filter(function (fix: { fixName: any; }) {
    if (fixNames.includes(fix.fixName)) {
      const currentVal = fixCounter.get(fix.fixName);
      if (currentVal !== undefined) {
        fixCounter.set(fix.fixName, currentVal + 1);
      } else {
        fixCounter.set(fix.fixName, 1);
      }
      return true;
    }
    return false;
  });

  fixNames.forEach((name: string) => {
    const count = fixCounter.get(name);
    if (count === undefined) {
      out.push("No codefixes found with name " + name)
    } else {
      out.push("Found " + count + " codefixes with name " + name);
    }
  });

  return [filteredFixes, out];
}

function getFileNameAndTextChangesFromCodeFix(ftchanges: FileTextChanges): [string, TextChange[]] | undefined {
  if (/[\\/]node_modules[\\/]/.test(ftchanges.fileName)) {
    return undefined;
  }
  return [ftchanges.fileName, [...ftchanges.textChanges]];
}

export interface ChangedFile {
  originalText: string;
  newText: string;
}

async function getFileFixes(project: Project, host: Host, codefix: CodeFixAction): Promise<boolean> {
  let accepted = true;
  for (let i = 0; i < codefix.changes.length; i++) {
    const fileName = codefix.changes[i].fileName
    const sourceFile = project.program.getSourceFile(codefix.changes[i].fileName);
    if (sourceFile !== undefined) {
      const originalContents = sourceFile.text;
      const newFileContents = applyChangestoFile(originalContents, codefix.changes[i].textChanges);
      for (let j = 0; j < codefix.changes[i].textChanges.length; j++) {
        let start = codefix.changes[j].textChanges[0].span.start;
        const currentFileContentSubstring = originalContents.substring(originalContents.lastIndexOf('\n', start) + 1, originalContents.indexOf('\n', start));
        const newFileContentsSubstring = newFileContents.substring(newFileContents.lastIndexOf('\n', start) + 1, newFileContents.indexOf('\n', start));
        const fileLine = originalContents.indexOf(originalContents);
        host.log(`Please review this fix in file: ${fileName}`); //TODOFIX print file name and file line along with changed text, maybe even include fix being applied?
        host.log(`The file line to be changed is: ${fileLine}`);
        const diff = compareContentsAndLog(host, currentFileContentSubstring, newFileContentsSubstring);
        const userDecision = await getInputFromUser();
        if (Choices.reject === userDecision) {
          accepted = false
        }
      }
    }
  }
  return accepted;
}

async function getChangedFiles(project: Project, textChanges: Map<string, TextChange[]>): Promise<{ changedFiles: ReadonlyMap<string, ChangedFile>; excessChanges: ReadonlyMap<string, readonly TextChange[]>; }> {
  const excessChanges = new Map<string, TextChange[]>();
  const changedFiles = new Map<string, ChangedFile>();

  for (let [fileName, textChange] of textChanges.entries()) {
    const sourceFile = project.program.getSourceFile(fileName);
    let fileFix = textChange;
    if (sourceFile !== undefined) {
      const originalFileContents = sourceFile.text;

      // collision is true if there were changes that were not applied 
      // also performs the writing to the file
      const [overlappingChanges, newFileContents] = applyCodefixesInFile(originalFileContents, fileFix);
      excessChanges.set(fileName, overlappingChanges);
      changedFiles.set(fileName, { originalText: originalFileContents, newText: newFileContents });
    }
    else {
      throw new Error('File ' + fileName + ' not found in project');
    }
  };

  return { excessChanges, changedFiles };
}

function applyCodefixesInFile(originalContents: string, textChanges: TextChange[]): [TextChange[], string] {
  // sort textchanges by start
  const sortedFixList = sortChangesByStart(textChanges);

  // take some sort of issue (or none) with overlapping textchanges
  const [filteredFixList, notAppliedFixes] = filterOverlappingFixes(sortedFixList);

  // apply all remaining textchanges
  const newFileContents = applyChangestoFile(originalContents, filteredFixList);

  return [notAppliedFixes, newFileContents];
}

export function sortChangesByStart(textChanges: TextChange[]): TextChange[] { // tested
  // what if two changes start at the same place but have differnt lengths?
  // currently the shorter one is put first
  // ignores text content of the changes
  return textChanges.sort((a: { span: { start: number; length: number; }; }, b: { span: { start: number; length: number; }; }) => {
    return (a.span.start - b.span.start === 0) ? a.span.length - b.span.length : a.span.start - b.span.start
  });
}


export function filterOverlappingFixes(sortedFixList: TextChange[]): [TextChange[], TextChange[]] { // tested
  let filteredList = <TextChange[]>[];
  let droppedList = <TextChange[]>[];
  let currentEnd = -1;
  // why is 'fix' in the line below a string[], while sortedFixList is Textchange[]?

  for (let i = 0; i < sortedFixList.length; i++) {
    let fix = sortedFixList[i];
    if (fix.span.start > currentEnd) {
      filteredList.push(fix);
      currentEnd = fix.span.start + fix.span.length;
    } else {
      droppedList.push(fix);
    }
  }
  return [filteredList, droppedList];
}

enum Choices {
  accept = "Accept",
  reject = "Reject"
}

async function getInputFromUser(): Promise<string> {
  const choice = await inquirer
    .prompt([
      {
        name: "choice",
        type: "list",
        message: "What would you like to do?",
        choices: [Choices.accept, Choices.reject]
      },
    ]);
  return choice.choice;
};


function applyChangestoFile(originalContents: string, fixList: readonly TextChange[]): string {
  // maybe we want to have this and subsequent functions to return a diagnostic
  // function expects fixList to be already sorted and filtered
  const newFileContents = doTextChanges(originalContents, fixList);
  return newFileContents;
}

export function doTextChanges(fileText: string, textChanges: readonly TextChange[]): string {
  // does js/ts do references? Or is it always a copy when you pass into a function
  // iterate through codefixes from back
  for (let i = textChanges.length - 1; i >= 0; i--) {
    // apply each codefix
    fileText = doTextChangeOnString(fileText, textChanges[i]);
  }
  return fileText;
}

export function doTextChangeOnString(currentFileText: string, change: TextChange): string {
  const prefix = currentFileText.substring(0, change.span.start);
  const middle = change.newText;
  const suffix = currentFileText.substring(change.span.start + change.span.length);
  return prefix + middle + suffix;
}

function hasOnlyEmptyLists(m: ReadonlyMap<any, readonly any[]>): boolean {
  let arrayLength = 0;
  for (const [_, entries] of m.entries()) {
    if (entries.length > 0) {
      arrayLength++;
    }
  }
  return arrayLength > 0 ? false : true;
}

export function getFileName(filePath: string): string {
  return path.basename(filePath);
}

export function getDirectory(filePath: string): string {
  return path.dirname(filePath);
}

export function getRelativePath(filePath: string, opt: Options): string {
  // this doesn't work when tsconfig or filepath is not passed in as absolute...
  // as a result getOutputFilePath does not work for the non-replace option 
  return path.relative(getDirectory(opt.tsconfig), path.resolve(filePath));
}

export function getOutputFilePath(filePath: string, opt: Options): string {
  // this function uses absolute paths

  const fileName = getRelativePath(filePath, opt);
  return path.resolve(opt.outputFolder, fileName);
}

function compareContentsAndLog(host: Host, str1: string, str2: string): void {
  let diff = diffChars(str1, str2);
  diff.forEach((part) => {
    // green for additions, red for deletions
    // unset for common parts
    let color; //TODOFIX look at function `formatCodeSpan`
    if (part.added) color = 32;
    if (part.removed) color = 31;
    (part.added || part.removed) ? host.write(`\x1b[${color}m${part.value}\x1b[0m`) : host.write(`${part.value}`);
  });
  host.write(`\n`);
}

function writeToFile(fileName: string, fileContents: string, opt: Options, host: Host): string {
  const writeToFileName = getOutputFilePath(fileName, opt);
  const writeToDirectory = getDirectory(writeToFileName)
  if (!host.exists(writeToDirectory)) {
    host.mkdir(writeToDirectory);
  }
  host.writeFile(writeToFileName, fileContents);
  host.log("Updated " + path.relative(opt.cwd, writeToFileName)); //TODOFIX gotta change this message when editing files on an output folder
  return writeToFileName;
}