<script lang=ts>
import { writable } from 'svelte/store';

    import { emailAddress } from '../stores/user'

    let feedback;
    let emailAddressInvalid;
    let password;
    let passwordInvalid;

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
</script>

<fieldset>
    <legend>&nbsp;Existing user&nbsp;</legend>
    <label for=email>Email:</label>
    <input type=email name=email bind:value={ $emailAddress } on:keypress={ onKeyPress }
           class:invalid={ emailAddressInvalid } />
    <br />
    <label for=password>Password:</label>
    <input type=password name=password bind:value={ password } on:keypress={ onKeyPress }
           class:invalid={ passwordInvalid } />
    <br />
    <br />
    <input type=button value=Login on:click={ login } />
    { #if (feedback) }
        <br />
        <span></span>
        { feedback }
    { /if }
</fieldset>

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
    }

    span::before {
        content: "⚠";
        font-size: 1.5em;
        font-weight: 700;
        color: darkorange;
        vertical-align: sub;
    }

    .invalid {
        outline: red auto 1px;
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
