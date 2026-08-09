import * as vscode from 'vscode';
import { exportPatchCommand } from './git/patchExporter';

/**
 * Extension activation.
 */
export function activate(context: vscode.ExtensionContext): void {
    // Register the Export Patch command used by the Source Control context menu.
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'tlcsdm.gitPatchExporter.exportPatch',
            (...args: unknown[]) => exportPatchCommand(...args)
        )
    );
}

/**
 * Extension deactivation.
 */
export function deactivate(): void {
    // Nothing to clean up.
}
