const XianWalletUtils = {
    // Initialize listeners to resolve promises
    init: function() {
        document.addEventListener('xianWalletInfo', event => {
            if (this.walletInfoResolver) {
                this.walletInfoResolver(event.detail);
                this.walletInfoResolver = null; // Reset the resolver after use
            }
        });

        document.addEventListener('xianWalletTxStatus', event => {
            if (this.transactionResolver) {
                this.transactionResolver(event.detail);
                this.transactionResolver = null; // Reset the resolver after use
            }
        });
    },

    // Request wallet information and return a promise that resolves with the info
    requestWalletInfo: function() {
        return new Promise((resolve, reject) => {
            this.walletInfoResolver = resolve; // Store the resolver to use in the event listener
            document.dispatchEvent(new CustomEvent('xianWalletGetInfo'));
        });
    },

    // Send a transaction with detailed parameters and return a promise that resolves with the transaction status
    sendTransaction: function(contract, method, kwargs, stampLimit = 30) {
        return new Promise((resolve, reject) => {
            this.transactionResolver = resolve; // Store the resolver to use in the event listener
            document.dispatchEvent(new CustomEvent('xianWalletSendTx', {
                detail: {
                    contract: contract,
                    method: method,
                    kwargs: kwargs,
                    stampLimit: stampLimit
                }
            }));
        });
    }
};
