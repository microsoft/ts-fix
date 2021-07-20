import path from "path";
import { CodeFixAction, Diagnostic, FileTextChanges, getDefaultFormatCodeSettings, getOriginalNode, TextChange } from "typescript";
import { createProject, Project } from "@ts-morph/bootstrap";
import os from "os";
import fs from "fs";
import _ from "lodash";
// export const tsConfigFilePathDefault = path.resolve(__dirname, "../test/exampleTest/tsconfig.json");
// const outputFolderDefault = path.resolve(__dirname, "../test/exampleTestOutput");

export interface Options {
  tsconfigPath: string;
  outputFolder: string;
  errorCode: number[];
  fixName: string[];
}



export async function codefixProject(opt:Options) {
  const firstPass = await applyCodefixesOverProject(opt);

  // if overlap/non executed changes for some reason, redo process 
  if (!firstPass) {
    // maybe in applycodefixesoverproject we have an exit if no changes?
    // maybe emit some sort of diagnostic/statement? 
    // might need some other type/flag with more options besides boolean 
    return applyCodefixesOverProject(opt);
  }

  return firstPass;
}



export async function applyCodefixesOverProject(opt: Options): Promise<boolean> {
  // tsconfigPath: string, errorCode?: number|undefined
  // get project object
  let project = await getProject(opt.tsconfigPath);

  // pull all codefixes.
  const diagnosticsPerFile = await getDiagnostics(project);

  // pull codefixes from diagnostics.  If errorCode is specified, only pull fixes for that/those errors. 
  //    Otherwise, pull all fixes
  const codefixesPerFile = diagnosticsPerFile.map(function (d) {
    return (getCodeFixesForFile(project, d, opt)); 
  });
  const codefixes = <CodeFixAction[]>_.flatten(codefixesPerFile);

  // filter for codefixes if applicable, then 
  //    organize textChanges by what file they alter
  const textChangesByFile = getTextChangeDict(codefixes, opt);

  // edit each file
  let leftoverChanges = doAllTextChanges(project, textChangesByFile, opt);
  // figure out returns alater....
  return leftoverChanges;
}

export async function getProject(tsConfigFilePath: string): Promise<Project> {
  return createProject({ tsConfigFilePath });
}

export function getDiagnostics(project: Project): (readonly Diagnostic[])[] {
  const diagnostics = project.getSourceFiles().map(function (file) {
    return project.createProgram().getSemanticDiagnostics(file);
  });
  return diagnostics;
}

export function getCodeFixesForFile(project: Project, diagnostics: readonly Diagnostic[], opt: Options): readonly CodeFixAction[] {
  const service = (project).getLanguageService();
  const filteredDiagnostics = filterDiagnosticsByErrorCode(diagnostics,opt);
  const codefixes = (<CodeFixAction[]>[]).concat.apply([], filteredDiagnostics.map(function (d) {
    if (d.file && d.start !== undefined && d.length !== undefined) {
      return service.getCodeFixesAtPosition(
        d.file.fileName,
        d.start,
        d.start + d.length,
        [d.code],
        getDefaultFormatCodeSettings(os.EOL),
        {});
    } else {
      return [];
    }
  })).filter(d => d !== undefined);
  return codefixes;
}

export function filterDiagnosticsByErrorCode(diagnostics: readonly Diagnostic[], opt:Options): readonly Diagnostic[] {
  // if errorCodes were passed in, only use the specified errors
  if (opt.errorCode.length !== 0) {
    return _.filter(diagnostics, function (d) {return opt.errorCode.includes(d.code)});
    // TODO: maybe add more sophisiticated method of error matching?
  }
  // otherwise, use all errors
  return diagnostics;
}

function getFileTextChangesFromCodeFix(codefix: CodeFixAction): readonly FileTextChanges[] {
  return codefix.changes;
}

// function getTextChangesFromFileChanges(change : FileTextChanges) : readonly TextChange[] {
//   // do we need to make sure all codefixes apply to same file? my thinking is yes.
//   return change.textChanges;
// }

// function getTextChangesForCodeFix(codefix: CodeFixAction) : readonly TextChange[] {
//   // get 1d list of fileChanges list from list of codefixactions
//   const changesFromCodefix = codefix.changes;
//   const textChanges = _.flatten(changesFromCodefix.map(getTextChangesFromFileChanges));
//   return textChanges;
// }

export function getTextChangeDict(codefixes: readonly CodeFixAction[], opt: Options): Map<string, TextChange[]> {
  let textChangeDict = new Map<string, TextChange[]>();

  const filteredFixes = filterCodeFixesByFixName(codefixes, opt);
  for (let i = 0; i < filteredFixes.length; i++) {
    const fix = filteredFixes[i];
    const changes = getFileTextChangesFromCodeFix(fix);

    for (let j = 0; j < changes.length; j++) {
      let change = changes[j];
      let [key, value] = getFileNameAndTextChangesFromCodeFix(change);

      const prevVal = textChangeDict.get(key);
      if (prevVal === undefined) {
        textChangeDict.set(key, value);
      } else {
        textChangeDict.set(key, prevVal.concat(value));
      }
    }
  }

  return textChangeDict;
}

function filterCodeFixesByFixName(codefixes: readonly CodeFixAction[], opt: Options): CodeFixAction[] {
  return codefixes.filter(function (codefix) {return  opt.fixName.includes(codefix.fixName);});
}

function getFileNameAndTextChangesFromCodeFix(ftchanges: FileTextChanges): [string, TextChange[]] {
  return [ftchanges.fileName, [...ftchanges.textChanges]];
}

function doAllTextChanges(project: Project, textChanges: Map<string, TextChange[]>, opt: Options): boolean {
  let leftoverChanges = false;
  textChanges.forEach((fileFixes, fileName) => {
    const sourceFile = project.getSourceFile(fileName);

    if (sourceFile !== undefined) {
      const originalFileContents = sourceFile.text;
      // let fileFixes = textChanges.get(fileName);

      // if (fileFixes === undefined) {
      //   fileFixes = <TextChange[]> [];
      // }

      // collision is true if there were changes that were not applied 
      // also performs the writing to the file
      let [collision, newFileContents] = applyCodefixesInFile(originalFileContents, fileFixes);
      writeToFile(fileName, newFileContents, opt);
      if (collision) {
        leftoverChanges = collision;
      }
    }

    else {
      throw new Error('file ' + fileName + ' not found in project');
    }
  });

  return leftoverChanges;
}

function applyCodefixesInFile(originalContents: string, textChanges: TextChange[]):  [ boolean, string] {
  // sort textchanges by start
  const sortedFixList = textChanges.sort((a, b) => a.span.start - b.span.start);

  // take some sort of issue (or none) with overlapping textchanges
  const [filteredFixList, notAppliedFixes] = filterOverlappingFixes(sortedFixList);

  // apply all remaining textchanges
  const newFileContents = applyChangestoFile(originalContents, filteredFixList);
  
  // return 
  // if all fixes have been applied, then it is False that we expect to do another pass
  return [notAppliedFixes.length === 0, newFileContents];
}


export function filterOverlappingFixes(sortedFixList: TextChange[]): [TextChange[], TextChange[]] { //TODO: 1 test this function
  let filteredList = <TextChange[]>[];
  let droppedList = <TextChange[]>[];
  let currentEnd = -1;
  // why is 'fix' in the line below a string[], while sortedFixList is Textchange[]?
  // for (const fix in sortedFixList) {
  //   filteredList + [fix];
  // }
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

function applyChangestoFile(originalContents: string, fixList: TextChange[]): string {
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


function writeToFile(fileName: string, fileContents: string, opt: Options): void {
  const writeToFileName = getOutputFilePath(fileName, opt);
  const writeToDirectory =getDirectory(writeToFileName)
  if (!fs.existsSync(writeToDirectory)) {
    createDirectory(writeToDirectory);
  }
  fs.writeFileSync(writeToFileName , fileContents);
}

function createDirectory(directoryPath: string) {
  fs.mkdir(directoryPath, {recursive :true}, () => {});
}


function getOutputFilePath(filePath: string, opt: Options): string {
  const fileName = getRelativePath(filePath, opt);
  return path.resolve(opt.outputFolder, fileName);
}

export function getFileName(filePath: string): string {
  return filePath.replace(/^.*[\\\/]/, '');
}

export function getDirectory(filePath:string) :string {
  return filePath.substring(filePath.length - getFileName(filePath).length)
}

function getOutputBaseFolder( opt: Options):string {
  return opt.outputFolder;
}

export function getRelativePath(filePath: string, opt: Options): string{
  const baseFolder = opt.tsconfigPath.substring(opt.tsconfigPath.length - "tsconfig.json".length);
  return filePath.substring(baseFolder.length, filePath.length);
}
