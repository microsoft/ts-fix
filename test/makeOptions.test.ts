import path from "path";
import {makeOptions} from "../src/cli";

// const path_to_nested = path.resolve("C:\\Users\\t-isabelduan\\TS-transform-project\\test\\testRepositories\\nestedFolderTest\\src\\tsconfig.json");
// const relative_to_nested = path.resolve("test\\testRepositories\\nestedFolderTest\\src\\tsconfig.json");


//TODO: uhh the defult cwd may not nessssrily resolve to correct path on non windows
// TODO: the way to resolve above is never use absolute paths in any test. :(
test("option_empty_argv", () => {
    let argv = {};
    const cwd = path.resolve(process.cwd());
    const createdOption = makeOptions(cwd, argv);
    expect(createdOption.tsconfigPath).toEqual(path.resolve(cwd, "tsconfig.json"));    
    expect(createdOption.replace).toEqual(true);
    expect(createdOption.outputFolder).toEqual(path.resolve(cwd));
    expect(createdOption.errorCode).toEqual([]);
    expect(createdOption.fixName).toEqual([]);
;
});

test("option_trueR_noOutputFolder", () => {
    let argv = {r : true};
    const cwd = path.resolve(process.cwd());
    const createdOption = makeOptions(cwd, argv);
    expect(createdOption.outputFolder).toEqual(cwd); 
});

test("option_falseR_noOutputFolder", () => {
    let argv = {r : false};
    const cwd = path.resolve(process.cwd());
    const createdOption = makeOptions(cwd, argv);
    expect(createdOption.tsconfigPath).toEqual(path.resolve(cwd, "tsconfig.json"));    
    expect(createdOption.outputFolder).toEqual(path.resolve(cwd, "..\\Output")); 
});

test("option_falseR_withOutputFolder", () => {
    const cwd = path.resolve(process.cwd());
    let argv_partial = {r : false, o: "..\\DifferentOutput2"};
    const createdOption_partial = makeOptions(cwd, argv_partial);
    expect(createdOption_partial.outputFolder).toEqual(path.resolve("..\\DifferentOutput2")); 
});

test("option_noR_withOutputFolder", () => {
    const cwd = path.resolve(process.cwd());

    let argv_partial = {o: "..\\DifferentOutput2"};
    const createdOption_p = makeOptions(cwd, argv_partial);
    // we **want** replace to be the default behavior
    expect(createdOption_p.outputFolder).toEqual(cwd); 
});

test("option_trueR_withOutputFolder", () => {
    let argv = {r : true, o: "..\\DifferentOutput2"};
    const cwd = path.resolve(process.cwd());
    const createdOption = makeOptions(cwd, argv);
    expect(createdOption.outputFolder).toEqual(cwd); 
});

test("errorCode_singleError",  () => { 
    let argv = {e: 1};
    const cwd = path.resolve(process.cwd());
    const createdOption = makeOptions(cwd, argv);
    expect(createdOption.errorCode).toEqual([1]); 
})

test("errorCode_manyError",  () => { 
    let argv = {e: [0, 123, 41, 1]};
    const cwd = path.resolve(process.cwd());
    const createdOption = makeOptions(cwd, argv);
    expect(createdOption.errorCode).toEqual([0, 123, 41, 1]); 
})

test("fixName_singlefixName",  () => { 
    let argv = {f: "fixOverride"};
    const cwd = path.resolve(process.cwd());
    const createdOption = makeOptions(cwd, argv);
    expect(createdOption.fixName).toEqual(["fixOverride"]); 
})

test("fixName_manyfixName",  () => { 
    // these names aren't necessarily real errors
    let argv = {f: ["fixOverride", "fixUnknown", "fixUndefined"]};
    const cwd = path.resolve(process.cwd());
    const createdOption = makeOptions(cwd, argv);
    expect(createdOption.fixName).toEqual(["fixOverride", "fixUnknown", "fixUndefined"]); 
})




