import { Diagnostic, getLineAndCharacterOfPosition, getPositionOfLineAndCharacter, SourceFile } from "typescript";
import { ChangeDiagnostic, FixAndDiagnostic, Host } from ".";

const resetEscapeSequence = "\u001b[0m";
const urlSchemeSeparator = "://";
const altDirectorySeparator = "\\";
const directorySeparator = "/";
const backslashRegExp = /\\/g;
const relativePathSegmentRegExp = /(?:\/\/)|(?:^|\/)\.\.?(?:$|\/)/;
const ellipsis = "...";
const halfIndent = "  ";
const indent = "    ";
const fileNameLowerCaseRegExp = /[^\u0130\u0131\u00DFa-z0-9\\/:\-_\. ]+/g;
const gutterStyleSequence = "\u001b[7m";
const gutterSeparator = " ";

enum ForegroundColorEscapeSequences {
    Grey = "\u001b[90m",
    Red = "\u001b[91m",
    Yellow = "\u001b[93m",
    Blue = "\u001b[94m",
    Cyan = "\u001b[96m"
}

const enum CharacterCodes {
    nullCharacter = 0,
    maxAsciiCharacter = 0x7F,

    lineFeed = 0x0A,              // \n
    carriageReturn = 0x0D,        // \r
    lineSeparator = 0x2028,
    paragraphSeparator = 0x2029,
    nextLine = 0x0085,

    // Unicode 3.0 space characters
    space = 0x0020,   // " "
    nonBreakingSpace = 0x00A0,   //
    enQuad = 0x2000,
    emQuad = 0x2001,
    enSpace = 0x2002,
    emSpace = 0x2003,
    threePerEmSpace = 0x2004,
    fourPerEmSpace = 0x2005,
    sixPerEmSpace = 0x2006,
    figureSpace = 0x2007,
    punctuationSpace = 0x2008,
    thinSpace = 0x2009,
    hairSpace = 0x200A,
    zeroWidthSpace = 0x200B,
    narrowNoBreakSpace = 0x202F,
    ideographicSpace = 0x3000,
    mathematicalSpace = 0x205F,
    ogham = 0x1680,

    _ = 0x5F,
    $ = 0x24,

    _0 = 0x30,
    _1 = 0x31,
    _2 = 0x32,
    _3 = 0x33,
    _4 = 0x34,
    _5 = 0x35,
    _6 = 0x36,
    _7 = 0x37,
    _8 = 0x38,
    _9 = 0x39,

    a = 0x61,
    b = 0x62,
    c = 0x63,
    d = 0x64,
    e = 0x65,
    f = 0x66,
    g = 0x67,
    h = 0x68,
    i = 0x69,
    j = 0x6A,
    k = 0x6B,
    l = 0x6C,
    m = 0x6D,
    n = 0x6E,
    o = 0x6F,
    p = 0x70,
    q = 0x71,
    r = 0x72,
    s = 0x73,
    t = 0x74,
    u = 0x75,
    v = 0x76,
    w = 0x77,
    x = 0x78,
    y = 0x79,
    z = 0x7A,

    A = 0x41,
    B = 0x42,
    C = 0x43,
    D = 0x44,
    E = 0x45,
    F = 0x46,
    G = 0x47,
    H = 0x48,
    I = 0x49,
    J = 0x4A,
    K = 0x4B,
    L = 0x4C,
    M = 0x4D,
    N = 0x4E,
    O = 0x4F,
    P = 0x50,
    Q = 0x51,
    R = 0x52,
    S = 0x53,
    T = 0x54,
    U = 0x55,
    V = 0x56,
    W = 0x57,
    X = 0x58,
    Y = 0x59,
    Z = 0x5a,

    ampersand = 0x26,             // &
    asterisk = 0x2A,              // *
    at = 0x40,                    // @
    backslash = 0x5C,             // \
    backtick = 0x60,              // `
    bar = 0x7C,                   // |
    caret = 0x5E,                 // ^
    closeBrace = 0x7D,            // }
    closeBracket = 0x5D,          // ]
    closeParen = 0x29,            // )
    colon = 0x3A,                 // :
    comma = 0x2C,                 // ,
    dot = 0x2E,                   // .
    doubleQuote = 0x22,           // "
    equals = 0x3D,                // =
    exclamation = 0x21,           // !
    greaterThan = 0x3E,           // >
    hash = 0x23,                  // #
    lessThan = 0x3C,              // <
    minus = 0x2D,                 // -
    openBrace = 0x7B,             // {
    openBracket = 0x5B,           // [
    openParen = 0x28,             // (
    percent = 0x25,               // %
    plus = 0x2B,                  // +
    question = 0x3F,              // ?
    semicolon = 0x3B,             // ;
    singleQuote = 0x27,           // '
    slash = 0x2F,                 // /
    tilde = 0x7E,                 // ~

    backspace = 0x08,             // \b
    formFeed = 0x0C,              // \f
    byteOrderMark = 0xFEFF,
    tab = 0x09,                   // \t
    verticalTab = 0x0B,           // \v
}

function formatColorAndReset(text: string, formatStyle: string) {
    return formatStyle + text + resetEscapeSequence;
}

function isVolumeCharacter(charCode: number) {
    return (charCode >= CharacterCodes.a && charCode <= CharacterCodes.z) ||
        (charCode >= CharacterCodes.A && charCode <= CharacterCodes.Z);
}

function getFileUrlVolumeSeparatorEnd(url: string, start: number) {
    const ch0 = url.charCodeAt(start);
    if (ch0 === CharacterCodes.colon) return start + 1;
    if (ch0 === CharacterCodes.percent && url.charCodeAt(start + 1) === CharacterCodes._3) {
        const ch2 = url.charCodeAt(start + 2);
        if (ch2 === CharacterCodes.a || ch2 === CharacterCodes.A) return start + 3;
    }
    return -1;
}

function getEncodedRootLength(path: string): number {
    if (!path) return 0;
    const ch0 = path.charCodeAt(0);

    // POSIX or UNC
    if (ch0 === CharacterCodes.slash || ch0 === CharacterCodes.backslash) {
        if (path.charCodeAt(1) !== ch0) return 1; // POSIX: "/" (or non-normalized "\")

        const p1 = path.indexOf(ch0 === CharacterCodes.slash ? directorySeparator : altDirectorySeparator, 2);
        if (p1 < 0) return path.length; // UNC: "//server" or "\\server"

        return p1 + 1; // UNC: "//server/" or "\\server\"
    }

    // DOS
    if (isVolumeCharacter(ch0) && path.charCodeAt(1) === CharacterCodes.colon) {
        const ch2 = path.charCodeAt(2);
        if (ch2 === CharacterCodes.slash || ch2 === CharacterCodes.backslash) return 3; // DOS: "c:/" or "c:\"
        if (path.length === 2) return 2; // DOS: "c:" (but not "c:d")
    }

    // URL
    const schemeEnd = path.indexOf(urlSchemeSeparator);
    if (schemeEnd !== -1) {
        const authorityStart = schemeEnd + urlSchemeSeparator.length;
        const authorityEnd = path.indexOf(directorySeparator, authorityStart);
        if (authorityEnd !== -1) { // URL: "file:///", "file://server/", "file://server/path"
            // For local "file" URLs, include the leading DOS volume (if present).
            // Per https://www.ietf.org/rfc/rfc1738.txt, a host of "" or "localhost" is a
            // special case interpreted as "the machine from which the URL is being interpreted".
            const scheme = path.slice(0, schemeEnd);
            const authority = path.slice(authorityStart, authorityEnd);
            if (scheme === "file" && (authority === "" || authority === "localhost") &&
                isVolumeCharacter(path.charCodeAt(authorityEnd + 1))) {
                const volumeSeparatorEnd = getFileUrlVolumeSeparatorEnd(path, authorityEnd + 2);
                if (volumeSeparatorEnd !== -1) {
                    if (path.charCodeAt(volumeSeparatorEnd) === CharacterCodes.slash) {
                        // URL: "file:///c:/", "file://localhost/c:/", "file:///c%3a/", "file://localhost/c%3a/"
                        return ~(volumeSeparatorEnd + 1);
                    }
                    if (volumeSeparatorEnd === path.length) {
                        // URL: "file:///c:", "file://localhost/c:", "file:///c$3a", "file://localhost/c%3a"
                        // but not "file:///c:d" or "file:///c%3ad"
                        return ~volumeSeparatorEnd;
                    }
                }
            }
            return ~(authorityEnd + 1); // URL: "file://server/", "http://server/"
        }
        return ~path.length; // URL: "file://server", "http://server"
    }

    // relative
    return 0;
}

function isRootedDiskPath(path: string) {
    return getEncodedRootLength(path) > 0;
}

function isAnyDirectorySeparator(charCode: number): boolean {
    return charCode === CharacterCodes.slash || charCode === CharacterCodes.backslash;
}

function hasTrailingDirectorySeparator(path: string) {
    return path.length > 0 && isAnyDirectorySeparator(path.charCodeAt(path.length - 1));
}

function ensureTrailingDirectorySeparator(path: string) {
    if (!hasTrailingDirectorySeparator(path)) {
        return path + directorySeparator;
    }

    return path;
}

function getPathFromPathComponents(pathComponents: readonly string[]) {
    if (pathComponents.length === 0) return "";

    const root = pathComponents[0] && ensureTrailingDirectorySeparator(pathComponents[0]);
    return root + pathComponents.slice(1).join(directorySeparator);
}

function some<T>(array: readonly T[] | undefined, predicate?: (value: T) => boolean): boolean {
    if (array) {
        if (predicate) {
            for (const v of array) {
                if (predicate(v)) {
                    return true;
                }
            }
        }
        else {
            return array.length > 0;
        }
    }
    return false;
}

function reducePathComponents(components: readonly string[]) {
    if (!some(components)) return [];
    const reduced = [components[0]];
    for (let i = 1; i < components.length; i++) {
        const component = components[i];
        if (!component) continue;
        if (component === ".") continue;
        if (component === "..") {
            if (reduced.length > 1) {
                if (reduced[reduced.length - 1] !== "..") {
                    reduced.pop();
                    continue;
                }
            }
            else if (reduced[0]) continue;
        }
        reduced.push(component);
    }
    return reduced;
}

function normalizeSlashes(path: string): string {
    const index = path.indexOf("\\");
    if (index === -1) {
        return path;
    }
    backslashRegExp.lastIndex = index; // prime regex with known position
    return path.replace(backslashRegExp, directorySeparator);
}

function combinePaths(path: string, ...paths: (string | undefined)[]): string {
    if (path) path = normalizeSlashes(path);
    for (let relativePath of paths) {
        if (!relativePath) continue;
        relativePath = normalizeSlashes(relativePath);
        if (!path || getRootLength(relativePath) !== 0) {
            path = relativePath;
        }
        else {
            path = ensureTrailingDirectorySeparator(path) + relativePath;
        }
    }
    return path;
}

function getRootLength(path: string) {
    const rootLength = getEncodedRootLength(path);
    return rootLength < 0 ? ~rootLength : rootLength;
}

function lastOrUndefined<T>(array: readonly T[] | undefined): T | undefined {
    return array === undefined || array.length === 0 ? undefined : array[array.length - 1];
}

function pathComponents(path: string, rootLength: number) {
    const root = path.substring(0, rootLength);
    const rest = path.substring(rootLength).split(directorySeparator);
    if (rest.length && !lastOrUndefined(rest)) rest.pop();
    return [root, ...rest];
}

function getPathComponents(path: string, currentDirectory = "") {
    path = combinePaths(currentDirectory, path);
    return pathComponents(path, getRootLength(path));
}

function equateStringsCaseInsensitive(a: string, b: string) {
    return a === b
        || a !== undefined
        && b !== undefined
        && a.toUpperCase() === b.toUpperCase();
}

function identity<T>(x: T) {
    return x;
}

function toLowerCase(x: string) {
    return x.toLowerCase();
}

function toFileNameLowerCase(x: string) {
    return fileNameLowerCaseRegExp.test(x) ?
        x.replace(fileNameLowerCaseRegExp, toLowerCase) :
        x;
}

export type GetCanonicalFileName = (fileName: string) => string;
export function createGetCanonicalFileName(useCaseSensitiveFileNames: boolean): GetCanonicalFileName {
    return useCaseSensitiveFileNames ? identity : toFileNameLowerCase;
}

function getPathComponentsRelativeTo(from: string, to: string, stringEqualityComparer: (a: string, b: string) => boolean, getCanonicalFileName: GetCanonicalFileName) {
    const fromComponents = reducePathComponents(getPathComponents(from));
    const toComponents = reducePathComponents(getPathComponents(to));

    let start: number;
    for (start = 0; start < fromComponents.length && start < toComponents.length; start++) {
        const fromComponent = getCanonicalFileName(fromComponents[start]);
        const toComponent = getCanonicalFileName(toComponents[start]);
        const comparer = start === 0 ? equateStringsCaseInsensitive : stringEqualityComparer;
        if (!comparer(fromComponent, toComponent)) break;
    }

    if (start === 0) {
        return toComponents;
    }

    const components = toComponents.slice(start);
    const relative: string[] = [];
    for (; start < fromComponents.length; start++) {
        relative.push("..");
    }
    return ["", ...relative, ...components];
}

function normalizePath(path: string): string {
    path = normalizeSlashes(path);
    // Most paths don't require normalization
    if (!relativePathSegmentRegExp.test(path)) {
        return path;
    }
    // Some paths only require cleanup of `/./` or leading `./`
    const simplified = path.replace(/\/\.\//g, "/").replace(/^\.\//, "");
    if (simplified !== path) {
        path = simplified;
        if (!relativePathSegmentRegExp.test(path)) {
            return path;
        }
    }
    // Other paths require full normalization
    const normalized = getPathFromPathComponents(reducePathComponents(getPathComponents(path)));
    return normalized && hasTrailingDirectorySeparator(path) ? ensureTrailingDirectorySeparator(normalized) : normalized;
}

function resolvePath(path: string, ...paths: (string | undefined)[]): string {
    return normalizePath(some(paths) ? combinePaths(path, ...paths) : normalizeSlashes(path));
}

function equateValues<T>(a: T, b: T) {
    return a === b;
}

function equateStringsCaseSensitive(a: string, b: string) {
    return equateValues(a, b);
}

function getRelativePathToDirectoryOrUrl(directoryPathOrUrl: string, relativeOrAbsolutePath: string, currentDirectory: string, getCanonicalFileName: GetCanonicalFileName, isAbsolutePathAnUrl: boolean) {
    const pathComponents = getPathComponentsRelativeTo(
        resolvePath(currentDirectory, directoryPathOrUrl),
        resolvePath(currentDirectory, relativeOrAbsolutePath),
        equateStringsCaseSensitive,
        getCanonicalFileName
    );

    const firstComponent = pathComponents[0];
    if (isAbsolutePathAnUrl && isRootedDiskPath(firstComponent)) {
        const prefix = firstComponent.charAt(0) === directorySeparator ? "file://" : "file:///";
        pathComponents[0] = prefix + firstComponent;
    }

    return getPathFromPathComponents(pathComponents);
}

function convertToRelativePath(absoluteOrRelativePath: string, basePath: string, getCanonicalFileName: (path: string) => string): string {
    return !isRootedDiskPath(absoluteOrRelativePath)
        ? absoluteOrRelativePath
        : getRelativePathToDirectoryOrUrl(basePath, absoluteOrRelativePath, basePath, getCanonicalFileName, /*isAbsolutePathAnUrl*/ false);
}

function formatLocation(file: SourceFile, start: number, host: Host, color = formatColorAndReset) {
    const { line: firstLine, character: firstLineChar } = getLineAndCharacterOfPosition(file, start);
    const relativeFileName = host ? convertToRelativePath(file.fileName, host.getCurrentDirectory(), (fileName: string) => host.getCanonicalFileName(fileName)) : file.fileName;

    let output = "";
    output += color(relativeFileName, ForegroundColorEscapeSequences.Cyan);
    output += ":";
    output += color(`${firstLine + 1}`, ForegroundColorEscapeSequences.Yellow);
    output += ":";
    output += color(`${firstLineChar + 1}`, ForegroundColorEscapeSequences.Yellow);
    return output;
}

enum DiagnosticCategory {
    Warning,
    Error,
    Suggestion,
    Message
}

function diagnosticCategoryName(d: { category: DiagnosticCategory }, lowerCase = true): string {
    const name = DiagnosticCategory[d.category];
    return lowerCase ? name.toLowerCase() : name;
}

interface DiagnosticMessageChain {
    messageText: string;
    category: DiagnosticCategory;
    code: number;
    next?: DiagnosticMessageChain[];
}

function isString(text: unknown): text is string {
    return typeof text === "string";
}

function flattenDiagnosticMessageText(diag: string | DiagnosticMessageChain | undefined, newLine: string, indent = 0): string {
    if (isString(diag)) {
        return diag;
    }
    else if (diag === undefined) {
        return "";
    }
    let result = "";
    if (indent) {
        result += newLine;

        for (let i = 0; i < indent; i++) {
            result += "  ";
        }
    }
    result += diag.messageText;
    indent++;
    if (diag.next) {
        for (const kid of diag.next) {
            result += flattenDiagnosticMessageText(kid, newLine, indent);
        }
    }
    return result;
}

function padLeft(s: string, length: number, padString: " " | "0" = " ") {
    return length <= s.length ? s : padString.repeat(length - s.length) + s;
}

function isWhiteSpaceSingleLine(ch: number): boolean {
    // Note: nextLine is in the Zs space, and should be considered to be a whitespace.
    // It is explicitly not a line-break as it isn't in the exact set specified by EcmaScript.
    return ch === CharacterCodes.space ||
        ch === CharacterCodes.tab ||
        ch === CharacterCodes.verticalTab ||
        ch === CharacterCodes.formFeed ||
        ch === CharacterCodes.nonBreakingSpace ||
        ch === CharacterCodes.nextLine ||
        ch === CharacterCodes.ogham ||
        ch >= CharacterCodes.enQuad && ch <= CharacterCodes.zeroWidthSpace ||
        ch === CharacterCodes.narrowNoBreakSpace ||
        ch === CharacterCodes.mathematicalSpace ||
        ch === CharacterCodes.ideographicSpace ||
        ch === CharacterCodes.byteOrderMark;
}

function isLineBreak(ch: number): boolean {
    // ES5 7.3:
    // The ECMAScript line terminator characters are listed in Table 3.
    //     Table 3: Line Terminator Characters
    //     Code Unit Value     Name                    Formal Name
    //     \u000A              Line Feed               <LF>
    //     \u000D              Carriage Return         <CR>
    //     \u2028              Line separator          <LS>
    //     \u2029              Paragraph separator     <PS>
    // Only the characters in Table 3 are treated as line terminators. Other new line or line
    // breaking characters are treated as white space but not as line terminators.

    return ch === CharacterCodes.lineFeed ||
        ch === CharacterCodes.carriageReturn ||
        ch === CharacterCodes.lineSeparator ||
        ch === CharacterCodes.paragraphSeparator;
}

function isWhiteSpaceLike(ch: number): boolean {
    return isWhiteSpaceSingleLine(ch) || isLineBreak(ch);
}

function trimEndImpl(s: string) {
    let end = s.length - 1;
    while (end >= 0) {
        if (!isWhiteSpaceLike(s.charCodeAt(end))) break;
        end--;
    }
    return s.slice(0, end + 1);
}

const trimStringEnd = !!String.prototype.trimEnd ? ((s: string) => s.trimEnd()) : trimEndImpl;

function formatCodeSpan(file: SourceFile, start: number, length: number, indent: string, host: Host) {
    const { line: firstLine, character: firstLineChar } = getLineAndCharacterOfPosition(file, start);
    const { line: lastLine, character: lastLineChar } = getLineAndCharacterOfPosition(file, start + length);
    const lastLineInFile = getLineAndCharacterOfPosition(file, file.text.length).line;

    const hasMoreThanFiveLines = (lastLine - firstLine) >= 4;
    let gutterWidth = (lastLine + 1 + "").length;
    if (hasMoreThanFiveLines) {
        gutterWidth = Math.max(ellipsis.length, gutterWidth);
    }

    let context = "";
    for (let i = firstLine; i <= lastLine; i++) {
        context += host.getNewLine();
        // If the error spans over 5 lines, we'll only show the first 2 and last 2 lines,
        // so we'll skip ahead to the second-to-last line.
        if (hasMoreThanFiveLines && firstLine + 1 < i && i < lastLine - 1) {
            context += indent + formatColorAndReset(padLeft(ellipsis, gutterWidth), gutterStyleSequence) + gutterSeparator + host.getNewLine();
            i = lastLine - 1;
        }

        const lineStart = getPositionOfLineAndCharacter(file, i, 0);
        const lineEnd = i < lastLineInFile ? getPositionOfLineAndCharacter(file, i + 1, 0) : file.text.length;
        let lineContent = file.text.slice(lineStart, lineEnd);
        lineContent = trimStringEnd(lineContent);  // trim from end
        lineContent = lineContent.replace(/\t/g, " ");   // convert tabs to single spaces

        // Output the gutter and the actual contents of the line.
        context += indent + formatColorAndReset(padLeft(i + 1 + "", gutterWidth), gutterStyleSequence) + gutterSeparator;
        context += lineContent + host.getNewLine();

        // Output the gutter and the error span for the line using tildes.
        context += indent + formatColorAndReset(padLeft("", gutterWidth), gutterStyleSequence) + gutterSeparator;
        // context += squiggleColor;
        // if (i === firstLine) {
        //     // If we're on the last line, then limit it to the last character of the last line.
        //     // Otherwise, we'll just squiggle the rest of the line, giving 'slice' no end position.
        //     const lastCharForLine = i === lastLine ? lastLineChar : undefined;

        //     context += lineContent.slice(0, firstLineChar).replace(/\S/g, " ");
        //     context += lineContent.slice(firstLineChar, lastCharForLine).replace(/./g, "~");
        // }
        // else if (i === lastLine) {
        //     context += lineContent.slice(0, lastLineChar).replace(/./g, "~");
        // }
        // else {
        //     // Squiggle the entire line.
        //     context += lineContent.replace(/./g, "~");
        // }
        context += resetEscapeSequence;
    }
    return context;
}

function getCategoryFormat(category: DiagnosticCategory): ForegroundColorEscapeSequences {
    switch (category) {
        case DiagnosticCategory.Error: return ForegroundColorEscapeSequences.Red;
        case DiagnosticCategory.Warning: return ForegroundColorEscapeSequences.Yellow;
        // case DiagnosticCategory.Suggestion: return Debug.fail("Should never get an Info diagnostic on the command line.");
        case DiagnosticCategory.Suggestion: return ForegroundColorEscapeSequences.Cyan;
        case DiagnosticCategory.Message: return ForegroundColorEscapeSequences.Blue;
    }
}

export function formatFixOnADifferentLocation(diagnostics: readonly ChangeDiagnostic[], host: Host): string {
    let output = "";
    for (const diagnostic of diagnostics) {
        if (diagnostic.file) {
            const { file, start } = diagnostic;
            output += formatLocation(file, start!, host);
        }

        if (diagnostic.file) {
            output += host.getNewLine();
            output += formatCodeSpan(diagnostic.file, diagnostic.start!, diagnostic.length!, "", host);
        }

        output += host.getNewLine();
    }
    return output;
}

export function formatDiagnosticsWithColorAndContextTsFix(diagnostics: readonly Diagnostic[], host: Host): string {
    let output = "";
    for (const diagnostic of diagnostics) {
        if (diagnostic.file) {
            const { file, start } = diagnostic;
            output += formatLocation(file, start!, host);
            output += " - ";
        }

        output += formatColorAndReset(diagnosticCategoryName(diagnostic), getCategoryFormat(diagnostic.category));
        output += formatColorAndReset(` TS${diagnostic.code}: `, ForegroundColorEscapeSequences.Grey);
        output += flattenDiagnosticMessageText(diagnostic.messageText, host.getNewLine());
        output += host.getNewLine();
    }

    if (diagnostics[0].file) {
        output += formatCodeSpan(diagnostics[0].file, diagnostics[0].start!, diagnostics[0].length!, "", host);
    }

    output += host.getNewLine();

    return output;
}

function formatCodeSpanForFixesInTheSameSpan(file: SourceFile, start: number, length: number, indent: string, squiggleColor: ForegroundColorEscapeSequences, host: Host) {
    const { line: firstLine, character: firstLineChar } = getLineAndCharacterOfPosition(file, start);
    const { line: lastLine, character: lastLineChar } = getLineAndCharacterOfPosition(file, start + length);
    const lastLineInFile = getLineAndCharacterOfPosition(file, file.text.length).line;

    const hasMoreThanFiveLines = (lastLine - firstLine) >= 4;
    let gutterWidth = (lastLine + 1 + "").length;
    if (hasMoreThanFiveLines) {
        gutterWidth = Math.max(ellipsis.length, gutterWidth);
    }

    let context = "";
    for (let i = firstLine; i <= lastLine; i++) {
        context += host.getNewLine();
        // If the error spans over 5 lines, we'll only show the first 2 and last 2 lines,
        // so we'll skip ahead to the second-to-last line.
        if (hasMoreThanFiveLines && firstLine + 1 < i && i < lastLine - 1) {
            context += indent + formatColorAndReset(padLeft(ellipsis, gutterWidth), gutterStyleSequence) + gutterSeparator + host.getNewLine();
            i = lastLine - 1;
        }

        const lineStart = getPositionOfLineAndCharacter(file, i, 0);
        const lineEnd = i < lastLineInFile ? getPositionOfLineAndCharacter(file, i + 1, 0) : file.text.length;
        let lineContent = file.text.slice(lineStart, lineEnd);
        lineContent = trimStringEnd(lineContent);  // trim from end
        lineContent = lineContent.replace(/\t/g, " ");   // convert tabs to single spaces

        // Output the gutter and the actual contents of the line.
        context += indent + formatColorAndReset(padLeft(i + 1 + "", gutterWidth), gutterStyleSequence) + gutterSeparator;
        context += lineContent + host.getNewLine();

        // Output the gutter and the error span for the line using tildes.
        context += indent + formatColorAndReset(padLeft("", gutterWidth), gutterStyleSequence) + gutterSeparator;
        context += squiggleColor;
        if (i === firstLine) {
            // If we're on the last line, then limit it to the last character of the last line.
            // Otherwise, we'll just squiggle the rest of the line, giving 'slice' no end position.
            const lastCharForLine = i === lastLine ? lastLineChar : undefined;

            context += lineContent.slice(0, firstLineChar).replace(/\S/g, " ");
            context += lineContent.slice(firstLineChar, lastCharForLine).replace(/./g, "~");
        }
        else if (i === lastLine) {
            context += lineContent.slice(0, lastLineChar).replace(/./g, "~");
        }
        else {
            // Squiggle the entire line.
            context += lineContent.replace(/./g, "~");
        }
        context += resetEscapeSequence;
    }
    return context;
}

export function formatFixesInTheSameSpan(fixAndDiagnostics: FixAndDiagnostic[], host: Host): string {
    let output = "";
    for (const fixAndDiagnostic of fixAndDiagnostics) {
        if (fixAndDiagnostic.diagnostic.file) {
            const { file, start } = fixAndDiagnostic.diagnostic;
            output += formatLocation(file, start!, host);
            output += " - ";
        }

        output += formatColorAndReset(diagnosticCategoryName(fixAndDiagnostic.diagnostic), getCategoryFormat(fixAndDiagnostic.diagnostic.category));
        output += formatColorAndReset(` TS${fixAndDiagnostic.diagnostic.code}: `, ForegroundColorEscapeSequences.Grey);
        output += flattenDiagnosticMessageText(fixAndDiagnostic.diagnostic.messageText, host.getNewLine());
        output += host.getNewLine();
        if (fixAndDiagnostic.diagnostic.file) {
            output += formatCodeSpanForFixesInTheSameSpan(fixAndDiagnostic.diagnostic.file, fixAndDiagnostic.diagnostic.start!, fixAndDiagnostic.diagnostic.length!, "",  getCategoryFormat(fixAndDiagnostic.diagnostic.category), host);
            output += host.getNewLine();
        }
    }

    output += host.getNewLine();

    return output;
}