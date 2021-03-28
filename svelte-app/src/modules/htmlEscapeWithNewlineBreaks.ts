export default function htmlEscapeWithNewLineBreaks(raw: string): string {
    return raw
        .split('\n')
        .map(line => line
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;'))
        .join('<br/>');
}
