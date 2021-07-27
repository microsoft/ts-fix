import fs from "fs";
import path from "path";
import importCwd from "import-cwd";
import type { LanguageService, LanguageServiceHost, ParseConfigFileHost, Program } from "typescript";
import { parseInt } from "../../../../Users/t-isabelduan/TS-transform-project/node_modules/@types/lodash";

function isTypeScriptVersionSupported(major: number, minor: number) {
  if (major < 3) return false;
  if (major < 4) return minor >= 5;
  return true;
}

type TypeScript = typeof import("typescript");

export function loadTypeScript(): TypeScript {
  try {
    const ts = importCwd("typescript") as typeof import("typescript");
    const [major, minor] = ts.versionMajorMinor.split('.');
    if (isTypeScriptVersionSupported(parseInt(major, 10), parseInt(minor, 10))) {
      return ts;
    }
  } catch {}
  return require("typescript");
}

export interface CreateProjectOptions {
  tsConfigFilePath: string;
}

export interface Project {
  ts: TypeScript;
  languageService: LanguageService;
  program: Program;
}

export function createProject(options: CreateProjectOptions): Project | undefined {
  const ts = loadTypeScript();
  const parseConfigHost: ParseConfigFileHost = {
    fileExists: ts.sys.fileExists,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    readDirectory: ts.sys.readDirectory,
    readFile: ts.sys.readFile,
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
    onUnRecoverableConfigFileDiagnostic: diagnostic => {
      const message = ts.formatDiagnosticsWithColorAndContext([diagnostic], {
        getCanonicalFileName: fileName => fileName,
        getCurrentDirectory: ts.sys.getCurrentDirectory,
        getNewLine: () => ts.sys.newLine
      });
      // TODO: let CLI choose how to handle error instead of throwing here
      throw new Error(message);
    }
  }

  const commandLine = ts.getParsedCommandLineOfConfigFile(path.resolve(options.tsConfigFilePath), undefined, parseConfigHost);
  if (!commandLine) return undefined;

  const languageServiceHost: LanguageServiceHost = {
    getCompilationSettings: () => commandLine.options,
    getProjectReferences: () => commandLine.projectReferences,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getDefaultLibFileName: ts.getDefaultLibFileName,
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    getScriptFileNames: () => commandLine.fileNames,
    getScriptVersion: () => "0", // Get a new project if files change
    getScriptSnapshot: fileName => {
      if (!fs.existsSync(fileName)) {
        return undefined;
      }

      return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName).toString());
    },
  };

  const languageService = ts.createLanguageService(languageServiceHost);
  const program = languageService.getProgram();
  if (!program) return undefined;

  return { ts, languageService, program };
}

function parseInt(_major: any, _arg1: number): number {
    throw new Error("Function not implemented.");
}
