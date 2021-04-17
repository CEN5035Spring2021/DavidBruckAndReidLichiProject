<script lang=ts>
    import OpenCrypto from 'opencrypto';
    import { onMount } from 'svelte';
    import {
        conversationUsers, runUnderConversationStore, conversations, selectedConversation
    } from '../stores/conversation';
    import { globalFeedback } from '../stores/globalFeedback';
    import type { IMessage } from '../stores/messages';
    import { runUnderMessagesStore, messages } from '../stores/messages';
    import { encryptionPublicKey } from '../stores/user';
    import { emailAddress } from '../stores/user';
    import { v4 as uuidV4 } from 'uuid';
    import { selectedOrganization } from '../stores/organization';
    import type { IConversation, IGroup } from '../stores/group';
    import { selectedGroup } from '../stores/group';
    import Message from './Message.svelte';
    import { api } from '../modules/api';
    import getDefaultFunctionsUrl from '../modules/getFunctionsUrl';
    import type { SendMessageRequest } from '../modules/serverInterfaces';
    import { SendMessageResponse } from '../modules/serverInterfaces';
    import { sign } from '../modules/sign';

    const AES_LENGTH = 256;
    const NO_WAIT = 0;
    const POST = 'POST';

    let messageInput: HTMLTextAreaElement;
    let message = '';
    let sendingMessage = false;
    const crypt = new OpenCrypto();

    onMount(() => messageInput.focus());

    const sendMessage = async() => {
        sendingMessage = true;
        try {
            const recipients = ($conversationUsers as string[]);
            const organizationName = $selectedOrganization as string;
            const group = ($selectedGroup as IGroup);
            const groupName = group.name;
            const selfMessageOnly =
                recipients[0].toLowerCase() === ($emailAddress as string).toLowerCase();
            const recipientsToEncryptionKeys = new Map<string, string>(
                group.users.map(user => [ user.emailAddress.toLowerCase(), user.encryptionPublicKey ]));

            const crypt = new OpenCrypto();
            const sharedKey = await crypt.getSharedKey(
                AES_LENGTH,
                {
                    cipher: 'AES-GCM',
                    usages: [
                        'encrypt',
                        'decrypt',
                        'wrapKey',
                        'unwrapKey'
                    ],
                    isExtractable: true
                }) as CryptoKey;
            const groupMessages: Array<{ encryptedKey: string; recipient: string }> = [];
            const encryptedMessage = await crypt.encrypt(
                sharedKey,
                new TextEncoder().encode(message)) as string;

            for (const recipient of recipients) {
                groupMessages.push({
                    encryptedKey: await crypt.encryptKey(
                        await crypt.pemPublicToCrypto(
                            recipientsToEncryptionKeys.get(recipient.toLowerCase()),
                            {
                                name: 'RSA-OAEP',
                                hash: 'SHA-512',
                                usages: [
                                    'encrypt',
                                    'wrapKey'
                                ]
                            }) as CryptoKey,
                        sharedKey) as string,
                    recipient
                });
            }

            let conversationId = uuidV4();
            const existingConversationId = await runUnderConversationStore(store => store.append({
                organizationName,
                groupName,
                conversation: {
                    id: conversationId,
                    users: recipients
                }
            }));
            if (existingConversationId) {
                conversationId = existingConversationId;
            }
            if (($selectedConversation as IConversation)?.id !== conversationId) {
                for (const conversation of ($conversations as IConversation[])) {
                    if (conversation.id === conversationId) {
                        $selectedConversation = conversation;
                        break;
                    }
                }
            }

            const now = new Date().getTime().toString();
            const selfMessage: IMessage = selfMessageOnly
                ? {
                    messageId: uuidV4(),
                    sender: $emailAddress as string,
                    conversationId,
                    date: now,
                    encryptedMessage,
                    encryptedKey: groupMessages[0].encryptedKey
                }
                : {
                    messageId: uuidV4(),
                    sender: $emailAddress as string,
                    conversationId,
                    date: now,
                    encryptedMessage,
                    encryptedKey: await crypt.encryptKey(
                        $encryptionPublicKey as CryptoKey,
                        sharedKey) as string
                };

            if (!selfMessageOnly) {
                const url = `${getDefaultFunctionsUrl()}api/sendmessage`;
                const request = await sign<SendMessageRequest>({
                    url,
                    method: POST,
                    body: {
                        organization: organizationName,
                        group: groupName,
                        userMessages: groupMessages.map(groupMessage => ({
                            emailAddress: groupMessage.recipient,
                            encryptedKey: groupMessage.encryptedKey
                        })),
                        encryptedMessage,
                        emailAddress: $emailAddress as string
                    },
                    crypt
                });
                const response = await api<SendMessageResponse>({
                    method: POST,
                    url,
                    body: request
                });
                if (response !== SendMessageResponse.Sent) {
                    throw new Error(`Unexpected server response type ${response as string}`);
                }
            }

            await runUnderMessagesStore(store => store.append(selfMessage));

            message = '';
            setTimeout(
                () => messageInput.focus(),
                NO_WAIT);
        } finally {
            sendingMessage = false;
        }
    };

    const onKeyPress = async(e: KeyboardEvent) => e.key === 'Enter' && await sendMessage();
    const safeOnKeyPress: (e: KeyboardEvent) => void = e => onKeyPress(e).catch(reason =>
        globalFeedback.update(feedback => [
            ...feedback,
            {
                message: 'Error in safeOnKeyPress: ' +
                    (reason && (reason as { message: string }).message || reason as string)
            }
        ]));
</script>

<ul>
    { #each $messages as message }
        <Message { crypt } { message } />
    { /each }
</ul>
<textarea placeholder="Write a message" bind:value={ message } on:keypress={ safeOnKeyPress }
          disabled={ sendingMessage } bind:this={ messageInput } />
<input type=button value=Send on:click={ sendMessage } disabled={ sendingMessage } />

<style>
    ul {
        grid-area: messages;
        list-style-type: none;
        overflow: auto;
        margin: 0;
        padding: 0;
    }
    textarea {
        grid-area: newMessage;
        resize: vertical;
        margin-bottom: 0;
        min-height: 40px;
        max-height: 200px;
    }
    input {
        grid-area: sendMessage;
    }
</style>
