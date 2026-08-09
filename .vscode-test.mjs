import { defineConfig } from '@vscode/test-cli';

// On macOS, the default user-data-dir path may exceed the 103-character UNIX
// domain socket name limit, causing VS Code to fail with EINVAL on startup.
// Use a shorter path when running on darwin to avoid that error.
const launchArgs = process.platform === 'darwin' ? ['--user-data-dir=/tmp/vsc-test'] : [];

export default defineConfig({
    version: 'stable',
    files: './out/test/extension.test.js',
    extensionDevelopmentPath: '.',
    ...(launchArgs.length > 0 ? { launchArgs } : {}),
});
