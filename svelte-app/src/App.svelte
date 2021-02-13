<script context=module>
    // Must import in reverse dependency order so bundle.js loads regeneratorRuntime before shimIndexedDB
    import './modules/indexedDB';
    import '../node_modules/indexeddbshim/dist/indexeddbshim';
    import '../node_modules/regenerator-runtime/runtime';
    import '../node_modules/core-js-bundle/minified';
</script>

<script lang=ts>
    import Footer from './components/Footer.svelte';
    import Login from './components/Login.svelte';
    import { privateKey } from './stores/user';
</script>

<h1>
    Secure Group Messenger
    <br />
    <small>CEN5035 Spring 2021 David Bruck Project</small>
</h1>
{ #if ($privateKey) }
    <b>Logged in!</b>
{ :else }
    <Login />
{ /if }
<br />
<Footer />

<style>
    h1 {
        color: #ff3e00;
        text-transform: uppercase;
        font-size: 2em;
        font-weight: 100;
    }
</style>