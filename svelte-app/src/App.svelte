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
    import CreateOrganization from './components/CreateOrganization.svelte';
    import Footer from './components/Footer.svelte';
    import Login from './components/Login.svelte';
    import { encryptionPrivateKey } from './stores/user';
    import GlobalFeedback from './components/GlobalFeedback.svelte';
    import { confirmingOrganization } from './stores/organization';
    import { writable } from 'svelte/store';
    import { globalFeedback, subscribePleaseWait, unconditionalMessage } from './stores/globalFeedback';
    import { runUnderSettingsStore } from './stores/settings';

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
    <small>CEN5035 Spring 2021 David Bruck and Reid Lichi Project</small>
</h1>
{ #if $encryptionPrivateKey && !$confirmingOrganization }
    <b>Logged in!</b>
    <CreateOrganization close={ alert.bind(null, 'Close not implemented') } />
{ :else if !$checkingBrowser }
    <Login />
{ /if }
<br />
<Footer />
<GlobalFeedback />

<style>
    h1 {
        color: #ff3e00;
        text-transform: uppercase;
        font-size: 2em;
        font-weight: 100;
    }
</style>
