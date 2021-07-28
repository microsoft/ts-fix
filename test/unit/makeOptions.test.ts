import path from "path";
import {makeOptions} from "../../src/cli";


//TODO: uhh the defult cwd may not nessssrily resolve to correct path on non windows
// TODO: the way to resolve above is never use absolute paths in any test. :(
test("option_empty_argv", () => {
    let argv = {};
    const cwd = __dirname;
    const createdOption = makeOptions(cwd, []);
    expect(createdOption.tsconfig).toEqual(path.resolve(cwd, "tsconfig.json"));    
    expect(createdOption.outputFolder).toEqual(path.resolve(cwd));
    expect(createdOption.errorCode).toEqual([]);
    expect(createdOption.fixName).toEqual([]);
;
});

test("option_withOutputFolder", () => {
    const cwd = __dirname;
    const createdOption_partial = makeOptions(cwd, ["-o", "..\\DifferentOutput2"]);
    expect(createdOption_partial.outputFolder).toEqual(path.resolve(path.dirname(createdOption_partial.tsconfig), "..\\DifferentOutput2")); 
});

test("errorCode_singleError",  () => { 
    const cwd = __dirname;
    const createdOption = makeOptions(cwd, ["-e", "1"]);
    expect(createdOption.errorCode).toEqual([1]); 
})

test("errorCode_manyError",  () => { 
    const cwd = __dirname;
    const createdOption = makeOptions(cwd, ["-e", "0", "123", "41", "1"]);
    expect(createdOption.errorCode).toEqual([0, 123, 41, 1]); 
})

test("fixName_singlefixName",  () => { 
    const cwd = __dirname;
    const createdOption = makeOptions(cwd, ["-f", "fixOverride"]);
    expect(createdOption.fixName).toEqual(["fixOverride"]); 
})

test("fixName_manyfixName",  () => { 
    // these names aren't necessarily real errors
    const cwd = __dirname;
    const createdOption = makeOptions(cwd, ["-f", "fixOverride", "fixUnknown", "fixUndefined"]);
    expect(createdOption.fixName).toEqual(["fixOverride", "fixUnknown", "fixUndefined"]); 
})




