<script context=module lang=ts>
    // Must import in reverse dependency order so bundle.js loads regeneratorRuntime before shimIndexedDB
    import './modules/indexedDB';
    import 'indexeddbshim/dist/indexeddbshim';
    import 'regenerator-runtime/runtime';
    import 'core-js-bundle/minified';
    import onHashChanged from './modules/onHashChanged';

    window.onhashchange = onHashChanged;
</script>

<script lang="ts">
    import CreateOrganization from './components/CreateOrganization.svelte';
    import Footer from './components/Footer.svelte';
    import Login from './components/Login.svelte';
    import { encryptionPrivateKey } from './stores/user';
    import GlobalFeedback from './components/GlobalFeedback.svelte';
</script>

<h1>
    Secure Group Messenger
    <br />
    <small>CEN5035 Spring 2021 David Bruck and Reid Lichi Project</small>
</h1>
{ #if ($encryptionPrivateKey) }
    <b>Logged in!</b>
    <CreateOrganization close={ alert.bind(null, 'Close not implemented') } />
{ :else }
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
