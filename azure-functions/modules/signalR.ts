const safeCharCodes = new Set<number>(
    [ ...Array(36).keys() ] // 0-9 and a-z
        .map(idx => idx.toString(36).charCodeAt(0))
        .concat(
            [ '-', '.', '_' ].map(
                safeChar => safeChar.charCodeAt(0))
        ));

// Need to encode SignalR user names to prevent errors which only occur on Azure.
// Oddly, the emulator had no such issues. Example problematic email: dbruck1+Admin@fau.edu
// Error from Azure:
// Microsoft.Azure.SignalR.Common.AzureSignalRUnauthorizedException : Authorization failed.
// Make sure you provide the correct connection string and have access to the resource. Request Uri:
export function encodeMsClientPrincipalName(xMsClientPrincipalName: string) : string {
    return [ ...Array(xMsClientPrincipalName.length).keys() ].reduce(
        (previousValue, currentValue) => {
            const nextCharCode = xMsClientPrincipalName.charCodeAt(currentValue);
            return safeCharCodes.has(nextCharCode)
                ? previousValue + xMsClientPrincipalName[currentValue]
                : previousValue + escapeCharCode(nextCharCode);
        },
        '');
}

function escapeCharCode(charCode: number) : string {
    return `~${charCode}~`;
}

export function decodeMsClientPrincipalName(xMsClientPrincipalName: string) : string {
    let idx = 0;
    let decode = '';
    while (idx < xMsClientPrincipalName.length) {
        const nextEscape = xMsClientPrincipalName.indexOf('~', idx);
        if (nextEscape === -1) {
            return decode + xMsClientPrincipalName.substr(idx);
        }
        const escapeEnd = xMsClientPrincipalName.indexOf('~', nextEscape + 1);
        if (escapeEnd === -1) {
            throw new Error(`Incomplete escape sequence: ${xMsClientPrincipalName.substr(nextEscape)}`);
        }

        const escapedCode = Number(xMsClientPrincipalName.substr(nextEscape + 1, escapeEnd - nextEscape - 1));
        if (isNaN(escapedCode)) {
            throw new Error(
                `Invalid escape sequence: ${xMsClientPrincipalName.substr(nextEscape, escapeEnd - nextEscape + 1)}`);
        }

        decode += xMsClientPrincipalName.substr(idx, nextEscape - idx) + String.fromCharCode(escapedCode);
        idx = escapeEnd + 1;
    }
    return decode;
}
