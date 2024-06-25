# XianWalletUtils

The `XianWalletUtils` JavaScript utility provides a simple interface for interacting with Xian wallet information and requesting transactions via custom events in a web environment.

## Overview

`XianWalletUtils` encapsulates the functionality needed to request wallet information and to send transactions using an event-driven approach. It is designed to work within applications that support custom event dispatching and listening, facilitating interaction with blockchain wallets.

## Installation

To use `XianWalletUtils`, simply include the JavaScript file in your project.

```html
<script src="path/to/dapp.js"></script>
```

## Initialization

Before using `XianWalletUtils`, it's important to initialize the utility to set up necessary event listeners. This ensures that the utility is ready to handle requests and responses appropriately.

```javascript
XianWalletUtils.init();
```

Or if you want to use another Node to get balance infos etc.

```javascript
XianWalletUtils.init("https://testnet.xian.org");
```

## Usage

### Requesting Wallet Information

To request wallet information, you can use the `requestWalletInfo` function. This function returns a promise that resolves with the wallet details.

```javascript
XianWalletUtils.requestWalletInfo()
    .then(info => {
        console.log('Wallet Address:', info.address);
        console.log('Is Locked:', info.locked);
        console.log('Chain ID:', info.chainId);
    })
    .catch(error => {
        console.error('Extension not installed');
    });
```

To get the balance of the wallet, you can use `getBalance` function with the contract of the token that you want to get the balance of. This function returns a promise that resolves with the wallet balance.

```javascript
XianWalletUtils.getBalance("currency")
    .then(balance => {
        console.log('Balance:', balance);
    })
    .catch(error => {
        console.error(error);
    });
```

To get the amount of approved tokens that a wallet has approved for another contract/address to spend, you can use `getApprovedBalance` function with the contract of the token that you want to get approved amount of and the address/contract the approval is meant for. This function returns a promise that resolves with the amount.

```javascript
XianWalletUtils.getApprovedBalance("currency", "con_multisend")
    .then(amount => {
        console.log('Approved Amount:', amount);
    })
    .catch(error => {
        console.error(error);
    });
```

### Sending Transactions

To send a transaction with detailed control over the transaction parameters, use the `sendTransaction` function. This function requires specifying the contract name, method name, kwargs. It returns a promise that resolves with the transaction result.

```javascript
XianWalletUtils.sendTransaction(
    "currency",            // contract name
    "transfer",            // method/function name
    {                      // kwargs (method arguments)
        "to": "wallet_address",
        "amount": 1000
    }
).then(result => {
    if (result.errors) {
        console.error('Transaction Errors:', result.errors);
    } else {
        console.log('Transaction Result:', result);
    }
});
```

### Sign Message

To request a wallet to sign a message, you can use the `signMessage` function. This function returns a promise that resolves with the signed msg.

```javascript
XianWalletUtils.signMessage("message")
    .then(response => {
        console.log('Signed Message', response.signature);
    })
    .catch(error => {
        console.error(error);
    });
```

## Contributing

Contributions to `XianWalletUtils` are welcome. Please ensure that you test your code and follow existing coding styles.
