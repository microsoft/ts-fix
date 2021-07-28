import { sortChangesByStart } from "../../src/index";
import { TextChange } from "typescript";


const textchanges : TextChange[] = [
    {span: {start: 8, length: 9} , newText: '<unknown>["words"]'},
    {span: {start: 30, length: 7}, newText: '<unknown>"words"'},
    {span: {start: 50, length: 1}, newText: '<unknown>0'}, 
    {span: {start: 165, length: 0}, newText: 'override '},
    {span: {start: 244, length: 0}, newText: 'override '}];

test("sortChangesByStart_noChange", () => {   
    expect(sortChangesByStart(textchanges)).toEqual(textchanges);
})
    
test("sortChangesByStart_moveToBack", () => {   
    const theseChanges = [{span: {start: 165, length: 0}, newText: 'override '},
    {span: {start: 244, length: 0}, newText: 'override '},
    {span: {start: 8, length: 9} , newText: '<unknown>["words"]'},
    {span: {start: 30, length: 7}, newText: '<unknown>"words"'},
    {span: {start: 50, length: 1}, newText: '<unknown>0'}];
    expect(sortChangesByStart(theseChanges)).toEqual(textchanges);
})

test("sortChangesByStart_diffStartsameLength", () => {   
    const theseChanges0 = [{span: {start: 165, length: 0}, newText: 'override '},
    {span: {start: 244, length: 0}, newText: 'override '},
    {span: {start: 30, length: 0}, newText: '<unknown>"words"'},
    {span: {start: 50, length: 0}, newText: '<unknown>0'},  
    {span: {start: 8, length: 0} , newText: '<unknown>["words"]'}];
    
    const sortedChanges0 = [
    {span: {start: 8, length: 0} , newText: '<unknown>["words"]'},
    {span: {start: 30, length: 0}, newText: '<unknown>"words"'},
    {span: {start: 50, length: 0}, newText: '<unknown>0'},
    {span: {start: 165, length: 0}, newText: 'override '},
    {span: {start: 244, length: 0}, newText: 'override '}];
    
    expect(sortChangesByStart(theseChanges0)).toEqual(sortedChanges0);

    const theseChanges9 = [{span: {start: 165, length: 9}, newText: 'override '},
    {span: {start: 244, length: 9}, newText: 'override '},
    {span: {start: 30, length: 9}, newText: '<unknown>"words"'},
    {span: {start: 50, length: 9}, newText: '<unknown>0'},  
    {span: {start: 8, length: 9} , newText: '<unknown>["words"]'}];
    
    const sortedChanges9 = [
    {span: {start: 8, length: 9} , newText: '<unknown>["words"]'},
    {span: {start: 30, length: 9}, newText: '<unknown>"words"'},
    {span: {start: 50, length: 9}, newText: '<unknown>0'},
    {span: {start: 165, length: 9}, newText: 'override '},
    {span: {start: 244, length: 9}, newText: 'override '}];
    
    expect(sortChangesByStart(theseChanges9)).toEqual(sortedChanges9);

    const theseChanges100 = [{span: {start: 165, length: 100}, newText: 'override '},
    {span: {start: 244, length: 100}, newText: 'override '},
    {span: {start: 30, length: 100}, newText: '<unknown>"words"'},
    {span: {start: 50, length: 100}, newText: '<unknown>0'},  
    {span: {start: 8, length: 100} , newText: '<unknown>["words"]'}];
    
    const sortedChanges100 = [
    {span: {start: 8, length: 100} , newText: '<unknown>["words"]'},
    {span: {start: 30, length: 100}, newText: '<unknown>"words"'},
    {span: {start: 50, length: 100}, newText: '<unknown>0'},
    {span: {start: 165, length: 100}, newText: 'override '},
    {span: {start: 244, length: 100}, newText: 'override '}];
    
    expect(sortChangesByStart(theseChanges100)).toEqual(sortedChanges100);

    
    const theseChanges400 = [{span: {start: 165, length: 400}, newText: 'override '},
    {span: {start: 244, length: 400}, newText: 'override '},
    {span: {start: 30, length: 400}, newText: '<unknown>"words"'},
    {span: {start: 50, length: 400}, newText: '<unknown>0'},  
    {span: {start: 8, length: 400} , newText: '<unknown>["words"]'}];
    
    const sortedChanges400 = [
    {span: {start: 8, length: 400} , newText: '<unknown>["words"]'},
    {span: {start: 30, length: 400}, newText: '<unknown>"words"'},
    {span: {start: 50, length: 400}, newText: '<unknown>0'},
    {span: {start: 165, length: 400}, newText: 'override '},
    {span: {start: 244, length: 400}, newText: 'override '}];
    
    expect(sortChangesByStart(theseChanges400)).toEqual(sortedChanges400);
})



test("sortChangesByStart_sameStartsameLength", () => {   
    const theseChanges = [
    {span: {start: 8, length: 9} , newText: 'aaa'},
    {span: {start: 8, length: 9} , newText: 'bbb'},
    {span: {start: 8, length: 9} , newText: 'vvv'}]
    expect(sortChangesByStart(theseChanges)).toEqual(theseChanges);
})


test("sortChangesByStart_sameStartDiffLength", () => {   
    const theseChanges = [
    {span: {start: 8, length: 0} , newText: 'aaa'},
    {span: {start: 8, length: 1} , newText: 'fff'},
    {span: {start: 8, length: 2} , newText: 'ttt'}]
    expect(sortChangesByStart(theseChanges)).toEqual(theseChanges);

    const mixedChanges = [
        {span: {start: 8, length: 210} , newText: '111'},
        {span: {start: 8, length: 0} , newText: '222'},
        {span: {start: 8, length: 10} , newText: '333'},
        {span: {start: 8, length: 2} , newText: '444'}]
    const expectMixedChanges = [
        {span: {start: 8, length: 0} , newText: '222'},
        {span: {start: 8, length: 2} , newText: '444'},
        {span: {start: 8, length: 10} , newText: '333'},
        {span: {start: 8, length: 210} , newText: '111'}]
    expect(sortChangesByStart(mixedChanges)).toEqual(expectMixedChanges);
})
