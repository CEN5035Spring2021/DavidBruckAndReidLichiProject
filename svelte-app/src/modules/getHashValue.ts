export default function getHashValue(key: string) : string | undefined {
    const hash = location.hash.substr(1); // Strip preceeding '#'
    const keyValue = hash
        .substr(
            hash.search(new RegExp(
                '(?<=^|&)' +
                key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
                '=')))
        .split('&')[0]
        .split('=');
    if (keyValue.length > 1) {
        return keyValue[1];
    }
}
