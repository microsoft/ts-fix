#!/usr/bin/env node

import yargs from 'yargs';
import path from "path";
import { Options, codefixProject, CLIHost } from '.';

export function makeOptions(cwd: string, args: string[]): Options {
    const {
        errorCode,
        file,
        fixName,
        ignoreGitStatus,
        interactiveMode,
        outputFolder,
        showMultiple,
        tsconfig,
        write,
    } = yargs(args)
        .scriptName("ts-fix")
        .usage("$0 -t path/to/tsconfig.json")
        .option("errorCode", {
            alias: "e",
            describe: "The error code(s)",
            type: "number",
            array: true,
            default: []
        })
        .option("file", {
            description: "Relative paths to the file(s) for which to find diagnostics",
            type: "string",
            array: true,
            default: []
        })
        .option("fixName", {
            alias: "f",
            describe: "The name(s) of codefixe(s) to apply",
            type: "string",
            array: true,
            default: []
        })
        .option("ignoreGitStatus", {
            describe: "Must use if the git status isn't clean, the write flag is being used, and the output folder is the same as the project folder",
            type: "boolean",
            default: false
        })
        .option("interactiveMode", {
            describe: "Takes input from the user to decide which fixes to apply",
            type: "boolean",
            default: false
        })
        .option("outputFolder", {
            alias: "o",
            describe: "Path of output directory",
            type: "string"
        })
        .option("showMultiple", {
            describe: "Takes input from the user to decide which fix to apply when there are more than one quick fix for a diagnostic, if this flag is not provided the tool will apply the first fix found for the diagnostic",
            type: "boolean",
            default: false
        })
        .option("tsconfig", {
            alias: "t",
            description: "Path to project's tsconfig",
            type: "string",
            nargs: 1,
            default: "./tsconfig.json",
            coerce: (arg: string) => {
                return path.resolve(cwd, arg);
            }
        })
        .option("write", {
            alias: "w",
            describe: "Tool will only emit or overwrite files if --write is included.",
            type: "boolean",
            default: false
        })
        .argv;
    return {
        cwd,
        errorCode,
        file,
        fixName,
        ignoreGitStatus,
        interactiveMode,
        outputFolder : outputFolder ? path.resolve(cwd, outputFolder) : path.dirname(tsconfig),
        showMultiple,
        tsconfig,
        write,
    };
}

if (!module.parent) {
    const opt = makeOptions(process.cwd(), process.argv.slice(2));
    let host = new CLIHost(process.cwd());
    (async () => {
        const error = await codefixProject(opt, host);
        host.log(error);
    })();
}

