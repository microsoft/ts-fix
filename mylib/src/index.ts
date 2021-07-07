import path from "path";
import { CodeFixAction, Diagnostic, FileTextChanges, getDefaultFormatCodeSettings, TextChange } from "typescript";
import { createProject, Project } from "@ts-morph/bootstrap";
import os from "os";
var _ = require('loadash/array')

const tsConfigFilePath = path.resolve(__dirname, "../test/exampleTest/tsconfig.json");

export async function codefixProject() {
  const firstPass = await applyCodefixesOverProject();

  // if overlap/non executed changes for some reason, redo process 
  if (!firstPass) {
    // maybe in applycodefixesoverproject we have an exit if no changes?
    // maybe emit some sort of diagnostic/statement? 
    // might need some other type/flag with more options besides boolean 
    applyCodefixesOverProject();
  }
  
  return; 
}



export async function applyCodefixesOverProject() : Promise<readonly boolean> {
  // get project object
  let project = await getProject();
  
  // pull all codefixes
  const diagnosticsPerFile = await getDiagnostics(project);

  // format codefixes -- pull text edits
  // since the type of change is associated with the codefix or the diagnostic,
  //   we should filter for which codefixes we want in this step, probably write 
  //   the filter into getCodeFixesForFile()
  const codefixesPerFile = diagnosticsPerFile.map(function (d) {
    return (getCodeFixesForFile(project, d));
 });
 const codefixes = _.flatten(codefixesPerFile);

  // format codefixes -- put into dictionary by file
  //                  -- file is specified by fileChange so this sorting is done
  //                        within the getTextChangesForCodeFix 
 const textChangesPerFile = getTextChangesForCodeFix( codefixes );
  //  .map(function (fixList) {
  //    return getTextChangesForCodeFix(fixList);
  //  });


  // edit each file, filter for overlap


  for (d in diagnosticsPerFile){
    // applyCodefixes(project, project.getFileNames)

  }
}

function getFileFromDiagnostic(d : Diagnostic) : string {
  return d.source;
}

async function getProject() : Promise<Project> {
  return createProject({ tsConfigFilePath });
}

export function getFileNames(project: Project): string[] {
  const files = project.getSourceFiles();
  const fileNames = files.map(function(files) {
    return files.fileName;
  })
  // console.log(fileNames);
  return fileNames;
}

export function getDiagnostics(project: Project): (readonly Diagnostic[])[] {
  const diagnostics = project.getSourceFiles().map(function(file) {
    return project.createProgram().getSemanticDiagnostics(file);
  });
  return diagnostics;
}

function getCodeFixesForFile(project: Project, diagnostics : readonly Diagnostic[]) : readonly CodeFixAction[] {
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

function getFileTextChangesFromCodeFix(codefix : CodeFixAction) : readonly FileTextChanges[] {
  return codefix.changes;
}

function getTextChangesForFileFromFileChange(change : FileTextChanges) : readonly TextChange[] {
  // do we need to make sure all codefixes apply to same file? my thinking is yes.
  return change.textChanges;
}

function getTextChangesForCodeFix(codefixes: readonly CodeFixAction[]) : readonly TextChange[] {
  // get 1d list of fileChanges list from list of codefixactions
  const changesToFile = (<FileTextChanges[]>[]).concat.apply([], codefixes.map(function (fix) {
    return getFileTextChangesFromCodeFix(fix);
  }) );
  // const textChanges = (<TextChange[]>[]).concat.apply([], changesToFile.map(function (fix) {
  //   return getTextChangesForFileFromFileChange(fix);
  // }) );

  let textChanges = new Map();

  return textChanges;
}

function collectTextChanges(textChanges: readonly TextChange[]) {

}

function getFileOfTextChange(change: TextChange) {

}

function applyCodefixes(project: Project, filePath: string, diagnostics : Diagnostic[]) {
  const codefixes = getCodeFixesForFile(project, diagnostics);
  // get list of text changes
  const textChanges = getTextChangesForCodeFix(codefixes);
  const originalFile = project.getSourceFile(filePath); 
  if (originalFile === undefined){
    // if file cannot be found, return undone text changes ->  throw error?
    return textChanges;
  }
  
  let originalFileText = originalFile.text;

  // do the text changes
  // function should return changes that aren't done, and new file contents
  const newFileString = doTextChanges(originalFileText, textChanges);
  // return string of new file contents + all changes that weren't done?
  return newFileString;
}

async function doTextChanges(fileText : string, textChanges: readonly TextChange[]) {
  // sort text changes by TextChange, by now we have made sure that they all apply to the correct file

  // iterate through codefixes from back
  for (let i = textChanges.length - 1; i >= 0; i--) {
    // apply each codefix
    fileText = await doTextChange(fileText, textChanges[i]);
  }

  return fileText;
}

async function doTextChange(currentFileText : string, change : TextChange) {
  const prefix = currentFileText.substring(0, change.span.start);
  const middle = change.newText;
  const suffix = currentFileText.substring(change.span.start + change.span.length);
  return prefix + middle + suffix;
}




