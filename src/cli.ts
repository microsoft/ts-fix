#!/usr/bin/env node

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import yargs, { boolean, string } from 'yargs';
import path from "path";
import { Options, codefixProject, Host } from '.';
import { silent } from 'import-cwd';

const argv = yargs(process.argv.slice(2))
            .scriptName("codefix")
            .usage("$0 -t tsconfig.json -o /output -e err#")
            .option("t", {
                alias: "tsconfig",
                description: "name or path to project's tsconfig",
                type: "string",
                nargs: 1
            })
            // .option("file", {
            //     description: "files to codefix. Not implemented yet.",
            //     type: "string"
            // })
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
           .option("w", {
               alias: "write", 
               describe: "Default: False. Will only emit or overwrite files if --write is set to True.",
               type:"boolean"
           })
           .option("o", {
                alias: "outputDirectory", 
                describe: "the output directory. Only used if -r is explicitly false (--no-r)",
                type: "string"
            })
            .option("verbose", {
                describe: "Default: True. Writes status to console during runtime",
                type: "boolean"
            })
            .argv;

export function makeOptions(cwd:string, argv:any) : Options { // Tested
    const {t, e, o, f, r, w} = argv;
    let tsconfigPath = (t===undefined) ? path.resolve(cwd, "tsconfig.json") : path.resolve(t);
    return  {
        tsconfigPath : tsconfigPath,
        replace :  (r===true||r===undefined),
        outputFolder : (r===true||r===undefined) ? path.dirname(tsconfigPath) : (o===undefined) ? path.resolve(path.dirname(tsconfigPath), "../Output") : path.resolve(o),
        errorCode : (e===undefined) ? [] : (typeof e === "number") ? [e] : e,
        fixName : (f===undefined) ? [] :  (typeof f === "string") ? [f] : f,
        write : w===true
    }
}

const cliHost: Host = {
    log: console.log.bind(console),
    writeFile: (fileName, content) => writeFileSync(fileName, content, 'utf8'),
    mkdir: (directoryPath) => mkdirSync(directoryPath, {recursive: true}),
    exists: existsSync
};

const silentHost: Host = {
    log: ()=>{},
    writeFile: (fileName, content) => writeFileSync(fileName, content, 'utf8'),
    mkdir: (directoryPath) => mkdirSync(directoryPath, {recursive: true}),
    exists: existsSync
}



// runCli('--tsconfig ./blah/whatever/tsconfig.json --fixNames 23423', testHost);
// logs: [ ... ]
// changedFiles: [ ... ]
if (argv.t !== undefined) {
    const opt = makeOptions(process.cwd(), argv);
    if (argv.verbose === true || argv.verbose === undefined){
        codefixProject(opt, cliHost);
    }
    else {
        codefixProject(opt, silentHost);
    }
}

//DONE: print out how many errors matched
//fixes matched 

// print out files changed

// overlapping errors (matched changes that were not applied)

