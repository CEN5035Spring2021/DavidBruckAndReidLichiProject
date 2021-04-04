export function emailAddressMatch(emailAddress: string) : boolean {
    // // Doing everything in a single Regexp pattern does not work in Microsoft Edge version 44
    // // (requires negative lookbehind support)
    // return /((?<!@)[^@])+@[^_@]+(?!.*(?:_|@))/.test(localEmailAddress);

    // Cross-platform multi-Regexp solution
    const domainMatch = /@[^_@]+(?!.*(?:_|@))/.exec(emailAddress);
    if (!domainMatch) {
        return false;
    }
    // Single at (@) sign match
    return emailAddress.length === domainMatch.index +
        /[^@]+(?!.*@)/.exec(emailAddress.split('').reverse().join(''))?.index;
}
