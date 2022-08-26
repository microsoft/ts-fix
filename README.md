
This tool is to automate the application of TypeScript codefixes across your TypeScript repositories. 


# Download
If cloning from GitHub, after cloning, run
```
npm run build
npm link
```
`ts-fix` can then be used in the command line


# Example Usage
`ts-fix -t path/to/tsconfig.json -f nameOfCodefix`
`ts-fix -e 4114 --write`
`ts-fix --interactiveMode --file relativePathToFile`

# Flags 

```
Options:
      --help                Show help                                             [boolean]
      --version             Show version number                                   [boolean]
  -t, --tsconfig            Path to project's tsconfig    
                                                      [string] [default: "./tsconfig.json"]
  -e, --errorCode           The error code(s)                        [number] [default: []]
  -f, --fixName             The name(s) of codefixe(s) to apply      [string] [default: []]
  -w, --write               Tool will only emit or overwrite files if --write is included                                                       [boolean] [default: false]
  -o, --outputFolder        Path of output directory                               [string]
      --interactiveMode     Enables interactive mode             [boolean] [default: false]
      --file                Relative paths to files                  [string] [default: []]
      --showMultiple        Shows multiple fixes for a diagnostic    
                                                                 [boolean] [default: false]
      --ignoreGitStatus     Ignore working tree and force the emitting or overwriting of files                                                      [boolean] [default: false]
```

`-t path/to/tsconfig.json` or `--tsconfig path/to/tsconfig.json` 
Specifies the project to use the tool on. If no arguement given, the tool will use the tsconfig in the current working directory. 

`-e <number>` or  `--errorCode <number>`
Specifies the errors to fix. Several error codes can be specified during the same command. 
The easiest way to find error codes in your repository is to hover over the error in your IDE.

`-f <name>` or `--fixName <name>`
Specifies the types of codefixes to use. Several names can be specified. 

If both error numbers and fix names are given, then in order to be applied, a fix must be generated by a specified error and have a name that was specified.

`--write` 
Boolean for if the tool should overwrite previous code files with the codefixed code or emit any files with codefixed code. If `--write` not included, then the tool will print to console which files would have changed.

`--interactiveMode`
Boolean for enabling interactive CLI to visualize which code fixes to apply to your project. Some special cases to keep in mind are:
1. One diagnostic might be tied to more than one code fix. A simple example of this is when the paramenters of a functions have any type and the `inferFromUsage` fix is recommended. Let's say that you want to fix only error code `7019`, this could also fix `7006` if the function parameters has both diagnostics.
2. Some codefixes are applied on a different location from where the actual diagnostic is.Some examples:
    2.1 When the code fix is applied on the diagnostic's related information instead.
    2.2 When the code fix is applied in an entire different file from the original file.

`--file <filename>`
Relative file path(s) to the file(s) in which to find diagnostics and apply quick fixes. The path is relative to the project folder.

`--showMultiple`
Boolean for enabling showing multiple fixes for diagnostics for which this applies.
One consideration when `--showMultiple = true` is that the tool migth not be able to find consecutives fixes afecting the same span if those diagnostics have mutliple fixes.

`--ignoreGitStatus`
Boolean to force the overwriting of files when `--write = true` and output folder matches project folder. If you are sure you would like to run ts-fix on top of your current changes provide this flag.


