export const XianWalletUtils = {
    rpcUrl: 'https://testnet.xian.org', // Default RPC URL

    // Initialize listeners to resolve promises and set RPC URL
    init(rpcUrl) {
        if (rpcUrl) {
            this.rpcUrl = rpcUrl;
        }

        document.addEventListener('xianWalletInfo', event => {
            if (this.walletInfoResolver) {
                this.walletInfoResolver(event.detail);
                this.walletInfoResolver = null; // Reset the resolver after use
            }
        });

        document.addEventListener('xianWalletTxStatus', event => {
            if (this.transactionResolver) {
                if ('errors' in event.detail) {
                    this.transactionResolver(event.detail);
                    this.transactionResolver = null; // Reset the resolver after use
                    return;
                }
                this.getTxResultsAsyncBackoff(event.detail.txid).then(tx => {
                    let data = tx.result.tx_result.data;
                    let decodedData = window.atob(data);
                    let parsedData = JSON.parse(decodedData);
                    this.transactionResolver(parsedData);
                    this.transactionResolver = null; // Reset the resolver after use
                }).catch(error => {
                    console.error('Final error after retries:', error);
                    this.transactionResolver(null);
                });
            }
        });
    },

    // Request wallet information and return a promise that resolves with the info
    requestWalletInfo() {
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
    sendTransaction(contract, method, kwargs) {
        return new Promise((resolve, reject) => {
            this.transactionResolver = resolve; // Store the resolver to use in the event listener
            document.dispatchEvent(new CustomEvent('xianWalletSendTx', {
                detail: {
                    contract: contract,
                    method: method,
                    kwargs: kwargs
                }
            }));
        });
    },

    async getBalanceRequest(address, contract) {
        const response = await fetch(`${this.rpcUrl}/abci_query?path=%22/get/${contract}.balances:${address}%22`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        let balance = data.result.response.value;
        if (balance === 'AA==') {
            return 0;
        }
        let decodedBalance = window.atob(balance);
        return decodedBalance;
    },

    async getBalance(contract) {
        const info = await this.requestWalletInfo();
        const address = info.address;
        const balance = await this.getBalanceRequest(address, contract);
        return balance;
    },

    async getTxResults(txHash) {
        try {
            const response = await fetch(`${this.rpcUrl}/tx?hash=0x${txHash}`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.log('Transaction not found yet');
            throw error; // Rethrow the error to trigger retries
        }
    },

    async getTxResultsAsyncBackoff(txHash, retries = 5, delay = 1000) {
        try {
            return await this.getTxResults(txHash);
        } catch (error) {
            if (retries === 0) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            return await this.getTxResultsAsyncBackoff(txHash, retries - 1, delay * 2);
        }
    }
};
