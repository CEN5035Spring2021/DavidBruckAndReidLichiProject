<script lang=ts>
    import type OpenCrypto from 'opencrypto';
    import { onMount } from 'svelte';
    import { globalFeedback } from '../stores/globalFeedback';
    import type { IMessage } from '../stores/messages';
    import { encryptionPrivateKey } from '../stores/user';

    export let crypt: OpenCrypto;
    export let message: IMessage;

    const AES_LENGTH = 256;

    let sender = message.sender;
    let decrypted = 'Decrypting...';

    onMount(() => {
        decrypt()
            .then(value => decrypted = value)
            .catch(reason =>
                globalFeedback.update(feedback => [
                    ...feedback,
                    {
                        message: 'Error in safeCreateGroup: ' +
                            (reason && (reason as { message: string }).message || reason as string)
                    }
                ]));
    });

    async function decrypt(): Promise<string> {
        const decryptedBuffer = await crypt.decrypt(
            await crypt.decryptKey(
                $encryptionPrivateKey as CryptoKey,
                message.encryptedKey,
                {
                    type: 'raw',
                    name: 'AES-GCM',
                    length: AES_LENGTH,
                    usages: [
                        'encrypt',
                        'decrypt',
                        'wrapKey',
                        'unwrapKey'
                    ]
                }) as CryptoKey,
            message.encryptedMessage,
            {
                cipher: 'AES-GCM'
            }) as ArrayBuffer;
        return new TextDecoder().decode(decryptedBuffer);
    }
</script>

<li class=sender>
    { sender }:
</li>
<li class=message>
    { decrypted }
</li>

<style>
    li {
        text-align: left;
    }
        li.sender {
            font-weight: 500;
        }
            li.sender:not(:first-of-type) {
                margin-top: 10px;
            }
        li.message {
            margin-bottom: 10px;
            border: 1px solid black;
            border-radius: 5px;
            padding: 0 5px 5px 5px;
        }
</style>
