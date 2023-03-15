import { getAllNoAppliedChangesByFile } from './../../src';
import { CodeFixAction } from 'typescript';

const allNoAppliedChanges = new Map<string, Set<string>>;
const noAppliedChanges: CodeFixAction[] = [
    { fixName: 'fixMissingConstraint', description: '', changes: [{ fileName: 'noAppliedChangesFile', textChanges: [] }] },
    { fixName: 'fixMissingConstraint', description: '', changes: [{ fileName: 'noAppliedChangesFile', textChanges: [] }] },
    { fixName: 'import', description: '', changes: [{ fileName: 'noAppliedChangesFile', textChanges: [] }], commands: ['AddMissingImports'] }
];

const allNoAppliedChanges1 = new Map<string, Set<string>>;
const noAppliedChangesSet1 = new Set<string>;
noAppliedChangesSet1.add('testfile');
noAppliedChangesSet1.add('testfile1');
const noAppliedChangesSet2 = new Set<string>;
noAppliedChangesSet2.add('testfile2');
noAppliedChangesSet2.add('testfile3');
allNoAppliedChanges1.set('fixOverride', noAppliedChangesSet1);
allNoAppliedChanges1.set('fixMissingMember', noAppliedChangesSet2);

test("getAllNoAppliedChangesByFile_startWithEmptyMap", () => {
    const result = getAllNoAppliedChangesByFile(allNoAppliedChanges, noAppliedChanges);
    const resultSet = new Set<string>;
    resultSet.add('noAppliedChangesFile');
    const resultMap = new Map<string, Set<string>>;
    resultMap.set('fixMissingConstraint', resultSet);
    resultMap.set('import', resultSet);
    expect(result).toEqual(resultMap);
});

test("getAllNoAppliedChangesByFile_startWithNonEmptyMap", () => {
    const result = getAllNoAppliedChangesByFile(allNoAppliedChanges1, noAppliedChanges);
    const resultSet = new Set<string>;
    resultSet.add('noAppliedChangesFile');
    const resultSet1 = new Set<string>;
    resultSet1.add('testfile');
    resultSet1.add('testfile1');
    const resultSet2 = new Set<string>;
    resultSet2.add('testfile2');
    resultSet2.add('testfile3');
    const resultSet3 = new Set<string>;
    resultSet3.add('noAppliedChangesFile');
    const resultMap = new Map<string, Set<string>>;
    resultMap.set('fixMissingConstraint', resultSet);
    resultMap.set('fixOverride', resultSet1);
    resultMap.set('fixMissingMember', resultSet2);
    resultMap.set('import', resultSet3);
    expect(result).toEqual(resultMap);
});
