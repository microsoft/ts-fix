#!/usr/bin/env node

import { writeFileSync } from 'fs';
import yargs, { boolean, string } from 'yargs';
import path from "path";
import { Options, codefixProject, Host } from '.';

const argv = yargs(process.argv.slice(2))
            .scriptName("codefix")
            .usage("$0 -t tsconfig.json -o /output -e err#")
            .option("t", {
                alias: "tsconfig",
                description: "name or path to project's tsconfig",
                type: "string",
                nargs: 1
            })
            .option("file", {
                description: "files to codefix. Not implemented yet.",
                type: "string"
            })
            .option("e", {
                alias: "errorCode",
                describe: "the error code (number)",
                type: "number"
            })
            .option("f", {
                alias: "fixName",
                describe: "names of codefixes to apply",
                type: "string"
            }) 
            .option("r", {
               alias: "replace",
               describe: "Default: True. Set flag to false if code-fixed code should be emitted into original file (overwrites original file)",
               type: "boolean"
           })
           .option("o", {
            alias: "outputDirectory", 
            describe: "the output directory. Only used if -r is explicitly false (--no-r)",
            type: "string"
            }).argv;

// Later task : what if wanted to include flag for specific files only (also -f) or 

export function makeOptions(cwd:string, argv:any) : Options { // Tested
    const {t, e, o, f, r} = argv;
    let tsconfigPath = (t===undefined) ? path.resolve(cwd, "tsconfig.json") : path.resolve(t);
    return  {
        tsconfigPath : tsconfigPath,
        // default should be to replace
        outputFolder : (r===true||r===undefined) ? path.dirname(tsconfigPath) : (o===undefined) ? path.resolve(path.dirname(tsconfigPath), "../Output") : path.resolve(o),
        errorCode : (e===undefined) ? [] : (typeof e === "number") ? [e] : e,
        fixName : (f===undefined) ? [] :  (typeof f === "string") ? [f] : f,
    }
}

const cliHost: Host = {
    log: console.log.bind(console),
    writeFile: (fileName, content) => writeFileSync(fileName, content, 'utf8'),
};

// class TestHost implements Host {
//     private filesWritten = new Map<string, string>();
//     log() {}
//     writeFile(fileName: string, content: string) {
//         this.filesWritten.set(fileName, content);
//     }

//     getChangedFile(fileName: string) {
//         return this.filesWritten.get(fileName);
//     }
// }

// runCli('--tsconfig ./blah/whatever/tsconfig.json --fixNames 23423', testHost);
// logs: [ ... ]
// changedFiles: [ ... ]

function h(exit:boolean):string {
    if (exit) {
        process.exit(1);
    }
    
    return "jeijij";
}

console.log(h(true));

console.log("hi");


// codefixProject(makeOptions(process.cwd(), argv), cliHost);
// print out how many errors matched/fixes matched

// print out files changed

// overlapping errors (matched changes that were not applied)

