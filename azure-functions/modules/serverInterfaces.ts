export interface Signed {
    signature?: string;
    time?: string;
}
export interface Organization {
    id: string;
    name: string;
}
export interface OrganizationConfirmation {
    id: string;
    name: string;
    emailAddress: string;
    encryptionKey: string;
    signingKey: string;
}
export interface User {
    id: string;
    emailAddress: string;
    encryptionKey: string;
    signingKey: string;
}
export interface OrganizationUser {
    id: string;
    organizationId: string;
    userId: string;
    admin?: boolean;
}
export interface IUser {
    emailAddress?: string;
}
