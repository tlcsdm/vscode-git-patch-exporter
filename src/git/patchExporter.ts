import * as vscode from 'vscode';
import * as path from 'path';
import { execFile } from 'child_process';
import {
    buildDiffArgs,
    buildUntrackedDiffArgs,
    concatenatePatchSegments,
    suggestPatchFileName,
    toRepoRelativePath,
} from './patchUtils';

interface GitResult {
    readonly stdout: string;
    readonly stderr: string;
    readonly code: number;
}

/** Raised when the `git` executable cannot be found on the host. */
export class GitNotFoundError extends Error {}

const MAX_GIT_BUFFER = 128 * 1024 * 1024;

/**
 * Resolve the path to the `git` executable. Prefers the path reported by the
 * VS Code built-in `vscode.git` extension so that the extension works even
 * when `git` is not on the system PATH (for example when Git for Windows is
 * installed but its `bin` directory is not in PATH).
 */
async function resolveGitPath(): Promise<string> {
    try {
        const gitExtension = vscode.extensions.getExtension<{ getAPI(version: 1): { git: { path: string } } }>('vscode.git');
        if (gitExtension) {
            const api = gitExtension.isActive
                ? gitExtension.exports.getAPI(1)
                : (await gitExtension.activate()).getAPI(1);
            const gitPath = api?.git?.path;
            if (gitPath && gitPath.length > 0) {
                return gitPath;
            }
        }
    } catch {
        // Fall through to default.
    }
    return 'git';
}

function runGitWith(gitPath: string, args: readonly string[], cwd: string): Promise<GitResult> {
    return new Promise((resolve, reject) => {
        execFile(
            gitPath,
            args as string[],
            { cwd, maxBuffer: MAX_GIT_BUFFER, windowsHide: true },
            (error, stdout, stderr) => {
                if (error && typeof (error as NodeJS.ErrnoException).code === 'string') {
                    // A string error code (for example ENOENT) means git could not be spawned.
                    reject(new GitNotFoundError((error as Error).message));
                    return;
                }
                const code =
                    error && typeof (error as { code?: number }).code === 'number'
                        ? (error as { code: number }).code
                        : 0;
                resolve({ stdout, stderr, code });
            }
        );
    });
}

function runGit(args: readonly string[], cwd: string): Promise<GitResult> {
    return resolveGitPath().then(gitPath => runGitWith(gitPath, args, cwd));
}

function assertGitOk(result: GitResult, allowedCodes: readonly number[] = [0]): GitResult {
    if (!allowedCodes.includes(result.code)) {
        const details = result.stderr.trim() || `git exited with code ${result.code}`;
        throw new Error(details);
    }
    return result;
}

/**
 * Extract the file URIs from the arguments passed to the SCM context menu
 * command. Handles single resources, multi-selection arrays, resource groups,
 * and raw URIs.
 */
export function collectResourceUris(args: readonly unknown[]): vscode.Uri[] {
    const collected: vscode.Uri[] = [];
    const seen = new Set<string>();

    const visit = (value: unknown): void => {
        if (!value) {
            return;
        }
        if (value instanceof vscode.Uri) {
            addUri(value);
            return;
        }
        if (Array.isArray(value)) {
            for (const item of value) {
                visit(item);
            }
            return;
        }
        const candidate = value as {
            resourceUri?: vscode.Uri;
            resourceStates?: unknown[];
        };
        if (candidate.resourceUri instanceof vscode.Uri) {
            addUri(candidate.resourceUri);
        }
        if (Array.isArray(candidate.resourceStates)) {
            for (const state of candidate.resourceStates) {
                visit(state);
            }
        }
    };

    const addUri = (uri: vscode.Uri): void => {
        if (uri.scheme !== 'file') {
            return;
        }
        const key = uri.toString();
        if (!seen.has(key)) {
            seen.add(key);
            collected.push(uri);
        }
    };

    for (const arg of args) {
        visit(arg);
    }

    return collected;
}

async function getRepositoryRoot(fileUri: vscode.Uri): Promise<string | undefined> {
    const cwd = path.dirname(fileUri.fsPath);
    const result = await runGit(['rev-parse', '--show-toplevel'], cwd);
    if (result.code !== 0) {
        return undefined;
    }
    const root = result.stdout.trim();
    return root.length > 0 ? root : undefined;
}

async function hasHead(repositoryRoot: string): Promise<boolean> {
    const result = await runGit(['rev-parse', '--verify', '--quiet', 'HEAD'], repositoryRoot);
    return result.code === 0;
}

/**
 * Generate a unified diff patch for the given absolute file paths within a
 * single repository. Includes staged, unstaged, and untracked (new) files.
 * Exported for testing.
 */
export async function generateRepositoryPatch(repositoryRoot: string, absolutePaths: readonly string[]): Promise<string> {
    const relativePaths = absolutePaths.map(absolutePath => toRepoRelativePath(repositoryRoot, absolutePath));
    const segments: string[] = [];

    if (await hasHead(repositoryRoot)) {
        const diff = assertGitOk(
            await runGit(buildDiffArgs({ base: 'HEAD', relativePaths }), repositoryRoot)
        );
        segments.push(diff.stdout);
    } else {
        // Unborn branch: combine staged and unstaged tracked changes.
        const staged = assertGitOk(
            await runGit(buildDiffArgs({ cached: true, relativePaths }), repositoryRoot)
        );
        segments.push(staged.stdout);
        const unstaged = assertGitOk(await runGit(buildDiffArgs({ relativePaths }), repositoryRoot));
        segments.push(unstaged.stdout);
    }

    const untracked = assertGitOk(
        await runGit(['ls-files', '--others', '--exclude-standard', '--', ...relativePaths], repositoryRoot)
    );
    const untrackedPaths = untracked.stdout.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    for (const untrackedPath of untrackedPaths) {
        // `git diff --no-index` exits with code 1 when differences are found.
        const diff = assertGitOk(
            await runGit(buildUntrackedDiffArgs(untrackedPath), repositoryRoot),
            [0, 1]
        );
        segments.push(diff.stdout);
    }

    return concatenatePatchSegments(segments);
}

async function groupUrisByRepository(uris: readonly vscode.Uri[]): Promise<Map<string, vscode.Uri[]>> {
    const groups = new Map<string, vscode.Uri[]>();
    for (const uri of uris) {
        const root = await getRepositoryRoot(uri);
        if (!root) {
            continue;
        }
        const existing = groups.get(root);
        if (existing) {
            existing.push(uri);
        } else {
            groups.set(root, [uri]);
        }
    }
    return groups;
}

function resolveDefaultDirectory(repositoryRoots: readonly string[]): string {
    const configured = vscode.workspace
        .getConfiguration('tlcsdm.gitPatchExporter')
        .get<string>('defaultDirectory', '')
        .trim();
    if (configured.length > 0) {
        return configured;
    }
    return repositoryRoots[0];
}

/**
 * Command handler for `tlcsdm.gitPatchExporter.exportPatch`.
 */
export async function exportPatchCommand(...args: unknown[]): Promise<void> {
    const uris = collectResourceUris(args);
    if (uris.length === 0) {
        vscode.window.showWarningMessage(vscode.l10n.t('No changed files were selected to export.'));
        return;
    }

    try {
        const patch = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: vscode.l10n.t('Exporting patch...'),
                cancellable: false,
            },
            async () => {
                const groups = await groupUrisByRepository(uris);
                if (groups.size === 0) {
                    return undefined;
                }
                const parts: string[] = [];
                for (const [root, groupUris] of groups) {
                    parts.push(await generateRepositoryPatch(root, groupUris.map(uri => uri.fsPath)));
                }
                return { patch: concatenatePatchSegments(parts), roots: [...groups.keys()] };
            }
        );

        if (!patch) {
            vscode.window.showErrorMessage(
                vscode.l10n.t('The selected files are not part of a Git repository.')
            );
            return;
        }

        if (patch.patch.trim().length === 0) {
            vscode.window.showInformationMessage(
                vscode.l10n.t('No changes were found for the selected files.')
            );
            return;
        }

        const defaultDirectory = resolveDefaultDirectory(patch.roots);
        const defaultUri = vscode.Uri.file(path.join(defaultDirectory, suggestPatchFileName()));
        const targetUri = await vscode.window.showSaveDialog({
            defaultUri,
            saveLabel: vscode.l10n.t('Save Patch'),
            filters: { Patch: ['patch', 'diff'] },
        });
        if (!targetUri) {
            return;
        }

        await vscode.workspace.fs.writeFile(targetUri, Buffer.from(patch.patch, 'utf8'));

        const openAction = vscode.l10n.t('Open Patch');
        const selection = await vscode.window.showInformationMessage(
            vscode.l10n.t('Patch exported to {0}', targetUri.fsPath),
            openAction
        );
        if (selection === openAction) {
            const document = await vscode.workspace.openTextDocument(targetUri);
            await vscode.window.showTextDocument(document);
        }
    } catch (error) {
        if (error instanceof GitNotFoundError) {
            vscode.window.showErrorMessage(
                vscode.l10n.t('Git was not found. Please install Git and ensure it is available on your PATH.')
            );
            return;
        }
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(vscode.l10n.t('Failed to export patch: {0}', message));
    }
}
