import { Options, filterCodeFixesByFixName } from "../src/index";
import { CodeFixAction, TextChange } from "typescript";
import {makeOptions} from "../src/cli";

const codefixes : CodeFixAction[] = [ 
    {fixName: 'fixOverrideModifier', 
        description: 'Add \'override\' modifier', 
        changes: [{fileName: 'C:/Users/t-isabelduan/Project/ts-codefix-api-example/test-project/index.ts', textChanges: [{span: {start: 165, length: 0}, newText: 'override '}]}], 
        commands: undefined, 
        fixId: 'fixAddOverrideModifier'}, 
    {fixName: 'fixOverrideModifier',
        description: 'Add \'override\' modifier', 
        changes:  [{fileName: 'C:/Users/t-isabelduan/Project/ts-codefix-api-example/test-project/index.ts', textChanges: [{span: {start: 244, length: 0}, newText: 'override '}]}], 
        commands: undefined,
        fixId: 'fixAddOverrideModifier'},
    {fixName: 'addConvertToUnknownForNonOverlappingTypes', 
        description: 'Add \'unknown\' conversion for non-overlapping types', 
        changes: [{fileName: 'C:/Users/t-isabelduan/Project/ts-codefix-api-example/test-project/index2.ts', textChanges: [{span: {start: 8, length: 9}, newText: '<unknown>["words"]'}]}], 
        commands: undefined, 
        fixId: 'addConvertToUnknownForNonOverlappingTypes'},
    {fixName: 'addConvertToUnknownForNonOverlappingTypes',
         description: 'Add \'unknown\' conversion for non-overlapping types', 
         changes: [{fileName: 'C:/Users/t-isabelduan/Project/ts-codefix-api-example/test-project/index2.ts', textChanges:[{span: {start: 30, length: 7}, newText: '<unknown>"words"'}]}], 
         commands: undefined, 
         fixId: 'addConvertToUnknownForNonOverlappingTypes'},
    {fixName: 'addConvertToUnknownForNonOverlappingTypes', 
        description: 'Add \'unknown\' conversion for non-overlapping types', 
        changes: [{fileName: 'C:/Users/t-isabelduan/Project/ts-codefix-api-example/test-project/index2.ts', textChanges: [{span:{start: 50, length: 1}, newText: '<unknown>0'}]}], 
        commands: undefined, 
        fixId: 'addConvertToUnknownForNonOverlappingTypes'}
]

test("filterCodeFixesByFixName_noNamesPassedIn", () => {
    const opt = makeOptions(process.cwd(), {});
    // empty argument behavior... currently, we just keep all fixes if none are specified
    expect(filterCodeFixesByFixName(codefixes, opt)).toEqual(codefixes);
})


test("filterCodeFixesByFixName_allNamesPassedIn", () => {
    const opt = makeOptions(process.cwd(), {f : ['fixOverrideModifier','addConvertToUnknownForNonOverlappingTypes']});
    // all changes are picked
    expect(filterCodeFixesByFixName(codefixes, opt)).toEqual(codefixes);
})

test("filterCodeFixesByFixName_singleStringPassedIn", () => {
    const opt = makeOptions(process.cwd(), {f : 'fixOverrideModifier'});
    expect(filterCodeFixesByFixName(codefixes, opt)).toEqual(codefixes.slice(0,2));
})

test("filterCodeFixesByFixName_singleStringListPassedIn", () => {
    const opt = makeOptions(process.cwd(), {f : ['addConvertToUnknownForNonOverlappingTypes']});
    expect(filterCodeFixesByFixName(codefixes, opt)).toEqual(codefixes.slice(2,5));
})

test("filterCodeFixesByFixName_noMatch", () => {
    const opt = makeOptions(process.cwd(), {f : ['add']});
    expect(filterCodeFixesByFixName(codefixes, opt)).toEqual([]);
})

test("filterCodeFixesByFixName_noMatchAndSomeMatch", () => {
    const opt = makeOptions(process.cwd(), {f : ['fixOverrideModifier', 'add']});
    expect(filterCodeFixesByFixName(codefixes, opt)).toEqual(codefixes.slice(0,2));
})