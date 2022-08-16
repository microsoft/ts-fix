import path from "path";
import { CodeFixAction, Diagnostic, DiagnosticCategory, FileTextChanges, formatDiagnosticsWithColorAndContext, SourceFile, TextChange } from "typescript";
import os from "os";
import _, { flatMap, cloneDeep, isEqual } from "lodash";
import { createProject, Project } from "./ts";
import * as fs from "fs";
import { diffChars } from "diff";
import inquirer from "inquirer";
import { formatDiagnosticsWithColorAndContextTsFix, formatFixOnADifferentLocation } from "./utilities";
import { exec } from 'child_process';
import { option } from "yargs";

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
  file: string[];
  fixName: string[];
  write: boolean,
  fix: boolean,
  showMultiple: boolean,
  interactiveMode: boolean,
  ignoreGitStatus: boolean
}

const gitStatus = (dir: string) => new Promise<string>((resolve) => {
  const dirPath = path.dirname(dir);
  return exec(`git --git-dir="${dirPath + "\\.git"}" --work-tree="${dirPath}" status --porcelain`, (err, stdout) => {
    if (err) throw new Error(err.message);
    else if (typeof stdout === 'string') resolve(stdout.trim());
  });
});

const checkOptions = async (opt: Options): Promise<[string[], string[]]> => {

  if (!fs.existsSync(opt.tsconfig)) {
    throw new Error(`The tsconfig file doesn't exist on the path provided`);
  }

  //Check git status if the write flag was provided and the output folder is the same as the project folder. Do not allow the overwrite of files with previous changes on them unless --ignoreGitStatus flag was provided
  if (opt.write && path.dirname(opt.tsconfig) === opt.outputFolder) {
    let isModified = false;
    const status = await (gitStatus(opt.tsconfig));
    const splitStatus = status.split(/\r?\n/);
    if (splitStatus.length && splitStatus[0] != '') {
      const re = /[MARCD?]\s(package).+?(json)/g
      isModified = splitStatus.length && splitStatus[0] !== '' ? !(splitStatus.filter((text) => { return text.match(re) }).length === splitStatus.length) : false;
    }
    if (isModified && !opt.ignoreGitStatus) {
      throw new Error(`Please provide the --ignoreGitStatus flag if you are sure you'ld like to override your exisiting changes`);
    }
  }

  let validFiles = new Array<string>;
  let invalidFiles = new Array<string>;
  if (opt.file.length) {
    opt.file.forEach((file) => {
      file = path.join(path.dirname(opt.tsconfig), file);
      if (fs.existsSync(file)) {
        validFiles.push(file);
      }
      else {
        invalidFiles.push(file);
      }
    });
    if (!validFiles.length) {
      throw new Error(`All provided files are invalid`);
    }
  }
  return [validFiles, invalidFiles];
}

//TODOFIX - Keep this or remove?
enum starterText {
  'Give us a second to find your diagnostics' = 1,
  'We are creating the project please be patient' = 2,
  'Hold tight, we are finding your diagnostics' = 3,
}

function printSummary(host: Host, opt: Options, invalidFiles: string[], allChangedFiles: Map<string, ChangedFile>, pendingChangesByFile: Map<string, TextChange[]>): void {
  if (invalidFiles.length || pendingChangesByFile.size || opt.write) host.log("Summary: ")
  if (invalidFiles.length) {
    host.log("The following file paths are invalid:")
    invalidFiles.forEach((file) => host.log(file));
  }
  if (pendingChangesByFile.size) {
    host.log("There are some pending changes. This usually means you'll need to install missing dependencies. See details below:");
    pendingChangesByFile.forEach((change, fileName) => {
      host.log(`${change} ${fileName}`);
    })
  }
  if (opt.write) {
    const allChangedFilesSize = allChangedFiles.size;
    if (allChangedFilesSize === 0) host.log("No changes made in any files")
    if (allChangedFilesSize === 1) host.log("Changes were made in the following file:")
    else if (allChangedFilesSize > 1) {
      host.log("Changes were made in the following files:");
    }
    allChangedFiles.forEach((changedFile, fileName) => {
      writeToFile(fileName, changedFile.newText, opt, host);
    })
  }
}

export async function codefixProject(opt: Options, host: Host): Promise<string> {

  const [validFiles, invalidFiles] = await checkOptions(opt);

  const allChangedFiles = new Map<string, ChangedFile>();
  let allPendingChangesByFile = new Map<string, TextChange[]>; //TODOFIX - Use pendingChangesByFile in summary
  let passCount = 0;

  while (true) {

    if (passCount === 0) host.log("The project is being created...");
    // if (passCount === 0) host.log(starterText[Math.ceil(Math.random() * (3 - 0) + 0)]);

    const project = createProject({ tsConfigFilePath: opt.tsconfig }, allChangedFiles);
    if (!project) return "Error: Could not create project.";

    if (passCount === 0) host.log("Using TypeScript " + project.ts.version);

    const [textChangesByFile, pendingChangesByFile] = await getCodeFixesFromProject(project, opt, host, validFiles);
    const { changedFiles, excessChanges } = await getChangedFiles(project, textChangesByFile);
    changedFiles.forEach((change, fileName) => {
      allChangedFiles.set(fileName, change)
    });
    host.addRemainingChanges(excessChanges);

    if (hasOnlyEmptyLists(excessChanges)) {
      host.log("No changes remaining for ts-fix\n");
      break;
    } else {
      host.log(excessChanges.size + " changes remaining. Initiating additional pass...\n"); //TODOFIX - Take a look at this, the count is a little misleading
    }

    passCount++;
  }

  printSummary(host, opt, invalidFiles, allChangedFiles, allPendingChangesByFile);

  return "Done";
}

//TODOFIX - Missing additional conditions
// Finds the fixes that don't make any changes (install module), and out of scope of the use case such as import, fixMissingFunctionDeclaration
function isNoAppliedFix(fixAndDiagnostic: FixAndDiagnostic): boolean {
  return !fixAndDiagnostic.fix.changes.length
    || fixAndDiagnostic.fix.fixName === 'import'
    || fixAndDiagnostic.fix.fixName === 'fixMissingFunctionDeclaration'
  // && codefix.fixName !== "fixMissingMember"); TODOFIX - I probably wont need this once issue 49993 is fixed
}


function getAppliedAndNoAppliedFixes(flatCodeFixesAndDiagnostics: FixAndDiagnostic[]): [FixAndDiagnostic[], CodeFixAction[]] {
  let fixesAndDiagnostics: FixAndDiagnostic[] = [];
  let noAppliedFixes: CodeFixAction[] = [];
  flatCodeFixesAndDiagnostics.forEach((fixAndDiagnostic) => {
    if (isNoAppliedFix(fixAndDiagnostic)) noAppliedFixes.push(fixAndDiagnostic.fix);
    else fixesAndDiagnostics.push(fixAndDiagnostic);
  })
  return [fixesAndDiagnostics, noAppliedFixes]
}

export async function getCodeFixesFromProject(project: Project, opt: Options, host: Host, validFiles: string[]): Promise<[Map<string, TextChange[]>, Map<string, TextChange[]>]> {

  // pull all codefixes.
  const diagnosticsPerFile = getDiagnostics(project);

  if (!diagnosticsPerFile.length) {
    host.log("No more diagnostics.");
    return [new Map<string, TextChange[]>(), new Map<string, TextChange[]>]
  }

  // pull codefixes from diagnostics.  If errorCode is specified, only pull fixes for that/those errors. If file is specified, only pull fixes for that/those files.
  //    Otherwise, pull all fixes
  let [filteredDiagnostics, acceptedDiagnosticsOut] = filterDiagnosticsByErrorCode(diagnosticsPerFile, opt.errorCode, validFiles); //TODOFIX - Instead of finding noAppliedFixes later, diagnostics codes that are out could be removed here, is that an option?
  acceptedDiagnosticsOut.forEach((string_describe: unknown) => {
    host.log(string_describe);
  });

  let codefixesPerFile;
  let codefixes: readonly CodeFixAction[] = [];
  let fixesAndDiagnostics: FixAndDiagnostic[] = [];
  let fixesAndDiagnosticsLength = 0;
  let updatedCodeFixes: CodeFixAction[] = [];
  let noAppliedFixes: CodeFixAction[] = [];

  //TODOFIX - Rework this so that the function doesn't contain this if/else
  if (opt.interactiveMode) {
    codefixesPerFile = filteredDiagnostics.map(function (d: readonly Diagnostic[]) {
      const fixesAndDiagnostics = (getCodeFixesForFileInteractive(project, d))
      return fixesAndDiagnostics;
    });
    const flatCodeFixesAndDiagnostics = <FixAndDiagnostic[]>_.flatten(codefixesPerFile);
    [fixesAndDiagnostics, noAppliedFixes] = getAppliedAndNoAppliedFixes(flatCodeFixesAndDiagnostics);

    if (!opt.showMultiple) {
      fixesAndDiagnostics = removeMutilpleDiagnostics(fixesAndDiagnostics);
    }

    fixesAndDiagnostics = removeDuplicatedFixes(fixesAndDiagnostics);
    fixesAndDiagnosticsLength = fixesAndDiagnostics.length;
    updatedCodeFixes = await getFileFixes(project, host, opt, fixesAndDiagnostics);
  }
  else {
    codefixesPerFile = filteredDiagnostics.map(function (d: readonly Diagnostic[]) {
      const codefixes = (getCodeFixesForFile(project, d))
      return codefixes;
    });
    const flatCodeFixes = <CodeFixAction[]>_.flatten(codefixesPerFile);
    codefixes = flatCodeFixes.filter((codefix) => codefix.changes.length);
    noAppliedFixes = flatCodeFixes.filter((codefix) => !codefix.changes.length);
  }

  // filter for codefixes if applicable, then organize textChanges by what file they alter
  const [textChangesByFile, filterCodefixOut] = opt.interactiveMode ? getTextChangeDict(opt, updatedCodeFixes, fixesAndDiagnosticsLength) : getTextChangeDict(opt, codefixes);
  const [pendingChangesByFile, filterCodefixOutNoChangeFixes] = getTextChangeDict(opt, noAppliedFixes);
  filterCodefixOut.forEach((s: string) => { host.log(s); });

  return [textChangesByFile, pendingChangesByFile];
}

export function getDiagnostics(project: Project): (readonly Diagnostic[])[] {
  const diagnostics = project.program.getSourceFiles().map(function (file: SourceFile) {
    return project.program.getSemanticDiagnostics(file);
  });
  return diagnostics;
}


export function filterDiagnosticsByErrorCode(diagnostics: (readonly Diagnostic[])[], errorCodes: number[], validFiles?: string[]): [(readonly Diagnostic[])[], string[]] {
  // if errorCodes were passed in, only use the specified errors
  // diagnostics is guaranteed to not be [] or [[]]
  let returnStrings = <string[]>[];
  if (errorCodes.length || validFiles?.length) {
    if (validFiles?.length) {
      let length = 0;
      const filteredDiagnostics = diagnostics.filter((diagnostics) => diagnostics.length);
      let returnDiagnostics = new Array<Diagnostic[]>;

      for (let i = 0; i < filteredDiagnostics.length; i++) {
        let index = 0;
        returnDiagnostics[i] = new Array<Diagnostic>;
        filteredDiagnostics[i].filter((diagnostic) => { //TODOFIX - Each filteredDiagnostics array corresponds to a single file so this can be improved
          if (diagnostic.file && validFiles) {
            if (validFiles.indexOf(path.normalize(diagnostic.file?.fileName)) != -1) {
              returnDiagnostics[i][index] = diagnostic;
              index++;
              length++;
            }
          }
        });
      }
      returnDiagnostics = returnDiagnostics.filter((diagnostics) => diagnostics.length);
      diagnostics = returnDiagnostics;

      if (length === 0) returnStrings.push(`No diagnostics founds for files`);
      else returnStrings.push(`Found ${length} diagnostics for given files`);
    }


    if (errorCodes.length) {
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
        if (filteredDiagnostic.length) {
          filteredDiagnostics.push(filteredDiagnostic);
        }
      }

      errorCodes.forEach((code: number) => {
        const count = errorCounter.get(code);
        if (count === undefined) {
          returnStrings.push(`No diagnostics found with code ${code}`);
        } else {
          returnStrings.push(`Found ${count} diagnostics with code ${code}`);
        }
      });

      diagnostics = filteredDiagnostics;
    }

    return [diagnostics, returnStrings]
  }

  // otherwise, use all errors
  else return [diagnostics.filter((diagnostic) => diagnostic.length), [`Found ${_.reduce(diagnostics.map((d: { length: any; }) => d.length), function (sum, n) {
    return sum + n;
  }, 0)} diagnostics in ${diagnostics.length} files`]];
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
        {}).map((fix: CodeFixAction) => {
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
    if (d.file && d.start && d.length) {
      return service.getCodeFixesAtPosition(
        d.file.fileName,
        d.start,
        d.start + d.length,
        [d.code],
        project.ts.getDefaultFormatCodeSettings(os.EOL),
        {}).map((fix: CodeFixAction) => {
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
  if (!fixNames.length) {
    // empty argument behavior... currently, we just keep all fixes if none are specified
    let returnStrings = <string[]>[];
    let codeFixes = new Set<string>();
    let fixesNames = new Array<string>();
    let fixesString: string[] = [];
    let fixesFound = '';
    const appliedFixesLength = codefixes.length;
    //TODOFIX - This count is off because of the fixes in the same line
    if (originalLength) {
      if (appliedFixesLength === 0) { returnStrings.push(`Found ${originalLength} codefixes and none were accepted by the user`); }
      else if (appliedFixesLength === originalLength) { returnStrings.push(`Found ${originalLength} codefixes and all were accepted by user`); }
      else if (appliedFixesLength === 1) { returnStrings.push(`Found ${originalLength} codefixes, 1 code fix was accepted by the user`); }
      else { returnStrings.push(`Found ${originalLength} codefixes, ${appliedFixesLength} were accepted by the user`); }
    }
    if (!originalLength) {
      fixesFound += `Found ${codefixes.length} codefixes`;
      codefixes.forEach((codeFix: CodeFixAction) => {
        if (codeFix.fixName !== undefined && !codeFixes.has(codeFix.fixName)) {
          codeFixes.add(codeFix.fixName);
          fixesNames.push(codeFix.fixName);
        }
      })
      const fixesLength = fixesNames.length;
      if (fixesLength === 1) {
        fixesFound += `. Fix ${fixesNames[0]} was found`;
      }
      if (fixesLength >= 2) {
        fixesFound += `. The codefixes found are: `;
        for (let i = 0; i < fixesLength; i++) {
          fixesFound += fixesNames[i];
          if (i !== fixesLength - 1) {
            fixesFound += `, `;
          }
        }
      }
    }
    returnStrings.push(fixesFound);
    return [codefixes, returnStrings];
  }

  // cannot sort by fixId right now since fixId is a {}
  // do we want to distinguish the case when no codefixes are picked? (no hits)

  let fixCounter = new Map<string, number>();
  let out: string[] = [];
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
      out.push(`No codefixes found with name ${name}`);
    } else {
      out.push(`Found ${count} codefixes with name ${name}`);
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

async function getUpdatedCodeFixesAndDiagnostics(codeFixesAndDiagnostics: FixAndDiagnostic[], codefixes: CodeFixAction[], count: number, showMultiple?: boolean): Promise<[FixAndDiagnostic[], CodeFixAction[]]> {
  const currentDiagnostic = codeFixesAndDiagnostics[0].diagnostic;
  const currentCodeFix = codeFixesAndDiagnostics[0].fix;
  const userInput = await getInputFromUser(codeFixesAndDiagnostics[0].fix, showMultiple);

  if (userInput === Choices.ACCEPT) {
    if (showMultiple) {
      codefixes.push(currentCodeFix);
      codeFixesAndDiagnostics = removeMutilpleDiagnostics(codeFixesAndDiagnostics, Choices.ACCEPT)
    }
    else {
      codefixes.push(currentCodeFix);
      codeFixesAndDiagnostics.splice(0, count);
    };
  }
  else if (userInput === Choices.ACCEPTALL) {
    if (showMultiple) {
      codeFixesAndDiagnostics = removeMutilpleDiagnostics(codeFixesAndDiagnostics, Choices.ACCEPTALL);
    }
    let updatedFixesAndDiagnostics = codeFixesAndDiagnostics.filter((diagnosticAndFix) => diagnosticAndFix.diagnostic.code === currentDiagnostic.code);
    updatedFixesAndDiagnostics.map((diagnosticAndFix) => {
      return codefixes.push(diagnosticAndFix.fix);
    });
    codeFixesAndDiagnostics = codeFixesAndDiagnostics.filter((diagnosticAndFix) => diagnosticAndFix.diagnostic.code !== codeFixesAndDiagnostics[0].diagnostic.code);
  }
  else if (userInput === Choices.SKIPALL) {
    let updatedFixesAndDiagnostics = codeFixesAndDiagnostics.filter((diagnosticAndFix) => diagnosticAndFix.diagnostic.code === currentDiagnostic.code);
    updatedFixesAndDiagnostics.forEach(diagnosticAndFix => codeFixesAndDiagnostics.splice(codeFixesAndDiagnostics.findIndex(fixAndDiagnostic => fixAndDiagnostic.diagnostic.code === diagnosticAndFix.diagnostic.code), count))
  }
  else if (userInput === Choices.SKIP) {
    codeFixesAndDiagnostics.splice(0, count);
  }
  else if (userInput === Choices.SHOWMULTIPLE) {
    const chooseCodeFix = await getUserPick(codeFixesAndDiagnostics.slice(0, count))
    //TODOFIX - Implement Back option
    // if (chooseCodeFix === Choices.BACK) {}
    if (codeFixesAndDiagnostics.filter((codeFixAndDiagnostic) => `"${codeFixAndDiagnostic.fix.fixName}" fix with description "${codeFixAndDiagnostic.fix.description}"` === chooseCodeFix).length) {
      codefixes.push(codeFixesAndDiagnostics.filter((codeFixAndDiagnostic) => `"${codeFixAndDiagnostic.fix.fixName}" fix with description "${codeFixAndDiagnostic.fix.description}"` === chooseCodeFix)[0].fix);
    }
    codeFixesAndDiagnostics.splice(0, count);
  }
  return [codeFixesAndDiagnostics, codefixes];
}


async function getUserPick(currentFixesAndDiagnostics: FixAndDiagnostic[]): Promise<string> {
  const choices = currentFixesAndDiagnostics.map((codeFixAndDiagnostic) => {
    return `"${codeFixAndDiagnostic.fix.fixName}" fix with description "${codeFixAndDiagnostic.fix.description}"`
  });
  // choices.push(Choices.BACK);
  const choice = await inquirer
    .prompt([
      {
        name: "codeFix",
        type: "list",
        message: `Which fix would you like to apply?`,
        choices: choices
      },
    ]);
  return choice.codeFix;
};

export interface ChangeDiagnostic {
  file?: SourceFile,
  start?: number,
  length?: number,
}

// TODOFIX - Should make DRY
// Removes multiple code fixes for the diagnostic if the user accepts the first one
// Removes mutliple code fixes if the user decides to accept all of that type
// Removes additional code fixes if the user decides not to show multiple
// It will always keep the first code fix returned for the diagnostic
function removeMutilpleDiagnostics(codeFixesAndDiagnostics: FixAndDiagnostic[], choice?: Choices.ACCEPT | Choices.ACCEPTALL): FixAndDiagnostic[] {
  if (choice === Choices.ACCEPT) {
    for (let i = 1; i < codeFixesAndDiagnostics.length; i++) {
      let count = 1;
      if (codeFixesAndDiagnostics[0].diagnostic.code === codeFixesAndDiagnostics[i].diagnostic.code && codeFixesAndDiagnostics[0].diagnostic.length === codeFixesAndDiagnostics[i].diagnostic.length && codeFixesAndDiagnostics[0].diagnostic.start === codeFixesAndDiagnostics[i].diagnostic.start) {
        let j = i;
        while (codeFixesAndDiagnostics[j] && codeFixesAndDiagnostics[0].diagnostic.code === codeFixesAndDiagnostics[j].diagnostic.code && codeFixesAndDiagnostics[0].diagnostic.length === codeFixesAndDiagnostics[j].diagnostic.length && codeFixesAndDiagnostics[0].diagnostic.start === codeFixesAndDiagnostics[j].diagnostic.start) {
          j++;
          count++;
        }
        codeFixesAndDiagnostics.splice(0, count);
      }
    }
  }
  // TODOFIX - Implement and test this
  else if (choice === Choices.ACCEPTALL) {

  }
  else {
    for (let i = 0; i < codeFixesAndDiagnostics.length; i++) {
      let count = 1;
      if (codeFixesAndDiagnostics[i + 1] && codeFixesAndDiagnostics[i].diagnostic.code === codeFixesAndDiagnostics[i + 1].diagnostic.code && codeFixesAndDiagnostics[i].diagnostic.length === codeFixesAndDiagnostics[i + 1].diagnostic.length && codeFixesAndDiagnostics[i].diagnostic.start === codeFixesAndDiagnostics[i + 1].diagnostic.start) {
        let j = i;
        while (codeFixesAndDiagnostics[j + 1] && codeFixesAndDiagnostics[j].diagnostic.code === codeFixesAndDiagnostics[j + 1].diagnostic.code && codeFixesAndDiagnostics[j].diagnostic.length === codeFixesAndDiagnostics[j + 1].diagnostic.length && codeFixesAndDiagnostics[j].diagnostic.start === codeFixesAndDiagnostics[j + 1].diagnostic.start) {
          j++;
          count++;
        }
        codeFixesAndDiagnostics.splice(i + 1, count - 1);
      }
    }
  }
  return codeFixesAndDiagnostics;
}

// Removes duplicate code fixes
function removeDuplicatedFixes(codeFixesAndDiagnostics: FixAndDiagnostic[]): FixAndDiagnostic[] {
  for (let i = 0; i < codeFixesAndDiagnostics.length; i++) {
    for (let j = i + 1; j < codeFixesAndDiagnostics.length; j++) {
      if (i !== j && isEqual(codeFixesAndDiagnostics[i].fix, codeFixesAndDiagnostics[j].fix) && codeFixesAndDiagnostics[i].diagnostic.messageText === codeFixesAndDiagnostics[j].diagnostic.messageText) {
        codeFixesAndDiagnostics.splice(j, 1);
      }
    }
  }
  return codeFixesAndDiagnostics;
}

function getSecondDiagnostic(project: Project, fileName: string, currentCodeFix: CodeFixAction, currentTextChanges: readonly TextChange[]): ChangeDiagnostic {
  let secondDiagnostic: ChangeDiagnostic = {};
  let secondFileContents = undefined;
  let secondFileCurrentLineMap = undefined;
  const newSourceFile = project.program.getSourceFile(fileName);
  const secondSourceFile = cloneDeep(newSourceFile)
  if (secondSourceFile) {
    secondDiagnostic.file = secondSourceFile;
    secondDiagnostic.start = currentCodeFix.changes[0].textChanges[0].span.start;
    secondDiagnostic.length = currentCodeFix.changes[0].textChanges[0].newText.length;
  }
  secondFileContents = secondSourceFile ? secondSourceFile.text : undefined;
  secondFileCurrentLineMap = secondSourceFile ? (secondSourceFile as any).lineMap : undefined;
  (secondSourceFile as any).lineMap = undefined;
  if (secondFileContents) {
    const newFileContents = applyChangestoFile(secondFileContents, currentTextChanges, true);
    if (secondDiagnostic.file) secondDiagnostic.file.text = newFileContents;
  }
  return secondDiagnostic;
}

//There are more than one quick fix for the same diagnostic
//If the --showMultiple flag is being used then ask the user which fix to apply, otherwise apply the first fix given for the diagnostic every time
function isAdditionalFixForSameDiagnostic(codeFixesAndDiagnostics: FixAndDiagnostic[], first: number): boolean {
  if (codeFixesAndDiagnostics[first + 1]) {
    const firstDiagnostic = codeFixesAndDiagnostics[first].diagnostic;
    const secondDiagnostic = codeFixesAndDiagnostics[first + 1].diagnostic;
    return firstDiagnostic.code === secondDiagnostic.code && firstDiagnostic.length === secondDiagnostic.length && firstDiagnostic.start === secondDiagnostic.start;
  }
  return false;
}

//There is more than one fix being applied on the same line (eg. infer parameter types from usage)
//If there is more than one fix being applied on the same line we should display them to the user at the same time
function isAdditionalFixInTheSameLine(codeFixesAndDiagnostics: FixAndDiagnostic[], first: number): boolean {
  if (codeFixesAndDiagnostics[first + 1]) {
    const firstDiagnosticAndFix = codeFixesAndDiagnostics[first];
    const secondDiagnosticAndFix = codeFixesAndDiagnostics[first + 1];
    return firstDiagnosticAndFix.diagnostic.messageText !== secondDiagnosticAndFix.diagnostic.messageText
      && firstDiagnosticAndFix.diagnostic.code === secondDiagnosticAndFix.diagnostic.code
      && firstDiagnosticAndFix.fix.changes[0].fileName === secondDiagnosticAndFix.fix.changes[0].fileName
      && firstDiagnosticAndFix.fix.changes[0].textChanges.length === secondDiagnosticAndFix.fix.changes[0].textChanges.length
      && isEqual(firstDiagnosticAndFix.fix.changes[0].textChanges, secondDiagnosticAndFix.fix.changes[0].textChanges);
  }
  return false;
}

function isFixAppliedToTheSameSpan(codeFixesAndDiagnostics: FixAndDiagnostic[], first: number) {
  if (codeFixesAndDiagnostics[first + 1]) {
    const firstDiagnosticAndFix = codeFixesAndDiagnostics[first];
    const secondDiagnosticAndFix = codeFixesAndDiagnostics[first + 1];
    return firstDiagnosticAndFix.diagnostic.code === secondDiagnosticAndFix.diagnostic.code &&
      firstDiagnosticAndFix.fix.changes[0].fileName === secondDiagnosticAndFix.fix.changes[0].fileName
      && firstDiagnosticAndFix.fix.changes[0].textChanges[0].newText !== secondDiagnosticAndFix.fix.changes[0].textChanges[0].newText
      && firstDiagnosticAndFix.fix.changes[0].textChanges[0].span.start === secondDiagnosticAndFix.fix.changes[0].textChanges[0].span.start
      && firstDiagnosticAndFix.fix.changes[0].textChanges[0].span.length === secondDiagnosticAndFix.fix.changes[0].textChanges[0].span.length;
  }
  return false;
}

async function displayDiagnostic(project: Project, host: Host, opt: Options, codeFixesAndDiagnostics: FixAndDiagnostic[], codefixes: CodeFixAction[]): Promise<[FixAndDiagnostic[], CodeFixAction[]]> {
  let currentUpdatedCodeFixes: CodeFixAction[] = [];
  let updatedFixesAndDiagnostics: FixAndDiagnostic[] = [];
  const currentCodeFix: CodeFixAction = codeFixesAndDiagnostics[0].fix;
  const currentDiagnostic = codeFixesAndDiagnostics[0].diagnostic;
  let diagnosticsInTheSameLine: Diagnostic[] = [];
  let count = 1;

  if (isAdditionalFixForSameDiagnostic(codeFixesAndDiagnostics, 0)) {
    let j = 0;
    while (isAdditionalFixForSameDiagnostic(codeFixesAndDiagnostics, j)) {
      j++;
      count++;
    }
  }

  if (isAdditionalFixInTheSameLine(codeFixesAndDiagnostics, 0)) {
    let j = 0;
    diagnosticsInTheSameLine.push(codeFixesAndDiagnostics[j].diagnostic);
    while (isAdditionalFixInTheSameLine(codeFixesAndDiagnostics, j)) {
      j++;
      count++;
      diagnosticsInTheSameLine.push(codeFixesAndDiagnostics[j].diagnostic);
    }
  }

  //TODOFIX - Implement this for when both fixes are applied to the same span but the fixes aren't equal
  if (isFixAppliedToTheSameSpan(codeFixesAndDiagnostics, 0)) {
    console.log("Fix is applied to the same span");
  }

  if (codeFixesAndDiagnostics[0].fix.changes.length > 1) {
    //Haven't seen a case where this is true yet
    host.log("The fix.changes array contains more than one element");
  }
  else {
    let sourceFile = currentDiagnostic.file?.fileName ? project.program.getSourceFile(currentDiagnostic.file?.fileName) : undefined;
    let currentTextChanges: readonly TextChange[] = currentCodeFix.changes[0].textChanges;
    const changesFileName = currentCodeFix.changes[0].fileName;
    let changesOnDifferentLocation = false;
    if (sourceFile !== undefined) {
      let secondDiagnostic: ChangeDiagnostic = {}; // Needed when changes are made on a different file or in the same file but a different location
      const originalContents = sourceFile.text;
      const currentLineMap = (sourceFile as any).lineMap;

      // Changes are made on a different file
      if (currentDiagnostic.file?.fileName !== changesFileName) {
        changesOnDifferentLocation = true;
        secondDiagnostic = getSecondDiagnostic(project, changesFileName, currentCodeFix, currentTextChanges);
      }
      else {
        let matchesDiagnosticStartAndLength = false;
        if (currentTextChanges.length === 1) {
          matchesDiagnosticStartAndLength = currentDiagnostic.start && currentDiagnostic.length ? currentTextChanges[0].span.start === currentDiagnostic.start + currentDiagnostic.length || currentTextChanges[0].span.start === currentDiagnostic.start : false;
        }
        // If there are more than one fix
        if (currentTextChanges.length > 1) {
          //First check if there's a text change with the start that matches the diagnostic start + length
          //Second check if there's a text change that matches the start but not start + length
          matchesDiagnosticStartAndLength = currentTextChanges.find((textChange) => {
            return (currentDiagnostic.start && currentDiagnostic.length && textChange.span.start === currentDiagnostic.start + currentDiagnostic.length);
          }) ? true : currentTextChanges.find((textChange) => {
            return (currentDiagnostic.start && currentDiagnostic.length && textChange.span.start === currentDiagnostic.start);
          }) ? true : false;
        }

        // Changes are made in the same file but on a different location
        if (!matchesDiagnosticStartAndLength) {
          changesOnDifferentLocation = true;
          secondDiagnostic = getSecondDiagnostic(project, changesFileName, currentCodeFix, currentTextChanges);
        }
      }

      // Changes are made in the same file in the same location where the diagnostic is
      if (!changesOnDifferentLocation) {
        (sourceFile as any).lineMap = undefined;
        const newFileContents = applyChangestoFile(originalContents, currentTextChanges, true);
        if (currentDiagnostic.file) currentDiagnostic.file.text = newFileContents;
      }

      diagnosticsInTheSameLine.length ? host.log(formatDiagnosticsWithColorAndContextTsFix(diagnosticsInTheSameLine, host)) : host.log(formatDiagnosticsWithColorAndContext([currentDiagnostic], host));

      // Display fix on different location
      if (changesOnDifferentLocation && secondDiagnostic) {
        host.log(`Please review the fix below for the diagnostic above`);
        host.log(formatFixOnADifferentLocation([secondDiagnostic], host));
      }

      //Get user's choice and updated fixes and diagnostics
      const showMultiple = opt.showMultiple && count > 1 && !diagnosticsInTheSameLine.length;
      [updatedFixesAndDiagnostics, currentUpdatedCodeFixes] = await getUpdatedCodeFixesAndDiagnostics(codeFixesAndDiagnostics, codefixes, count, showMultiple); //TODOFIX - I believe that if I have diagnosticsInTheSameLine as an argument, I can eliminate duplicates in codefixes

      //Reset text and lineMap to their original contents
      if (currentDiagnostic.file) currentDiagnostic.file.text = originalContents;
      (sourceFile as any).lineMap = currentLineMap;

    }
  }
  return [updatedFixesAndDiagnostics, currentUpdatedCodeFixes];
}

async function getFileFixes(project: Project, host: Host, opt: Options, codeFixesAndDiagnostics: FixAndDiagnostic[]): Promise<CodeFixAction[]> {
  let codefixes: CodeFixAction[] = [];
  let updatedFixesAndDiagnostics: FixAndDiagnostic[] = [];
  let currentUpdatedCodeFixes: CodeFixAction[] = [];

  for (let i = 0; i < codeFixesAndDiagnostics.length; i++) {
    [updatedFixesAndDiagnostics, currentUpdatedCodeFixes] = await displayDiagnostic(project, host, opt, codeFixesAndDiagnostics, codefixes);
    codeFixesAndDiagnostics = updatedFixesAndDiagnostics;
    codefixes = currentUpdatedCodeFixes;
    i = -1;
  }
  return codefixes;
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
  const sortedFixList = sortChangesByStart(textChanges); //Adds duplicates

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
  ACCEPT = 'Accept',
  ACCEPTALL = 'Accept all quick fixes for this diagnostic code in this pass',
  BACK = 'Go back',
  SKIPALL = 'Skip this diagnostic code this pass',
  SKIP = 'Skip',
  SHOWMULTIPLE = 'Show more quick fixes for this diagnostic'
}

async function getInputFromUser(codefix: CodeFixAction, showMultiple?: boolean): Promise<string> {
  const choice = await inquirer
    .prompt([
      {
        name: "choice",
        type: "list",
        message: `Would you like to apply the ${codefix.fixName} fix with description "${codefix.description}"?`,
        choices: showMultiple ? [Choices.ACCEPT, Choices.ACCEPTALL, Choices.SKIPALL, Choices.SKIP, Choices.SHOWMULTIPLE] : [Choices.ACCEPT, Choices.ACCEPTALL, Choices.SKIPALL, Choices.SKIP]
      },
    ]);
  return choice.choice;
};


function applyChangestoFile(originalContents: string, fixList: readonly TextChange[], isGetFileFixes?: boolean): string {
  // maybe we want to have this and subsequent functions to return a diagnostic
  // function expects fixList to be already sorted and filtered
  const newFileContents = doTextChanges(originalContents, fixList, isGetFileFixes);
  return newFileContents;
}

export function doTextChanges(fileText: string, textChanges: readonly TextChange[], isGetFileFixes?: boolean): string {
  // does js/ts do references? Or is it always a copy when you pass into a function
  // iterate through codefixes from back
  for (let i = textChanges.length - 1; i >= 0; i--) {
    // apply each codefix
    fileText = doTextChangeOnString(fileText, textChanges[i], isGetFileFixes);
  }
  return fileText;
}

export function doTextChangeOnString(currentFileText: string, change: TextChange, isGetFileFixes?: boolean): string {
  const prefix = currentFileText.substring(0, change.span.start);
  let middle = "";
  // if (isGetFileFixes) middle = `\x1b[32m${change.newText}\x1b[0m`;
  if (isGetFileFixes) middle = compareContentsAndLog(currentFileText.substring(change.span.start, change.span.start + change.span.length), change.newText);
  else middle = change.newText;
  // const middle = change.newText;
  const suffix = currentFileText.substring(change.span.start + change.span.length);
  return prefix + middle + suffix;
}

function compareContentsAndLog(str1: string, str2: string): string {
  let diff = diffChars(str1, str2);
  let middleString = "";
  let newLine = "\r\n";
  diff.forEach((part) => {
    // green for additions, red for deletions
    // unset for common parts
    let color;
    if (part.added) color = 32;
    if (part.removed) color = 31;
    if (part.added || part.removed) {
      //Purely aesthetics
      if (part.value.startsWith(newLine)) {
        middleString += newLine;
        middleString += `\x1b[${color}m${part.value.substring(2)}\x1b[0m`;
      }
      else {
        middleString += `\x1b[${color}m${part.value}\x1b[0m`;
      }

    }
    else {
      middleString += `${part.value}`;
    }
  });
  return middleString;
}

function hasOnlyEmptyLists(m: ReadonlyMap<any, readonly any[]>): boolean {
  let arrayLength = 0;
  for (const [_, entries] of m.entries()) {
    if (entries.length) {
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