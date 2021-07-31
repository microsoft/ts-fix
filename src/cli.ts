#!/usr/bin/env node

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import yargs, { boolean, string } from 'yargs';
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
            .scriptName("codefix")
            .usage("$0 -t tsconfig.json -o /output -e err#")
            .option("tsconfig", {
                alias: "t",
                description: "name or path to project's tsconfig",
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
                describe: "the error code (number)",
                type: "number",
                array: true,
                default: [],
            })
            .option("fixName", {
                alias: "f",
                describe: "names of codefixes to apply",
                type: "string",
                array: true, 
                default: []
            }) 
           .option("write", {
               alias: "w", 
               describe: "Default: False. Will only emit or overwrite files if --write is set to True.",
               type:"boolean", 
               default: false,
           })
           .option("outputFolder", {
                alias: "o", 
                describe: "the output directory",
                type: "string"
            })
            .option("verbose", {
                describe: "Default: True. Writes status to console during runtime",
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

// const cliHost : Host =  {
//     log: console.log.bind(console),
//     writeFile: (fileName, content) => writeFileSync(fileName, content, 'utf8'),
//     mkdir: (directoryPath) => mkdirSync(directoryPath, {recursive: true}),
//     exists: existsSync, 
//     remainingChanges: [] 
// };


// const silentHost: Host = {
//     log: ()=>{},
//     writeFile: (fileName, content) => writeFileSync(fileName, content, 'utf8'),
//     mkdir: (directoryPath) => mkdirSync(directoryPath, {recursive: true}),
//     exists: existsSync
// }

// runCli('--tsconfig ./blah/whatever/tsconfig.json --fixNames 23423', testHost);
// logs: [ ... ]
// changedFiles: [ ... ]
if (!module.parent) {
    const opt = makeOptions(process.cwd(), process.argv.slice(2));
    let host = new CLIHost(process.cwd());
    (async() => { 
        const error = await codefixProject(opt, host);
        host.log(error);
    }) ;
        // error is a string if codefixProject did an error
}

//DONE: print out how many errors matched
//DONE: fixes matched 
//DONE: print out files changed

// overlapping errors (matched changes that were not applied)

