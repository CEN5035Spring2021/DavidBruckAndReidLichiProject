import * as os from 'os';
import * as path from 'path';

export default getElevatePrefix;
function getElevatePrefix(): string {
    return path.join(
        path.resolve(__dirname, '..'),
        'node_modules', 'windows-elevate', 'dependencies', 'elevate',
        os.arch() === 'x64' ? 'bin.x86-64' : 'bin.x86-32', 'elevate.exe -c -w ');
}
