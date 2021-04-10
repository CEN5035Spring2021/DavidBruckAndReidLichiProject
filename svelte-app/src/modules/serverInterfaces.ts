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
    organizations?: OrganizationResponse[];
    users?: UserResponse[];
}
export interface OrganizationResponse {
    name?: string;
    admin?: boolean;
    users?: string[];
    groups?: GroupResponse[];
}
export interface UserResponse {
    emailAddress?: string;
    encryptionPublicKey?: string;
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
    users?: string[];
}
export interface CreateGroupUserRequest {
    groupUserEmailAddress?: string;
    organizationName?: string;
    groupName?: string;
    confirmation?: string;
    encryptionKey?: string;
    signingKey?: string;
    emailAddress: string;
}
export interface CreateGroupUserResponse {
    type: CreateGroupUserResponseType;
    organization?: OrganizationResponse;
    users?: UserResponse[];
}
export enum CreateGroupUserResponseType {
    AlreadyExists = 'AlreadyExists',
    Created = 'Created',
    ConfirmationEmailSent = 'ConfirmationEmailSent'
}
export interface SignalRConnectionInfo {
    accessToken: string;
    url: string;
}
export interface NewGroupUserMessage {
    organization: string;
    group: string;
    emailAddress: string;
    encryptionKey: string;
}
