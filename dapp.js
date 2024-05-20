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

            // Set a timeout to reject the promise if it does not resolve within a certain timeframe
            const timeoutId = setTimeout(() => {
                this.walletInfoResolver = null; // Clear the resolver
                reject(new Error('Xian Wallet Chrome extension not installed or not responding'));
            }, 2000); // 2 seconds timeout

            // Dispatch the event to request wallet info
            document.dispatchEvent(new CustomEvent('xianWalletGetInfo'));
         
            // Wrap the original resolve to clear the timeout when resolved
            this.walletInfoResolver = (info) => {
                clearTimeout(timeoutId);
                resolve(info);
            };
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
