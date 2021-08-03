import path from "path";
import type { CodeFixAction, Diagnostic, FileTextChanges, TextChange } from "typescript";
import os from "os";
import _ from "lodash";
import { createProject, Project } from "./ts";
import { PathLike, writeFileSync, mkdirSync, existsSync } from "fs";


export interface Logger {
  (...args: any[]): void;
  error?(...args: any[]): void;
  warn?(...args: any[]): void;
  info?(...args: any[]): void;
  verbose?(...args: any[]): void;
}

export interface Host {
  // Emits one particular file with input fileName and content string
  writeFile (fileName:string, content:string) : void;

  // Returns all text changes that were not applied
  getRemainingChanges: () => (ReadonlyMap<string, readonly TextChange[]>)[];

  // Adds map of text changes that were not applied
  addRemainingChanges: (changelist:ReadonlyMap<string, readonly TextChange[]>) => void;

  log: Logger;
  mkdir: typeof import("fs").mkdirSync;
  exists: typeof import("fs").existsSync;

}

export class CLIHost implements Host {
  private remainingChanges : (ReadonlyMap<string, readonly TextChange[]>)[] = [];

  constructor(private cwd:string) {};

  writeFile(fileName:string, content:string) { writeFileSync(fileName, content, 'utf8') };

  getRemainingChanges() {return this.remainingChanges};

  addRemainingChanges(changeList: ReadonlyMap<string, readonly TextChange[]>) {this.remainingChanges.push(changeList)};


  log(s:string) {console.log(s)};

  mkdir(directoryPath:PathLike) {return mkdirSync(directoryPath, {recursive: true})};
  
  exists(fileName:PathLike) {return existsSync(fileName)};
}

export interface Options {
  cwd: string;
  tsconfig: string;
  outputFolder: string;
  errorCode: number[];
  fixName: string[];
  write: boolean,
  verbose: boolean
}

export async function codefixProject(opt:Options, host: Host): Promise<string> {
  if (opt.errorCode.length === 0 && opt.fixName.length === 0) {
    return "Warning! Not specifying either code fix names or error codes often results in unwanted changes.";
  }

  const allChangedFiles = new Map<string, ChangedFile>();
  let passCount = -1;
  while (++passCount < 2)  {
    const project = createProject({ tsConfigFilePath: opt.tsconfig }, allChangedFiles);
    if (!project) {
       return "Error: Could not create project.";
    }

    if (passCount === 0) {
      host.log("Using TypeScript " + project.ts.version);
    } else {
      host.log("Overlapping changes detected. Performing additional pass...");
    }

    const textChangesByFile = await getCodeFixesFromProject(project, opt, host);
    const { changedFiles, excessChanges } = getChangedFiles(project, textChangesByFile);
    changedFiles.forEach((change, fileName) => {
      allChangedFiles.set(fileName,change)
    });
    host.addRemainingChanges(excessChanges); 
    
    // if (opt.write) {
    //   // Edit each file if --write is true
    //   host.writeFiles(opt);
    // } else {
    //   // Later passes incorporate changes from earlier passes, so overwriting is ok
    //   changedFiles.forEach((file, fileName) => allChangedFiles.set(fileName, file));
    // }

    if (excessChanges.size === 0) {
      break;
    } else {
      host.log(excessChanges.size + " changes remaining")
    }
  }

  if (opt.write) {
    allChangedFiles.forEach((changedFile, fileName) => {
      writeToFile(fileName, changedFile.newText, opt, host);
    })
  } else {
    // TODO: report what files *would* have been changed 
    // -- do we really want it to possibly be printing hundereds of lines?
    host.log("Changes detected in the following files:");
    allChangedFiles.forEach((_, fileName) => {
      host.log("   " + fileName);
    });
  }

  return "Done";
}

export async function getCodeFixesFromProject(project: Project, opt: Options, host: Host): Promise<Map<string,TextChange[]>> { 

  // pull all codefixes.
  const diagnosticsPerFile = await getDiagnostics(project);

  if (diagnosticsPerFile === [] || diagnosticsPerFile === [[]]){ // TODO fix equalty
    host.log("No more diagnostics.");
    return new Map<string, TextChange[]>();
  }
  // pull codefixes from diagnostics.  If errorCode is specified, only pull fixes for that/those errors. 
  //    Otherwise, pull all fixes

  const [filteredDiagnostics, acceptedDiagnosticsOut] =  filterDiagnosticsByErrorCode(diagnosticsPerFile,opt.errorCode);
  acceptedDiagnosticsOut.forEach((string_describe: unknown) => {
    host.log(string_describe);
  });

  const codefixesPerFile = filteredDiagnostics.map(function (d: readonly Diagnostic[]) {
    return (getCodeFixesForFile(project, d)); 
  });
  const codefixes = <CodeFixAction[]>_.flatten(codefixesPerFile);

  // filter for codefixes if applicable, then 
  //    organize textChanges by what file they alter
  const [textChangesByFile, filterCodefixOut] = getTextChangeDict(codefixes, opt);

  // some option if statement here?
  filterCodefixOut.forEach((s: unknown) => {
    host.log(s);
  });

  return textChangesByFile;
}

export function getDiagnostics(project: Project): (readonly Diagnostic[])[] {
  const diagnostics = project.program.getSourceFiles().map(function (file) {
    return project.program.getSemanticDiagnostics(file);
  });
  return diagnostics;
}


export function filterDiagnosticsByErrorCode(diagnostics: (readonly Diagnostic[])[], errorCodes: number[]): [(readonly Diagnostic[])[], string[]]{
  // if errorCodes were passed in, only use the specified errors
  // diagnostics is guarenteed to not be [] or [[]]
  if (errorCodes.length !== 0) {

    let errorCounter = new Map<number, number>();
    let filteredDiagnostics = <(readonly Diagnostic[])[]>[];

    for (let i = 0; i < diagnostics.length; i++) {
      //for every diagnostic list

      // get rid of not matched errors 
      const filteredDiagnostic =  _.filter(diagnostics[i], function (d) {
        if (errorCodes.includes(d.code)) {
          const currentVal =  errorCounter.get(d.code) ;
          if (currentVal!== undefined) {
            errorCounter.set(d.code, currentVal +1); 
          } else {
            errorCounter.set(d.code, 1); 
          }
          return true;
        } 
        return false;
      });
      if (filteredDiagnostic.length > 0){
        filteredDiagnostics.push(filteredDiagnostic);
      }
    }
    let returnStrings = <string[]> [];
    errorCodes.forEach((code: number) => {
      const count = errorCounter.get(code);
      if (count === undefined) {
        returnStrings.push("No diagnostics found with code " + code)
      } else {
        returnStrings.push( "Found " + count + " diagnostics with code " + code );
      }
    });
    
    return [filteredDiagnostics, returnStrings];
  }
  // otherwise, use all errors
  return [diagnostics, ["Found " + _.reduce(diagnostics.map((d: { length: any; }) => d.length), function(sum, n) {
      return sum + n;}, 0) + " diagnostics in " + diagnostics.length + " files"]];
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
  })).filter((d:CodeFixAction) => d !== undefined);
  return codefixes;
}

function getFileTextChangesFromCodeFix(codefix: CodeFixAction): readonly FileTextChanges[] {
  return codefix.changes;
}

export function getTextChangeDict(codefixes: readonly CodeFixAction[], opt: Options): [Map<string, TextChange[]>, string[]] {
  let textChangeDict = new Map<string, TextChange[]>();

  const [filteredFixes, out] = filterCodeFixesByFixName(codefixes, opt.fixName);
  
  for (let i = 0; i < filteredFixes.length; i++) {
    const fix = filteredFixes[i];
    const changes = getFileTextChangesFromCodeFix(fix);

    for (let j = 0; j < changes.length; j++) {
      let change = changes[j];
      let validChanges = getFileNameAndTextChangesFromCodeFix(change);
      if (validChanges === undefined){
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

export function filterCodeFixesByFixName(codefixes: readonly CodeFixAction[], fixNames: string[]): [readonly CodeFixAction[], string[]] { //tested
  if (fixNames.length === 0) {
    // empty argument behavior... currently, we just keep all fixes if none are specified
    return [codefixes, ["Found " + codefixes.length + " codefixes"]];
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
      out.push( "Found " + count + " codefixes with name " + name);
    }
  });
  
  return [filteredFixes, out];
}

function getFileNameAndTextChangesFromCodeFix(ftchanges: FileTextChanges): [string, TextChange[]]|undefined {
  if (/[\\/]node_modules[\\/]/.test(ftchanges.fileName)){
    return undefined;
  }
  return [ftchanges.fileName, [...ftchanges.textChanges]];
}

export interface ChangedFile {
  originalText: string;
  newText: string;
}

function getChangedFiles(project: Project, textChanges: Map<string, TextChange[]>): { changedFiles: ReadonlyMap<string, ChangedFile>, excessChanges: ReadonlyMap<string, readonly TextChange[]> } {
  const excessChanges = new Map<string, TextChange[]>();
  const changedFiles = new Map<string, ChangedFile>();

  textChanges.forEach((fileFixes: TextChange[], fileName: string) => {
    const sourceFile = project.program.getSourceFile(fileName);

    if (sourceFile !== undefined) {
      const originalFileContents = sourceFile.text;

      // collision is true if there were changes that were not applied 
      // also performs the writing to the file
      const [overlappingChanges, newFileContents] = applyCodefixesInFile(originalFileContents, fileFixes);
      excessChanges.set(fileName, overlappingChanges);
      changedFiles.set(fileName, { originalText: originalFileContents, newText: newFileContents });
    }
    else {
      throw new Error('File ' + fileName + ' not found in project');
    }
  });

  return { excessChanges, changedFiles };
}



function applyCodefixesInFile(originalContents: string, textChanges: TextChange[]):  [TextChange[], string] {
  // sort textchanges by start
  const sortedFixList = sortChangesByStart(textChanges);

  // take some sort of issue (or none) with overlapping textchanges
  const [filteredFixList, notAppliedFixes] = filterOverlappingFixes(sortedFixList);

  // apply all remaining textchanges
  const newFileContents = applyChangestoFile(originalContents, filteredFixList);
  
  return [notAppliedFixes, newFileContents];
}

export function sortChangesByStart(textChanges: TextChange[]) : TextChange[] { // tested
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

export function doTextChangeOnString(currentFileText: string, change: TextChange): string { // tested
  const prefix = currentFileText.substring(0, change.span.start);
  const middle = change.newText;
  const suffix = currentFileText.substring(change.span.start + change.span.length);
  return prefix + middle + suffix;
}



export function getFileName(filePath: string): string {
  return path.basename(filePath);
}

export function getDirectory(filePath:string) :string {
  return path.dirname(filePath);
}

export function getRelativePath(filePath: string, opt: Options): string{ 
  // this doesn't work when tsconfig or filepath is not passed in as absolute...
  // as a result getOutputFilePath does not work for the non-replace option 
  return path.relative(getDirectory(opt.tsconfig), path.resolve(filePath));
}

export function getOutputFilePath(filePath: string, opt: Options): string {
  // this function uses absolute paths

  const fileName = getRelativePath(filePath, opt);
  return path.resolve(opt.outputFolder, fileName);
}


function writeToFile(fileName: string, fileContents: string, opt: Options, host:Host): void {
  const writeToFileName = getOutputFilePath(fileName, opt);
  const writeToDirectory = getDirectory(writeToFileName)
  if (!host.exists(writeToDirectory)) {
    host.mkdir(writeToDirectory);
  }
  host.writeFile(writeToFileName , fileContents);
  host.log("Updated " + path.relative(opt.cwd, writeToFileName)); 
}