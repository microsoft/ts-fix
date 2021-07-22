import { doTextChangeOnString } from "../src/index";
// import path from "path";
import { TextChange } from "typescript";

test("textChangeOnString1", () => {
    const originalString = "012345";
    const textChange : TextChange = {
        span : { 
            start : 3,
            length : 3
        }, 
        newText : "qwe"
    } ;
    const expectedString = "012qwe";
    expect(doTextChangeOnString(originalString, textChange)).toEqual(expectedString);
});

test("textChangeOnString2", () => {
    const originalString = "012345";
    const textChange : TextChange = {
        span : { 
            start : 3,
            length : 0
        }, 
        newText : "qwe"
    } ;
    const expectedString = "012qwe345";
    expect(doTextChangeOnString(originalString, textChange)).toEqual(expectedString);
});