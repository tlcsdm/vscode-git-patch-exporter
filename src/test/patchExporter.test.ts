import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import { promises as fs } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { collectResourceUris, generateRepositoryPatch } from '../git/patchExporter';

const execFileAsync = promisify(execFile);

function fakeResourceState(fsPath: string): { resourceUri: vscode.Uri } {
    return { resourceUri: vscode.Uri.file(fsPath) };
}

suite('collectResourceUris', () => {
    test('extracts the URI from a single resource state', () => {
        const uris = collectResourceUris([fakeResourceState('/repo/a.txt')]);
        assert.deepStrictEqual(uris.map(uri => uri.fsPath), [vscode.Uri.file('/repo/a.txt').fsPath]);
    });

    test('extracts URIs from a multi-selection array (second argument)', () => {
        const first = fakeResourceState('/repo/a.txt');
        const all = [first, fakeResourceState('/repo/b.txt')];
        const uris = collectResourceUris([first, all]);
        assert.deepStrictEqual(
            uris.map(uri => uri.fsPath),
            [vscode.Uri.file('/repo/a.txt').fsPath, vscode.Uri.file('/repo/b.txt').fsPath]
        );
    });

    test('extracts URIs from a resource group', () => {
        const group = { resourceStates: [fakeResourceState('/repo/a.txt'), fakeResourceState('/repo/b.txt')] };
        const uris = collectResourceUris([group]);
        assert.strictEqual(uris.length, 2);
    });

    test('accepts raw URIs and ignores non-file schemes', () => {
        const uris = collectResourceUris([
            vscode.Uri.file('/repo/a.txt'),
            vscode.Uri.parse('untitled:Untitled-1'),
        ]);
        assert.deepStrictEqual(uris.map(uri => uri.fsPath), [vscode.Uri.file('/repo/a.txt').fsPath]);
    });

    test('deduplicates repeated resources', () => {
        const uris = collectResourceUris([
            fakeResourceState('/repo/a.txt'),
            fakeResourceState('/repo/a.txt'),
        ]);
        assert.strictEqual(uris.length, 1);
    });
});

suite('generateRepositoryPatch', () => {
    let repoRoot: string;

    async function git(args: string[], cwd: string): Promise<string> {
        const { stdout } = await execFileAsync('git', args, { cwd });
        return stdout;
    }

    setup(async () => {
        repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'patch-exporter-'));
        await git(['init'], repoRoot);
        await git(['config', 'user.email', 'test@example.com'], repoRoot);
        await git(['config', 'user.name', 'Test'], repoRoot);
        await git(['config', 'commit.gpgsign', 'false'], repoRoot);
    });

    teardown(async () => {
        await fs.rm(repoRoot, { recursive: true, force: true });
    });

    test('captures tracked modifications and untracked files and applies cleanly', async () => {
        const tracked = path.join(repoRoot, 'tracked.txt');
        await fs.writeFile(tracked, 'line1\n');
        await git(['add', 'tracked.txt'], repoRoot);
        await git(['commit', '-m', 'init'], repoRoot);

        // Modify the tracked file and add an untracked file.
        await fs.writeFile(tracked, 'line1\nline2\n');
        const untracked = path.join(repoRoot, 'untracked.txt');
        await fs.writeFile(untracked, 'brand new\n');

        const patch = await generateRepositoryPatch(repoRoot, [tracked, untracked]);

        assert.ok(patch.includes('a/tracked.txt'), 'patch should include the tracked file');
        assert.ok(patch.includes('+line2'), 'patch should include the added line');
        assert.ok(patch.includes('b/untracked.txt'), 'patch should include the untracked file');
        assert.ok(patch.includes('+brand new'), 'patch should include the untracked content');

        // The generated patch should apply cleanly on a pristine checkout.
        await git(['checkout', '--', 'tracked.txt'], repoRoot);
        await fs.rm(untracked);
        const patchFile = path.join(repoRoot, 'changes.patch');
        await fs.writeFile(patchFile, patch);
        await git(['apply', 'changes.patch'], repoRoot);

        assert.strictEqual(await fs.readFile(tracked, 'utf8'), 'line1\nline2\n');
        assert.strictEqual(await fs.readFile(untracked, 'utf8'), 'brand new\n');
    });

    test('returns an empty patch when there are no changes', async () => {
        const tracked = path.join(repoRoot, 'tracked.txt');
        await fs.writeFile(tracked, 'line1\n');
        await git(['add', 'tracked.txt'], repoRoot);
        await git(['commit', '-m', 'init'], repoRoot);

        const patch = await generateRepositoryPatch(repoRoot, [tracked]);
        assert.strictEqual(patch.trim(), '');
    });
});
