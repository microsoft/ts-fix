#!/usr/bin/env node

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import yargs from 'yargs';
import path from "path";
import { Options, codefixProject, CLIHost } from '.';

export function makeOptions(cwd: string, args: string[]): Options {
    const {
        tsconfig,
        outputFolder,
        errorCode,
        fixName,
        verbose,
        write,
    } = yargs(args)
            .scriptName("ts-fix")
            .usage("$0 -t path/to/tsconfig.json -f nameOfCodefix")
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
            // .option("file", {
            //     description: "files to codefix. Not implemented yet.",
            //     type: "string"
            // })
            .option("errorCode", {
                alias: "e",
                describe: "The error code(s)",
                type: "number",
                array: true,
                default: [],
            })
            .option("fixName", {
                alias: "f",
                describe: "The name(s) of codefixe(s) to apply",
                type: "string",
                array: true, 
                default: []
            }) 
           .option("write", {
               alias: "w", 
               describe: "Tool will only emit or overwrite files if --write is included.",
               type:"boolean", 
               default: false,
           })
           .option("outputFolder", {
                alias: "o", 
                describe: "Path of output directory",
                type: "string"
            })
            .option("verbose", {
                describe: "Write status to console during runtime",
                type: "boolean",
                default: true,
            })
            .argv;
    
    return {
        cwd,
        tsconfig,
        errorCode,
        fixName,
        write,
        verbose, // TODO, not sure if this does anything after redoing CLIHost
        outputFolder: outputFolder ? path.resolve(cwd, outputFolder) : path.dirname(tsconfig)
    };
}

if (!module.parent) {
    const opt = makeOptions(process.cwd(), process.argv.slice(2));
    let host = new CLIHost(process.cwd());
    (async() => { 
        const error = await codefixProject(opt, host);
        host.log(error);
    })();
        // error is a string if codefixProject did an error
}

