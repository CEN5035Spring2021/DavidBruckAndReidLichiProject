<script lang=ts>
    import OpenCrypto from 'opencrypto';
    import { onMount } from 'svelte';
    import { conversationUsers, runUnderConversationStore } from '../stores/conversation';
    import { globalFeedback } from '../stores/globalFeedback';
    import type { IMessage, IMessageBase } from '../stores/messages';
    import { runUnderMessagesStore, messages } from '../stores/messages';
    import type { IOrganizationUser } from '../stores/user';
    import { encryptionPublicKey } from '../stores/user';
    import { emailAddress } from '../stores/user';
    import { v4 } from 'uuid';
    import { selectedOrganization } from '../stores/organization';
    import type { IGroup } from '../stores/group';
    import { selectedGroup } from '../stores/group';
    import Message from './Message.svelte';

    const AES_LENGTH = 256;
    const NO_WAIT = 0;

    let messageInput: HTMLTextAreaElement;
    let message = '';
    let sendingMessage = false;
    const crypt = new OpenCrypto();

    onMount(() => messageInput.focus());

    const sendMessage = async() => {
        sendingMessage = true;
        try {
            const recipients = ($conversationUsers as IOrganizationUser[]);
            const organizationName = $selectedOrganization as string;
            const groupName = ($selectedGroup as IGroup).name;
            const selfMessageOnly =
                recipients[0].emailAddress.toLowerCase() === ($emailAddress as string).toLowerCase();

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
            const groupMessages: Array<{ message: IMessageBase; recipient: string }> = [];
            const encryptedMessage = await crypt.encrypt(
                sharedKey,
                new TextEncoder().encode(message)) as string;

            for (const recipient of recipients) {
                groupMessages.push({
                    message: {
                        encryptedMessage,
                        encryptedKey: await crypt.encryptKey(
                            await crypt.pemPublicToCrypto(
                                recipient.encryptionPublicKey,
                                {
                                    name: 'RSA-OAEP',
                                    hash: 'SHA-512',
                                    usages: [
                                        'encrypt',
                                        'wrapKey'
                                    ]
                                }) as CryptoKey,
                            sharedKey) as string
                    },
                    recipient: recipient.emailAddress
                });
            }

            let conversationId = v4();
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

            const now = new Date().getTime();
            const selfMessage: IMessage = selfMessageOnly
                ? {
                    sender: $emailAddress as string,
                    conversationId,
                    date: now,
                    ...groupMessages[0].message
                }
                : {
                    sender: $emailAddress as string,
                    conversationId,
                    date: now,
                    encryptedMessage,
                    encryptedKey: await crypt.encryptKey(
                        $encryptionPublicKey as CryptoKey,
                        sharedKey) as string
                };

            if (!selfMessageOnly) {
                throw new Error('TODO: Sending messages to other users');
            }

            await runUnderMessagesStore(store => store.append({
                conversationId,
                message: selfMessage
            }));

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
