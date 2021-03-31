export interface CreateOrganizationRequest {
    emailAddress: string;
    name?: string;
    confirmation?: string;
    encryptionKey: string;
    signingKey: string;
}
export interface CreateOrganizationResponse {
    type: CreateOrganizationResponseType;
    name?: string;
}
export enum CreateOrganizationResponseType {
    AlreadyExists = 'AlreadyExists',
    Created = 'Created',
    ConfirmationEmailSent = 'ConfirmationEmailSent'
}
export interface OrganizationsRequest {
    emailAddress: string;
}
export interface OrganizationsResponse {
    organizations?: Organization[];
}
export interface Organization {
    name?: string;
    admin?: boolean;
    users?: string[];
    groups?: GroupResponse[];
}
export interface CreateGroupRequest {
    emailAddress: string;
    name: string;
    organizationName: string;
}
export enum CreateGroupResponse {
    AlreadyExists = 'AlreadyExists',
    Created = 'Created'
}
export interface GroupResponse {
    name?: string;
}
