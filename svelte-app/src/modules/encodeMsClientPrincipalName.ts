const LENGTH_OF_ALPHANUMERIC = 36;
const STRING_START = 0;

const safeCharCodes = new Set<number>(
    [ ...Array(LENGTH_OF_ALPHANUMERIC).keys() ] // 0-9 and a-z
        .map(idx => idx.toString(LENGTH_OF_ALPHANUMERIC).charCodeAt(STRING_START))
        .concat(
            [ '-', '.', '_' ].map(
                safeChar => safeChar.charCodeAt(STRING_START))
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
