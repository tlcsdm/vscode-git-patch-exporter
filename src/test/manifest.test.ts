import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

suite('package.json manifest', () => {
    test('contributes Export Patch to Git SCM file and group context menus', () => {
        const manifestPath = path.resolve(__dirname, '../../package.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
            contributes?: {
                menus?: Record<string, Array<{ command?: string; when?: string; group?: string }>>;
            };
        };

        const expectedWhen = 'scmProvider == git && (scmResourceGroup == workingTree || scmResourceGroup == index)';

        for (const menuId of ['scm/resourceState/context', 'scm/resourceGroup/context']) {
            const entries = manifest.contributes?.menus?.[menuId] ?? [];
            assert.ok(
                entries.some(entry =>
                    entry.command === 'tlcsdm.gitPatchExporter.exportPatch' &&
                    entry.when === expectedWhen &&
                    entry.group === '1_patchexport@1'
                ),
                `expected ${menuId} to contribute tlcsdm.gitPatchExporter.exportPatch for Git working tree/index resources`
            );
        }
    });
});
