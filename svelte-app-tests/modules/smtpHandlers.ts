import type { SMTPServerAddress } from 'smtp-server';

type EmailSubscription = (data: Buffer) => void;

const emailWaiters: { [ emailAddress: string ]: EmailSubscription | Buffer | undefined } = {};
export function receiveEmail(emailAddress: string, callback: EmailSubscription) : void {
    const emailSubscription = emailWaiters[emailAddress];
    switch (typeof emailSubscription) {
        case 'function':
            throw new Error(
                `Duplicate subscriptions to email address without receiving a message in between: ${emailAddress}`);
        case 'undefined':
            emailWaiters[emailAddress] = callback;
            break;
        default:
            callback(emailSubscription);
            delete emailWaiters[emailAddress];
            break;
    }
}
export function onEmailReceived(rcptTo: SMTPServerAddress[], data: Buffer[]) : void {
    const concatData = Buffer.concat(data);
    for (const toAddress of rcptTo) {
        const emailSubscription = emailWaiters[toAddress.address];
        switch (typeof emailSubscription) {
            case 'function':
                emailSubscription(concatData);
                delete emailWaiters[toAddress.address];
                break;
            case 'undefined':
                emailWaiters[toAddress.address] = concatData;
                break;
            default:
                throw new Error(
                    `Duplicate email received to email address without being read in between: ${toAddress.address}`);
        }
    }
}
