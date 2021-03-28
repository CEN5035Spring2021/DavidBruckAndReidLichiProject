import * as asmCrypto from 'asmcrypto.js/asmcrypto.all.es5';
declare global {
    interface Window {
        asmCrypto?: unknown;
    }
}
window.asmCrypto = asmCrypto;
export {};
