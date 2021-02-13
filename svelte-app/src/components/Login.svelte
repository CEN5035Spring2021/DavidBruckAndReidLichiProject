<script lang=ts>
    import { onMount } from 'svelte';
    import { emailAddress, privateKey } from '../stores/user';
    import CreateUser from './CreateUser.svelte';

    let emailInput: HTMLInputElement;
    let feedback: string;
    let emailAddressInvalid: boolean;
    let password: string;
    let passwordInvalid: boolean;
    let creatingUser: boolean;

    onMount(() => emailInput.focus());

    const login = () => {
        const error = (err: any) => {
            if (!feedback) {
                feedback = err;
            }
        };

        feedback = '';
        emailAddressInvalid = false;
        passwordInvalid = false;

        if (!$emailAddress) {
            error('Email is required');
            emailAddressInvalid = true;
        }
        
        if (!password) {
            error('Password is required');
            passwordInvalid = true;
        }
    };

    const onKeyPress = (e: KeyboardEvent) => e.key === 'Enter' && login();
    const createUser = () => creatingUser = true;
    const closeUserCreation = () => creatingUser = false;
</script>

<fieldset>
    <legend>&nbsp;Existing user&nbsp;</legend>
    <label for=email>Email:</label>
    <input type=email id=email bind:value={ $emailAddress } on:keypress={ onKeyPress }
           class:invalid={ emailAddressInvalid } disabled={ creatingUser }
           bind:this={ emailInput } />
    <br />
    <label for=password>Password:</label>
    <input type=password id=password bind:value={ password } on:keypress={ onKeyPress }
           class:invalid={ passwordInvalid } disabled={ creatingUser } />
    <br />
    <br />
    <input type=button value=Login on:click={ login } disabled={ creatingUser } />
    { #if (feedback) }
        <br />
        <span />
        { feedback }
    { /if }
</fieldset>

<br />
<button on:click={ createUser }>Create new user</button>
<br />

{ #if (creatingUser) }
    <CreateUser close={ closeUserCreation } />
{ /if }

<style>    
    legend {
        font-size: 1.3em;
        font-weight: 700;
    }

    label {
        font-weight: 600;
    }

    input {
        width: 100%;
        background-color: #fff;
        color: #333;
    }

    input[ type=button ] {
        cursor: pointer;
        background-color: #efefef;
        color: #000;
    }

    span::before {
        content: "⚠";
        font-size: 1.5em;
        font-weight: 700;
        color: #ff8c00;
        vertical-align: sub;
    }

    .invalid {
        outline: #f00 auto 1px;
    }

    button {
        color: #0064c8;
        cursor: pointer;
        background: none;
        padding: 0;
        margin: 0;
        border: none;
    }

    button:hover {
        text-decoration: underline;
    }

    @media (min-width: 640px) {
        fieldset {
            width: 80%;
            margin-left: auto;
            margin-right: auto;
        }

        label {
            float: left;
            width: calc(25% - 0.5em);
            text-align: right;
            margin-top: 0.3em;
        }

        input {
            width: 75%;
        }

        input[ type=button ] {
            margin-left: calc(25% - 12px);
        }
    }
</style>
