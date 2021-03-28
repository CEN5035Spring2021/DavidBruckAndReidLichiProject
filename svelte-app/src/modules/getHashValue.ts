export default function getHashValue(key: string) : string | undefined {
    const hash = location.hash.substr(1); // Strip preceeding '#'
    const match = new RegExp(
        '(^|&)' +
        key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
        '=').exec(hash);
    if (!match) {
        return;
    }
    const keyValue = hash
        .substr(match[1].length + match.index)
        .split('&')[0]
        .split('=');
    if (keyValue.length > 1) {
        return keyValue[1];
    }
}
