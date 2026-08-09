import * as path from 'path';

/**
 * Options used to build the argument list for a `git diff` invocation.
 */
export interface DiffArgsOptions {
    /** Revision to diff against (for example `HEAD`). Omit for the working tree / index. */
    readonly base?: string;
    /** When true, diff the staged (index) changes using `--cached`. */
    readonly cached?: boolean;
    /** Repository-relative paths to limit the diff to. */
    readonly relativePaths: readonly string[];
}

/**
 * Build the argument list for a `git diff` command that is limited to the
 * provided repository-relative paths. Paths are always passed after a `--`
 * separator so that file names are never interpreted as revisions or options.
 */
export function buildDiffArgs(options: DiffArgsOptions): string[] {
    const args = ['diff'];
    if (options.cached) {
        args.push('--cached');
    }
    if (options.base) {
        args.push(options.base);
    }
    args.push('--', ...options.relativePaths);
    return args;
}

/**
 * Build the argument list for producing a "new file" diff of an untracked file
 * by comparing it against `/dev/null`. Git returns exit code 1 for this command
 * when differences exist, which callers must treat as success.
 */
export function buildUntrackedDiffArgs(relativePath: string): string[] {
    return ['diff', '--no-index', '--', '/dev/null', relativePath];
}

/**
 * Convert an absolute file path into a repository-relative path using POSIX
 * separators, which Git accepts on every platform.
 */
export function toRepoRelativePath(repositoryRoot: string, absolutePath: string): string {
    const relative = path.relative(repositoryRoot, absolutePath);
    return relative.split(path.sep).join('/');
}

/**
 * Join individual patch segments into a single patch document, dropping empty
 * segments and guaranteeing the result ends with a trailing newline.
 */
export function concatenatePatchSegments(segments: readonly string[]): string {
    const parts = segments
        .map(segment => segment.replace(/\r\n/g, '\n'))
        .filter(segment => segment.trim().length > 0)
        .map(segment => (segment.endsWith('\n') ? segment : `${segment}\n`));
    return parts.join('');
}

function pad(value: number): string {
    return value.toString().padStart(2, '0');
}

/**
 * Suggest a timestamped patch file name such as `changes-20260809-041317.patch`.
 */
export function suggestPatchFileName(date: Date = new Date()): string {
    const stamp =
        `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
        `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    return `changes-${stamp}.patch`;
}
