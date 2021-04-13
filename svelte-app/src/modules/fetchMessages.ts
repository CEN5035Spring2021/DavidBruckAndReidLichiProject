import OpenCrypto from 'opencrypto';
import { get } from 'svelte/store';
import { runUnderConversationStore } from '../stores/conversation';
import { runUnderMessagesStore } from '../stores/messages';
import { emailAddress } from '../stores/user';
import { api } from './api';
import getDefaultFunctionsUrl from './getFunctionsUrl';
import { DeleteMessagesResponse } from './serverInterfaces';
import type {
    FetchMessagesRequest, FetchMessagesResponse, MessageResponse, DeleteMessagesRequest
} from './serverInterfaces';
import { sign } from './sign';
import { v4 as uuidV4 } from 'uuid';

const POST = 'POST';

export default async function fetchMessages(
    { signingPrivateKey } : {
        signingPrivateKey?: CryptoKey;
    }) : Promise<void> {

    const crypt = new OpenCrypto();
    const url = `${getDefaultFunctionsUrl()}api/fetchmessages`;
    const request = await sign<FetchMessagesRequest>({
        url,
        method: POST,
        body: {
            emailAddress: get(emailAddress)
        },
        crypt,
        signingKey: signingPrivateKey
    });
    const response = await api<FetchMessagesResponse>({
        method: POST,
        url,
        body: request
    });
    if (!response.messages) {
        return;
    }

    const messagesByOrganization = new Map<string, MessageResponse[]>();
    for (const message of response.messages) {
        const existingMessages = messagesByOrganization.get(message.organization);
        if (existingMessages) {
            existingMessages.push(message);
        } else {
            messagesByOrganization.set(message.organization, [ message ]);
        }
    }

    const messagesByOrganizationAndGroup = new Map<string, Map<string, MessageResponse[]>>();
    for (const [ organizationName, messages ] of messagesByOrganization.entries()) {
        const messagesByGroup = new Map<string, MessageResponse[]>();
        messagesByOrganizationAndGroup.set(organizationName, messagesByGroup);

        for (const message of messages) {
            const existingMessages = messagesByGroup.get(message.group);
            if (existingMessages) {
                existingMessages.push(message);
            } else {
                messagesByGroup.set(message.group, [ message ]);
            }
        }
    }

    const messagesByOrganizationAndGroupAndConversation =
        new Map<string, Map<string, Map<string, MessageResponse[]>>>();
    for (const [ organizationName, organizationMessages ] of messagesByOrganizationAndGroup.entries()) {
        const messagesByGroup = new Map<string, Map<string, MessageResponse[]>>();
        messagesByOrganizationAndGroupAndConversation.set(organizationName, messagesByGroup);

        for (const [ groupName, groupMessages ] of organizationMessages.entries()) {
            const existingGroup = new Map<string, MessageResponse[]>();
            messagesByGroup.set(groupName, existingGroup);

            for (const message of groupMessages) {
                const conversationKey = JSON.stringify(message.users.map(user => user.toLowerCase()).sort());
                const existingConversation = existingGroup.get(conversationKey);
                if (existingConversation) {
                    existingConversation.push(message);
                } else {
                    existingGroup.set(conversationKey, [ message ]);
                }
            }
        }
    }

    const messagesAndConversationId = await runUnderConversationStore(async(store) => {
        const messagesAndConversations: Array<{ message: MessageResponse; conversationId: string }> = [];
        for (const [ organizationName, organizationMessages ]
            of messagesByOrganizationAndGroupAndConversation.entries()) {
            for (const [ groupName, groupMessages ] of organizationMessages.entries()) {
                for (const conversationMessages of groupMessages.values()) {
                    const newConversationId = uuidV4();
                    const existingConversationId = await store.append({
                        organizationName,
                        groupName,
                        conversation: {
                            id: newConversationId,
                            users: conversationMessages[0].users
                        }
                    });
                    for (const message of conversationMessages) {
                        messagesAndConversations.push({
                            message,
                            conversationId: existingConversationId || newConversationId
                        });
                    }
                }
            }
        }
        return messagesAndConversations;
    });

    await runUnderMessagesStore(async(store) => {
        for (const { message, conversationId } of messagesAndConversationId) {
            await store.append({
                messageId: message.messageId,
                encryptedMessage: message.encryptedMessage,
                encryptedKey: message.encryptedKey,
                sender: message.sender,
                conversationId,
                date: message.date
            });
        }
    });

    await deleteMessages({
        crypt,
        signingPrivateKey,
        messages: response.messages.map(message => message.messageId)
    });
}

async function deleteMessages(
    { crypt, signingPrivateKey, messages } : {
        crypt: OpenCrypto;
        signingPrivateKey?: CryptoKey;
        messages: string[];
    }) : Promise<void> {
    const url = `${getDefaultFunctionsUrl()}api/deletemessages`;
    const request = await sign<DeleteMessagesRequest>({
        url,
        method: POST,
        body: {
            messages,
            emailAddress: get(emailAddress)
        },
        crypt,
        signingKey: signingPrivateKey
    });
    const response = await api<DeleteMessagesResponse>({
        method: POST,
        url,
        body: request
    });
    if (response !== DeleteMessagesResponse.Deleted) {
        throw new Error(`Unexpected server response type ${response as string}`);
    }
}
