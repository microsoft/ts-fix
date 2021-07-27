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

export function makeOptions(cwd:string, argv:any) : Options { // Tested
    const {t, e, o, f, r} = argv;
    let tsconfigPath = (t===undefined) ? path.resolve(cwd, "tsconfig.json") : path.resolve(t);
    return  {
        tsconfigPath : tsconfigPath,
        replace :  (r===true||r===undefined),
        outputFolder : (r===true||r===undefined) ? path.dirname(tsconfigPath) : (o===undefined) ? path.resolve(path.dirname(tsconfigPath), "../Output") : path.resolve(o),
        errorCode : (e===undefined) ? [] : (typeof e === "number") ? [e] : e,
        fixName : (f===undefined) ? [] :  (typeof f === "string") ? [f] : f,
    }
}

const cliHost: Host = {
    log: console.log.bind(console),
    writeFile: (fileName, content) => writeFileSync(fileName, content, 'utf8'),
};



// runCli('--tsconfig ./blah/whatever/tsconfig.json --fixNames 23423', testHost);
// logs: [ ... ]
// changedFiles: [ ... ]
const opt = makeOptions(process.cwd(), argv);
console.log(opt.tsconfigPath);
console.log(opt.outputFolder);
codefixProject(opt, cliHost);
//DONE: print out how many errors matched
//fixes matched 

// print out files changed

// overlapping errors (matched changes that were not applied)

