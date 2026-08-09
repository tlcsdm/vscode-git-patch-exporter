import * as assert from 'assert';
import {
    buildDiffArgs,
    buildUntrackedDiffArgs,
    concatenatePatchSegments,
    suggestPatchFileName,
    toRepoRelativePath,
} from '../git/patchUtils';

suite('patchUtils', () => {
    test('buildDiffArgs uses HEAD base and places paths after --', () => {
        const args = buildDiffArgs({ base: 'HEAD', relativePaths: ['src/a.ts', 'src/b.ts'] });
        assert.deepStrictEqual(args, ['diff', 'HEAD', '--', 'src/a.ts', 'src/b.ts']);
    });

    test('buildDiffArgs adds --cached for staged diffs without a base', () => {
        const args = buildDiffArgs({ cached: true, relativePaths: ['a.txt'] });
        assert.deepStrictEqual(args, ['diff', '--cached', '--', 'a.txt']);
    });

    test('buildDiffArgs without base or cached diffs the working tree', () => {
        const args = buildDiffArgs({ relativePaths: ['a.txt'] });
        assert.deepStrictEqual(args, ['diff', '--', 'a.txt']);
    });

    test('buildUntrackedDiffArgs compares against /dev/null', () => {
        assert.deepStrictEqual(
            buildUntrackedDiffArgs('new.txt'),
            ['diff', '--no-index', '--', '/dev/null', 'new.txt']
        );
    });

    test('toRepoRelativePath returns POSIX separators', () => {
        const root = process.platform === 'win32' ? 'C:\\repo' : '/repo';
        const file = process.platform === 'win32' ? 'C:\\repo\\src\\a.ts' : '/repo/src/a.ts';
        assert.strictEqual(toRepoRelativePath(root, file), 'src/a.ts');
    });

    test('concatenatePatchSegments drops empty segments and ensures trailing newline', () => {
        const result = concatenatePatchSegments(['first line', '', '   ', 'second line\n']);
        assert.strictEqual(result, 'first line\nsecond line\n');
    });

    test('concatenatePatchSegments normalizes CRLF to LF', () => {
        const result = concatenatePatchSegments(['a\r\nb\r\n']);
        assert.strictEqual(result, 'a\nb\n');
    });

    test('suggestPatchFileName produces a timestamped .patch name', () => {
        const name = suggestPatchFileName(new Date(2026, 7, 9, 4, 13, 17));
        assert.strictEqual(name, 'changes-20260809-041317.patch');
    });
});
