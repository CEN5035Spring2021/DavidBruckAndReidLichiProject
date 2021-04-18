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
    ConfirmationEmailSent = 'ConfirmationEmailSent',
    UserAlreadyExists = 'UserAlreadyExists'
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
    ConfirmationEmailSent = 'ConfirmationEmailSent',
    UserAlreadyExists = 'UserAlreadyExists'
}

export interface NegotiateResponse {
    type: NegotiateResponseType;
    connectionInfo?: SignalRConnectionInfo;
}
export enum NegotiateResponseType {
    Success = 'Success',
    UserAlreadyExists = 'UserAlreadyExists'
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
    otherUsers?: UserResponse[];
}
export interface SendMessageRequest {
    organization: string;
    group: string;
    userMessages: IUserMessage[];
    encryptedMessage: string;
    emailAddress: string;
}
export interface IUserMessage {
    emailAddress: string;
    encryptedKey: string;
}
export enum SendMessageResponse {
    Sent = 'Sent'
}
export interface FetchMessagesRequest {
    emailAddress: string;
}
export interface FetchMessagesResponse {
    messages: MessageResponse[];
}
export interface MessageResponse {
    messageId: string;
    organization: string;
    group: string;
    users: string[];
    sender: string;
    encryptedMessage: string;
    encryptedKey: string;
    date: string;
}
export interface DeleteMessagesRequest {
    messages: string[];
    emailAddress: string;
}
export enum DeleteMessagesResponse {
    Deleted = 'Deleted'
}
export interface NegotiateRequest {
    emailAddress: string;
}
