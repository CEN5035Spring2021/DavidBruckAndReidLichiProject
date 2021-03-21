import * as child_process from 'child_process';

export default runCommandAsync;
function runCommandAsync(
    command: string,
    options?: {
        errorCodeToResponses?: { [ key: number ]: boolean | undefined };
        verbose?: boolean;
    }) : Promise<boolean> {

    return new Promise<boolean>((resolve, reject) => {
        const spawned = child_process.spawn(
            command,
            {
                shell: true,
                env: process.env,
                cwd: process.cwd()
            });

        let buffers: Array<{ data: string | Uint8Array; isError: boolean }>;
        if (options?.verbose) {
            spawned.stdout.pipe(process.stdout);
            spawned.stderr.pipe(process.stderr);
        } else {
            buffers = [];
            spawned.stdout.on('data', data => buffers.push({
                data: data as string | Uint8Array,
                isError: false
            }));
            spawned.stderr.on('data', data => buffers.push({
                data: data as string | Uint8Array,
                isError: true
            }));
        }

        spawned.on('error', reject);
        spawned.on('exit', code => {
            const result = code
                ? options?.errorCodeToResponses ? options?.errorCodeToResponses[code] : undefined
                : true;
            if (code && typeof result === 'undefined') {
                if (!options?.verbose) {
                    for (const buffer of buffers) {
                        process[buffer.isError ? 'stderr' : 'stdout'].write(buffer.data);
                    }
                }
                reject();
            } else {
                resolve(result || false);
            }
        });
    });
}
