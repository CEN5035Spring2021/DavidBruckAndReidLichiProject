<script lang=ts>
    export let close: () => void;
</script>

<div class=backdrop on:click={ close } />
<div class=modal>
    <span title=Close on:click={ close }>x</span>
    <slot name=title />
    <slot name=content />
</div>

<style>
    span {
        float: right;
        font-size: 1.5em;
        font-weight: 600;
        color: #f44;
        text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
        cursor: pointer;
        margin: -5px -5px 0 0;
        padding: 5px;
    }

    .backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.3);
    }

    .modal {
        position: absolute;
        min-width: 90%;
        left: 50%;
        top: 20%;
        -webkit-transform: translate(-50%, 0);
        -moz-transform: translate(-50%, 0);
        -ms-transform: translate(-50%, 0);
        -o-transform: translate(-50%, 0);
        transform: translate(-50%, 0);
        background-color: #fff;
        padding: 5px 20px 20px 20px;
    }
    
    @media (min-width: 640px) {
        .modal {
            min-width: 70%;
        }
    }
</style>
