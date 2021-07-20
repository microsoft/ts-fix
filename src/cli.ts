import yargs, { boolean, string } from 'yargs';
import path from "path";
import { Options, codefixProject } from '.';



const argv = yargs(process.argv.slice(2))
            .scriptName("codefix")
            .usage("$0 -t tsconfig.json -o /output -e err#")
            .option("t", {
                alias: "tsconfig",
                description: "name or path to project's tsconfig",
                type: "string",
                nargs: 1
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
            .option("r",
             {
                alias: "replace",
                describe: "include flag if code-fixed code should be emitted into original file (overwrites original file)",
                type: "boolean"
            })
            .option("o", {
                alias: "outputDirectory", 
                describe: "the output directory. Ignored if -r is true",
                type: "string"
            }).argv;
          
const {t, e, o, f, r} = argv;

export function makeOptions(cwd:string, argv:any) : Options {
    const {t, e, o, f, r} = argv;
    return  {
        tsconfigPath : (t===undefined) ? path.resolve(cwd, "tsconfig.json") : path.resolve(t),
        outputFolder : (r===true) ? path.resolve(cwd) : (o===undefined) ? path.resolve(cwd, "../Output") : path.resolve(o),
        errorCode : (e===undefined) ? [] : (typeof e === "number") ? [e] : e,
        fixName: (f===undefined) ? [] :  (typeof f === "string") ? [f] : f,
    }
}



codefixProject(makeOptions(process.cwd(), argv));
