import { Options, sortChangesByStart, filterOverlappingFixes } from "../../src/index";
import path from "path";
import { TextChange } from "typescript";
import {makeOptions} from "../../src/cli";
import { create, drop } from "lodash";

const textchanges : TextChange[] = sortChangesByStart([{span: {start: 165, length: 0}, newText: 'override '},
    {span: {start: 244, length: 0}, newText: 'override '},
    {span: {start: 8, length: 9} , newText: '<unknown>["words"]'},
    {span: {start: 30, length: 7}, newText: '<unknown>"words"'},
    {span: {start: 50, length: 1}, newText: '<unknown>0'}]);

test("filterOverlappingFix_noOverlap", () => {   
    expect(filterOverlappingFixes(textchanges)).toEqual([textchanges, []]);
})


test("filterOverlappingFix_repeatedFixes", () => { 
    const textchanges_repeat : TextChange[] = sortChangesByStart([{span: {start: 165, length: 0}, newText: 'override '},
        {span: {start: 244, length: 0}, newText: 'override '},
        {span: {start: 8, length: 9} , newText: '<unknown>["words"]'},
        {span: {start: 8, length: 9} , newText: '<unknown>["words"]'},
        {span: {start: 30, length: 7}, newText: '<unknown>"words"'},
        {span: {start: 50, length: 1}, newText: '<unknown>0'},
        {span: {start: 30, length: 7}, newText: '<unknown>"words"'},
        {span: {start: 50, length: 1}, newText: '<unknown>0'}]);

    const repeated_changes = sortChangesByStart([{span: {start: 8, length: 9} , newText: '<unknown>["words"]'},
        {span: {start: 50, length: 1}, newText: '<unknown>0'},
        {span: {start: 30, length: 7}, newText: '<unknown>"words"'}]);

    expect(filterOverlappingFixes(textchanges_repeat)).toEqual([textchanges, repeated_changes]);
})


test("filterOverlappingFix_firstIsKept", () => { 
    const textchanges_oneOverlap : TextChange[] =[
        {span: {start: 8, length: 9} , newText: '<unknown>["words"]'},
        {span: {start: 8, length: 40} , newText: '<unknown>["words"]'},
        {span: {start: 30, length: 7}, newText: '<unknown>"words"'},
        {span: {start: 50, length: 1}, newText: '<unknown>0'}, 
        {span: {start: 165, length: 0}, newText: 'override '},
        {span: {start: 244, length: 0}, newText: 'override '}];

    expect(filterOverlappingFixes(textchanges_oneOverlap)).toEqual([textchanges, [{span: {start: 8, length: 40} , newText: '<unknown>["words"]'}]]);

    const textchanges_severalOverlap : TextChange[] = [
        {span: {start: 8, length: 9} , newText: '<unknown>["words"]'},
        {span: {start: 8, length: 40} , newText: '<unknown>["words"]'},
        {span: {start: 9, length: 40} , newText: '<unknown>["words"]'},
        {span: {start: 27, length: 40} , newText: '<unknown>["words"]'},
        {span: {start: 30, length: 7}, newText: '<unknown>"words"'},
        {span: {start: 50, length: 1}, newText: '<unknown>0'},
        {span: {start: 165, length: 0}, newText: 'override '},
        {span: {start: 244, length: 0}, newText: 'override '}];
    const kept_severalOverlap : TextChange[] = [
        {span: {start: 8, length: 9} , newText: '<unknown>["words"]'},
        {span: {start: 27, length: 40} , newText: '<unknown>["words"]'},
        {span: {start: 165, length: 0}, newText: 'override '},
        {span: {start: 244, length: 0}, newText: 'override '}];
    const droppedList = sortChangesByStart([
        {span: {start: 30, length: 7}, newText: '<unknown>"words"'},
        {span: {start: 50, length: 1}, newText: '<unknown>0'},
        {span: {start: 8, length: 40} , newText: '<unknown>["words"]'},
        {span: {start: 9, length: 40} , newText: '<unknown>["words"]'}
    ]);    // this shows that the first **start** that we hit is the one that's kept, don't know if we want to do more here
    // TODO: There's definitely lots of edge cases here
    expect(filterOverlappingFixes(textchanges_severalOverlap)).toEqual([kept_severalOverlap, droppedList]);
})

test("filterOverlappingFix_staggeredOverlap", () => { 
    const textchanges: TextChange[] = [
        {span: {start: 12, length: 100}, newText: '12 '},
        {span: {start: 24, length: 100}, newText: '23 '},
        {span: {start: 80, length: 50} , newText: '80'},
        {span: {start: 90, length: 45} , newText: '90'},
        {span: {start: 130, length: 7}, newText: '130'},
        {span: {start: 150, length: 1}, newText: '150'}];

    const keptList = [{span: {start: 12, length: 100}, newText: '12 '},
    {span: {start: 130, length: 7}, newText: '130'},
    {span: {start: 150, length: 1}, newText: '150'}];
    const droppedList = [{span: {start: 24, length: 100}, newText: '23 '},
    {span: {start: 80, length: 50} , newText: '80'},
    {span: {start: 90, length: 45} , newText: '90'}];

    expect(filterOverlappingFixes(textchanges)).toEqual([keptList, droppedList]);
})





