import path from "path";
import { CodeFixAction, Diagnostic, FileTextChanges, getDefaultFormatCodeSettings, TextChange } from "typescript";
import { createProject, Project } from "@ts-morph/bootstrap";
import os from "os";
import fs from "fs";
import _ from "lodash";

export const tsConfigFilePathDefault = path.resolve(__dirname, "../test/exampleTest/tsconfig.json");
const outputFolderDefault = path.resolve(__dirname, "../test/exampleTestOutput");

function emitPath(filePath: string): string {
  const fileName = filePath.replace(/^.*[\\\/]/, '');
  return path.resolve(outputFolderDefault, fileName);
}

export async function codefixProject(tsconfigPath?: string) {
  if (tsconfigPath === undefined) {
    tsconfigPath = tsConfigFilePathDefault;
  }
  const firstPass = await applyCodefixesOverProject(tsconfigPath);

  // if overlap/non executed changes for some reason, redo process 
  if (!firstPass) {
    // maybe in applycodefixesoverproject we have an exit if no changes?
    // maybe emit some sort of diagnostic/statement? 
    // might need some other type/flag with more options besides boolean 
    return applyCodefixesOverProject(tsconfigPath);
  }

  return firstPass;
}



export async function applyCodefixesOverProject(tsconfigPath: string): Promise<boolean> {
  // get project object
  let project = await getProject(tsconfigPath);

  // pull all codefixes
  const diagnosticsPerFile = await getDiagnostics(project);

  // pull codefixes from diagnostics
  // since the type of change is associated with the codefix or the diagnostic,
  //   we should filter for which codefixes we want in this step, probably write 
  //   the filter into getCodeFixesForFile()
  const codefixesPerFile = diagnosticsPerFile.map(function (d) {
    return (getCodeFixesForFile(project, d)); // TODO: pass in filters, so maybe by fixName/Id
  });
  const codefixes = <CodeFixAction[]>_.flatten(codefixesPerFile);

  // organize textChanges by what file they alter
  const textChangesByFile = getTextChangeDict(codefixes);

  // edit each file
  let leftoverChanges = doAllTextChanges(project, textChangesByFile);

  // figure out returns alater....
  return leftoverChanges;
}

export async function getProject(tsConfigFilePath: string): Promise<Project> {
  return createProject({ tsConfigFilePath });
}

// function getFileNames(project: Project): string[] {
//   const files = project.getSourceFiles();
//   const fileNames = files.map(function(files) {
//     return files.fileName;
//   })
//   // console.log(fileNames);
//   return fileNames;
// }

export function getDiagnostics(project: Project): (readonly Diagnostic[])[] {
  const diagnostics = project.getSourceFiles().map(function (file) {
    return project.createProgram().getSemanticDiagnostics(file);
  });
  return diagnostics;
}

export function getCodeFixesForFile(project: Project, diagnostics: readonly Diagnostic[]): readonly CodeFixAction[] {
  const service = (project).getLanguageService();
  const codefixes = (<CodeFixAction[]>[]).concat.apply([], diagnostics.map(function (d) {
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

export function getTextChangeDict(codefixes: readonly CodeFixAction[]): Map<string, TextChange[]> {
  let textChangeDict = new Map<string, TextChange[]>();

  for (let i = 0; i < codefixes.length; i++) {
    const fix = codefixes[i];
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

function getFileNameAndTextChangesFromCodeFix(ftchanges: FileTextChanges): [string, TextChange[]] {
  return [ftchanges.fileName, [...ftchanges.textChanges]];
}

function doAllTextChanges(project: Project, textChanges: Map<string, TextChange[]>): boolean {
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
      let collision = applyCodefixesInFile(fileName, originalFileContents, fileFixes);
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

function applyCodefixesInFile(fileName: string, originalContents: string, textChanges: TextChange[]): boolean {
  // sort textchanges by start
  const sortedFixList = textChanges.sort((a, b) => a.span.start - b.span.start);

  // take some sort of issue (or none) with overlapping textchanges
  const [filteredFixList, allFixesValidSoFar] = filterOverlap(sortedFixList);

  // apply all remaining textchanges
  applyChangestoFile(fileName, originalContents, filteredFixList);

  // return 
  // if all fixes have been applied, then it is False that we expect to do another pass
  return !allFixesValidSoFar;
}


function filterOverlap(sortedFixList: TextChange[]): [TextChange[], boolean] {
  let filteredList = <TextChange[]>[];
  let droppedValues = false;
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
      droppedValues = true;
    }
  }
  return [filteredList, droppedValues];
}

function applyChangestoFile(fileName: string, originalContents: string, fixList: TextChange[]): void {
  // maybe we want to have this and subsequent functions to return a diagnostic
  // function expects fixList to be already sorted and filtered
  const newFileContents = doTextChanges(originalContents, fixList);
  writeToFile(fileName, newFileContents);
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

function doTextChangeOnString(currentFileText: string, change: TextChange): string {
  const prefix = currentFileText.substring(0, change.span.start);
  const middle = change.newText;
  const suffix = currentFileText.substring(change.span.start + change.span.length);
  return prefix + middle + suffix;
}


function writeToFile(fileName: string, fileContents: string): void {
  fs.writeFileSync(emitPath(fileName), fileContents);
}


