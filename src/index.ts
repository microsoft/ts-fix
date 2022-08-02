import path from "path";
import { CodeFixAction, Diagnostic, FileTextChanges, formatDiagnosticsWithColorAndContext, TextChange } from "typescript";
import os from "os";
import _, { flatMap } from "lodash";
import { createProject, Project } from "./ts";
import * as fs from "fs";
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
  getNewLine(): string;

  // Adds map of text changes that were not applied
  addRemainingChanges: (changelist: ReadonlyMap<string, readonly TextChange[]>) => void;
  log: Logger;
  write: Logger;
  mkdir: typeof import("fs").mkdirSync;
  exists: typeof import("fs").existsSync;
  getCurrentDirectory(): string;
  getCanonicalFileName(fileName: string): string;
}

export function identity<T>(x: T) {
  return x;
}

export function toLowerCase(x: string) {
  return x.toLowerCase();
}

const fileNameLowerCaseRegExp = /[^\u0130\u0131\u00DFa-z0-9\\/:\-_\. ]+/g;
export function toFileNameLowerCase(x: string) {
  return fileNameLowerCaseRegExp.test(x) ?
    x.replace(fileNameLowerCaseRegExp, toLowerCase) :
    x;
}
export type GetCanonicalFileName = (fileName: string) => string;
export function createGetCanonicalFileName(useCaseSensitiveFileNames: boolean): GetCanonicalFileName {
  return useCaseSensitiveFileNames ? identity : toFileNameLowerCase;
}

export class CLIHost implements Host {

  private remainingChanges: (ReadonlyMap<string, readonly TextChange[]>)[] = [];

  constructor(private cwd: string) { };

  writeFile(fileName: string, content: string) { fs.writeFileSync(fileName, content, 'utf8') };

  getRemainingChanges() { return this.remainingChanges };

  addRemainingChanges(changeList: ReadonlyMap<string, readonly TextChange[]>) { this.remainingChanges.push(changeList) };

  log(s: string) { console.log(s) };

  write(s: string) { process.stdout.write(s) };

  mkdir(directoryPath: fs.PathLike) { return fs.mkdirSync(directoryPath, { recursive: true }) };

  exists(fileName: fs.PathLike) { return fs.existsSync(fileName) };

  getNewLine() { return "\n" }
  getCurrentDirectory() { return process.cwd() }
  getCanonicalFileName(fileName: string) { return fileName.toLowerCase() }
}

export interface Options {
  cwd: string;
  tsconfig: string;
  outputFolder: string;
  errorCode: number[];
  // file: string;
  file: string[];
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

  let validFiles = new Array<string>;
  let invalidFiles = new Array<string>;
  if (opt.file) {
    opt.file.forEach((file) => {
      file = path.join(path.dirname(opt.tsconfig), file)
      if (fs.existsSync(file)) {
        validFiles.push(file);
      }
      else {
        invalidFiles.push(file);
      }
    });
    if (validFiles.length === 0) {
      throw new Error(`All provided files are invalid`);
    }
  }

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

    if (passCount === 0) host.log("Using TypeScript " + project.ts.version);

    const [textChangesByFile, pendingChangesByFile] = await getCodeFixesFromProject(project, opt, host, validFiles);
    const { changedFiles, excessChanges } = await getChangedFiles(project, textChangesByFile);
    changedFiles.forEach((change, fileName) => {
      allChangedFiles.set(fileName, change)
    });
    host.addRemainingChanges(excessChanges);

    if (hasOnlyEmptyLists(excessChanges)) {
      host.log("No changes remaining for ts-fix. Printing summary... \n");
      if (pendingChangesByFile.size) {
        host.log("There are some pending changes. This usually means you'll need to install missing dependencies. See below:");
        pendingChangesByFile.forEach((change, fileName) => {
          host.log(`${change} ${fileName}`);
        })
      }
      break;
    } else {
      host.log(excessChanges.size + " changes remaining. Initiating additional pass...\n");
    }

    passCount++;
  }

  if (opt.write) {
    if (allChangedFiles.size === 0) host.log("No changes made in any files")
    if (allChangedFiles.size === 1) host.log("Changes were made in the following file:")
    else if (allChangedFiles.size > 1) {
      host.log("Changes were made in the following files:");
    }
    allChangedFiles.forEach((changedFile, fileName) => {
      writeToFile(fileName, changedFile.newText, opt, host);
    })
  }

  return "Done";
}

export async function getCodeFixesFromProject(project: Project, opt: Options, host: Host, validFiles: string[]): Promise<[Map<string, TextChange[]>, Map<string, TextChange[]>]> {

  // pull all codefixes.
  const diagnosticsPerFile = await getDiagnostics(project);

  if (diagnosticsPerFile.length === 0) {
    host.log("No more diagnostics.");
    return [new Map<string, TextChange[]>(), new Map<string, TextChange[]>]
  }

  // pull codefixes from diagnostics.  If errorCode is specified, only pull fixes for that/those errors. If file is specified, only pull fixes for that/those files.
  //    Otherwise, pull all fixes
  let [filteredDiagnostics, acceptedDiagnosticsOut] = filterDiagnosticsByErrorCode(diagnosticsPerFile, opt.errorCode, validFiles);

  acceptedDiagnosticsOut.forEach((string_describe: unknown) => {
    host.log(string_describe);
  });

  let codefixesPerFile;
  let codefixes: readonly CodeFixAction[] = [];
  let fixesAndDiagnostics: FixAndDiagnostic[] = [];
  let updatedCodeFixes: CodeFixAction[] = [];
  let noChangesFixes: CodeFixAction[] = [];

  if (opt.interactiveMode) {
    codefixesPerFile = filteredDiagnostics.map(function (d: readonly Diagnostic[]) {
      const fixesAndDiagnostics = (getCodeFixesForFileInteractive(project, d))
      return fixesAndDiagnostics;
    });
    const flatCodeFixesAndDiagnostics = <FixAndDiagnostic[]>_.flatten(codefixesPerFile);
    fixesAndDiagnostics = flatCodeFixesAndDiagnostics.filter((fixAndDiagnostic) => fixAndDiagnostic.fix.changes.length > 0);
     // && codefix.fixName !== "fixMissingMember"); TODOFIX I probably wont need this once 49993 it's fixed
    noChangesFixes = flatCodeFixesAndDiagnostics.filter((fixAndDiagnostic) => fixAndDiagnostic.fix.changes.length === 0).map((fixAndDiagnostic) => { return fixAndDiagnostic.fix });
    for (let i = 0; i < fixesAndDiagnostics.length; i++) {
      let accepted = await getFileFixes(project, host, fixesAndDiagnostics[i]);
      if (accepted) {
        updatedCodeFixes.push(fixesAndDiagnostics[i].fix);
      }
    }
  }
  else {
    codefixesPerFile = filteredDiagnostics.map(function (d: readonly Diagnostic[]) {
      const codefixes = (getCodeFixesForFile(project, d))
      return codefixes;
    });
    const flatCodeFixes = <CodeFixAction[]>_.flatten(codefixesPerFile);
    codefixes = flatCodeFixes.filter((codefix) => codefix.changes.length > 0);
    noChangesFixes = flatCodeFixes.filter((codefix) => codefix.changes.length === 0);
  }

  // filter for codefixes if applicable, then organize textChanges by what file they alter
  const [textChangesByFile, filterCodefixOut] = opt.interactiveMode ? getTextChangeDict(opt, updatedCodeFixes, fixesAndDiagnostics.length) : getTextChangeDict(opt, codefixes);
  const [pendingChangesByFile, filterCodefixOut1] = getTextChangeDict(opt, noChangesFixes); //TODOFIX use this for summary

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

export function filterDiagnosticsByErrorCode(diagnostics: (readonly Diagnostic[])[], errorCodes: number[], validFiles?: string[]): [(readonly Diagnostic[])[], string[]] {
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
  else if (validFiles) {
    let length = 0;
    const filteredDiagnostics = diagnostics.filter((diagnostics) => diagnostics.length > 0);
    let returnDiagnostics = new Array<Diagnostic[]>;

    for (let i = 0; i < filteredDiagnostics.length; i++) {
      let index = 0;
      returnDiagnostics[i] = new Array<Diagnostic>;
      filteredDiagnostics[i].filter((diagnostic) => { //TODOFIX each array belongs to a file so this can be improved
        if (diagnostic.file) {
          if (validFiles.indexOf(path.normalize(diagnostic.file?.fileName)) != -1) {
            returnDiagnostics[i][index] = diagnostic;
            index++;
            length++;
          }
        }
      });
    }
    returnDiagnostics = returnDiagnostics.filter((diagnostics) => diagnostics.length > 0);

    let returnStrings = <string[]>[];
    if (length === 0) returnStrings.push(`No diagnostics founds for files`);
    else returnStrings.push(`Found ${length} diagnostics for given files`);

    return [returnDiagnostics, returnStrings]
  }
  // otherwise, use all errors
  return [diagnostics, ["Found " + _.reduce(diagnostics.map((d: { length: any; }) => d.length), function (sum, n) {
    return sum + n;
  }, 0) + " diagnostics in " + diagnostics.length + " files"]];
}

interface FixAndDiagnostic {
  fix: CodeFixAction;
  diagnostic: Diagnostic;
}

export function getCodeFixesForFile(project: Project, diagnostics: readonly Diagnostic[]): CodeFixAction[] {
  // expects already filtered diagnostics
  const service = project.languageService;
  return flatMap(diagnostics, d => {
    if (d.file && d.start !== undefined && d.length !== undefined) {
      return service.getCodeFixesAtPosition(
        d.file.fileName,
        d.start,
        d.start + d.length,
        [d.code],
        project.ts.getDefaultFormatCodeSettings(os.EOL),
        {}).map((fix) => {
          return fix;
        });
    } else {
      return [];
    }
  })
}

export function getCodeFixesForFileInteractive(project: Project, diagnostics: readonly Diagnostic[]): FixAndDiagnostic[] {
  // expects already filtered diagnostics
  const service = project.languageService;
  return flatMap(diagnostics, d => {
    if (d.file && d.start !== undefined && d.length !== undefined) {
      return service.getCodeFixesAtPosition(
        d.file.fileName,
        d.start,
        d.start + d.length,
        [d.code],
        project.ts.getDefaultFormatCodeSettings(os.EOL),
        {}).map((fix) => {
          return { fix, diagnostic: d };
        });
    } else {
      return [];
    }
  })
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

export function filterCodeFixesByFixName(codefixes: readonly CodeFixAction[], fixNames: string[], originalLength?: number): [readonly CodeFixAction[], string[]] {
  if (fixNames.length === 0) {
    // empty argument behavior... currently, we just keep all fixes if none are specified
    let returnStrings = <string[]>[];
    let codeFixes = new Set<string>();
    let fixesNames = new Array<string>();
    let fixesString = <string[]>[];
    const appliedFixesLength = codefixes.length;
    if (originalLength) {
      if (appliedFixesLength === 0) { fixesString.push(`Found ${originalLength} codefixes but none were accepted by the user`) }
      else if (appliedFixesLength === 1) { fixesString.push(`Found ${originalLength} codefixes but only 1 was accepted by the user`) }
      else { fixesString.push(`Found ${originalLength} codefixes but only ${appliedFixesLength} were accepted by the user`) }
    }
    if (!originalLength) {
      fixesString.push(`Found ${codefixes.length} codefixes`)
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

async function getFileFixes(project: Project, host: Host, codefix: FixAndDiagnostic): Promise<boolean> {
  for (let i = 0; i < codefix.fix.changes.length; i++) {
    const fileName = codefix.fix.changes[i].fileName
    const sourceFile = project.program.getSourceFile(fileName);
    if (sourceFile !== undefined) {
      for (let j = 0; j < codefix.fix.changes[i].textChanges.length; j++) {
        host.log(formatDiagnosticsWithColorAndContext([codefix.diagnostic], host));
        const userDecision = await getInputFromUser(codefix.fix.fixName);
        if (Choices.reject === userDecision) {
          return false;
        }
      }
    }
  }
  return true;
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
      throw new Error(`File ${fileName} not found in project`);
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

async function getInputFromUser(codefix: string): Promise<string> {
  const choice = await inquirer
    .prompt([
      {
        name: "choice",
        type: "list",
        message: `Would you like to apply the ${codefix} fix?`,
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
  const middle = `\x1b[32m${change.newText}\x1b[0m`;
  // const middle = change.newText;
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

function compareContentsAndLog(host: Host, str1: string, str2: string): void {//TODOFIX might not need anymore once I fix the other function
  let diff = diffChars(str1, str2);
  let stringDiff = "";
  diff.forEach((part) => {
    // green for additions, red for deletions
    // unset for common parts
    let color;
    if (part.added) color = 32;
    if (part.removed) color = 31;
    (part.added || part.removed) ? host.write(`\x1b[${color}m${part.value}\x1b[0m`) : host.write(`${part.value}`);
  });
  host.write(`\n`);
  host.write(stringDiff)
}

function writeToFile(fileName: string, fileContents: string, opt: Options, host: Host): string {
  const writeToFileName = getOutputFilePath(fileName, opt);
  const writeToDirectory = getDirectory(writeToFileName)
  if (!host.exists(writeToDirectory)) {
    host.mkdir(writeToDirectory);
  }
  host.writeFile(writeToFileName, fileContents);
  host.log("Updated " + path.relative(opt.cwd, writeToFileName));
  return writeToFileName;
}