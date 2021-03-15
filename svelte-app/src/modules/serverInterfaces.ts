export interface CreateOrganizationRequest {
    name: string,
    emailAddress: string,
    confirmation?: string,
    encryptionKey: string,
    signingKey: string
}
export enum CreateOrganizationResponse {
    AlreadyExists = 'AlreadyExists',
    Created = 'Created',
    ConfirmationEmailSent = 'ConfirmationEmailSent'
}
