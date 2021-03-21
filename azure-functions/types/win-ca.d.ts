declare module 'win-ca/api' {
    export = Api;
    function Api(params: {
        save: boolean;
        ondata: Buffer[] | ((...items: Buffer[]) => number);
    }): void;
}
