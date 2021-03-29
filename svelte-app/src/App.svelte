<script context=module lang=ts>
    // Must import in reverse dependency order so bundle.js loads regeneratorRuntime before shimIndexedDB;
    // similar dependency issues exist between asmcrypto.js -> webcrypto-liner -> opencrypto (in onHashChanged)
    import './modules/indexedDB';
    import 'indexeddbshim/dist/indexeddbshim';
    import onHashChanged from './modules/onHashChanged';
    import 'webcrypto-liner';
    import './modules/asmcrypto';
    import 'fastestsmallesttextencoderdecoder';

    window.onhashchange = onHashChanged;
</script>

<script lang="ts">
    import Footer from './components/Footer.svelte';
    import Login from './components/Login.svelte';
    import { encryptionPrivateKey } from './stores/user';
    import GlobalFeedback from './components/GlobalFeedback.svelte';
    import { confirmingOrganization } from './stores/organization';
    import { writable } from 'svelte/store';
    import { globalFeedback, subscribePleaseWait, unconditionalMessage } from './stores/globalFeedback';
    import { runUnderSettingsStore } from './stores/settings';
    import Organizations from './components/Organizations.svelte';
    import Groups from './components/Groups.svelte';
    import Conversations from './components/Conversations.svelte';

    const checkingBrowser = writable(true);

    runUnderSettingsStore(store => store.supportsRSASigning())
        .then(({ value, persisted }) => {
            // Can only show one unconditional message so have to switch out just the message
            if (value) {
                $checkingBrowser = false;
            } else {
                $unconditionalMessage = {
                    message: 'Browser does not support RSA Signing.\n' +
                        'Secure Group Messenger requires a newer browser.'
                };
            }

            if (persisted) {
                return Promise.resolve();
            }

            return runUnderSettingsStore(store => store.persistRSASigning(value));
        }).catch(reason =>
            globalFeedback.update(feedback => [
                ...feedback,
                {
                    message: 'Error in supportsRSASigning: ' +
                        (reason && (reason as { message: string }).message || reason as string)
                }
            ]));

    subscribePleaseWait(checkingBrowser, 'Checking browser for security features...');
</script>

<h1>
    Secure Group Messenger
    <br />
    <small>CEN5035 Spring 2021 David Bruck Project</small>
</h1>
{ #if $encryptionPrivateKey && !$confirmingOrganization }
    <Organizations class=organizations />
    <Groups class=groups />
    <Conversations class=conversations />
{ :else if !$checkingBrowser }
    <Login class=login />
{ /if }
<Footer class=footer />
<GlobalFeedback />

<style>
    :global(body) {
        display: grid;
        grid-template-columns: 3fr 3fr 5fr;
        grid-template-rows: 106px 1fr 47px;
        grid-template-areas: "header        header header       "
                             "organizations groups conversations"
                             "footer        footer footer       ";
    }
    h1 {
        grid-area: header;
        color: #f5793a;
        text-transform: uppercase;
        font-size: 2em;
        font-weight: 400;
        margin: 0;
        padding-top: 20px;
        white-space: nowrap;
    }
    :global(.login) {
        grid-row: unset;
        -ms-grid-row: 2;
        grid-column: unset;
        -ms-grid-column: 1;
        -ms-grid-column-span: 3;
        grid-area: organizations / organizations / organizations / conversations;
    }
    :global(.organizations) {
        grid-area: organizations;
    }
    :global(.groups) {
        grid-area: groups;
    }
    :global(.conversations) {
        grid-area: conversations;
    }
    :global(.footer) {
        grid-area: footer;
    }
    :global(.organizations, .groups, .conversations) {
        overflow: auto;
    }
</style>
