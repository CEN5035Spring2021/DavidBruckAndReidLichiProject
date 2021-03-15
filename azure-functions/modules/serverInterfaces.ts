export interface Signed {
    signature?: string;
}
export interface Organization {
    id: string,
    name: string
}
export interface OrganizationConfirmation {
    id: string,
    name: string,
    emailAddress: string,
    encryptionKey: string,
    signingKey: string
}