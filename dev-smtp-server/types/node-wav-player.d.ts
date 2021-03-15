declare module 'node-wav-player' {
    export function play(params: { path: string }) : Promise<void>;
}
