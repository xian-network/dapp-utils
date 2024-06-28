const XianWalletUtils = {
    rpcUrl: 'https://testnet.xian.org', // Default RPC URL
    isWalletReady: false,
    initialized: false,
    state: {
        walletReady: {
            isReady: false,
            resolver: null,
        },
        walletInfo: {
            resolver: null,
        },
        signMessage: {
            resolver: null,
        },
        transaction: {
            resolver: null,
        },
    },

    // Initialize listeners to resolve promises and set RPC URL
    init: function(rpcUrl) {
        if (this.initialized) {
            console.warn('XianWalletUtils is already initialized. Avoiding re-initialization.');
            return;
        }
        
        if (rpcUrl) {
            this.rpcUrl = rpcUrl;
        }

        document.addEventListener('xianWalletInfo', event => {
            if (this.state.walletInfo.resolver) {
                this.state.walletInfo.resolver(event.detail);
                this.state.walletInfo.resolver = null; // Reset the resolver after use
            }
        });

        document.addEventListener('xianWalletSignMsgResponse', event => {
            if (this.state.signMessage.resolver) {
                this.state.signMessage.resolver(event.detail);
                this.state.signMessage.resolver = null; // Reset the resolver after use
            }
        });

        document.addEventListener('xianWalletTxStatus', event => {
            if (this.state.transaction.resolver) {
                if ('errors' in event.detail) {
                    this.state.transaction.resolver(event.detail);
                } else {
                    this.getTxResultsAsyncBackoff(event.detail.txid).then(tx => {
                        let data = tx.result.tx_result.data;
                        let original_tx = tx.result.tx;
                        let decodedData = window.atob(data);
                        let decodedOriginalTx = window.atob(original_tx);
                        let parsedData = JSON.parse(decodedData);
                        parsedData.original_tx = JSON.parse(this.hexToString(decodedOriginalTx));
                        this.state.transaction.resolver(parsedData);
                    }).catch(error => {
                        console.error('Final error after retries:', error);
                        this.state.transaction.resolver(null);
                    }).finally(() => {
                        this.state.transaction.resolver = null; // Reset the resolver after use
                    });
                }
            }
        });

        document.addEventListener('xianReady', () => {
            this.isWalletReady = true;
            if (this.state.walletReady.resolver) {
                this.state.walletReady.resolver();
                this.state.walletReady.resolver = null; // Reset the resolver after use
            }
            console.log('Xian Wallet is ready');
        });

        this.initialized = true; // Mark as initialized
    },

    waitForWalletReady: function() {
        return new Promise(resolve => {
            if (this.isWalletReady) {
                resolve();
            } else {
                this.state.walletReady.resolver = resolve;
                setTimeout(() => {
                    if (!this.isWalletReady) {
                        this.state.walletReady.resolver = null; // Clear the resolver
                        resolve(); // Resolve anyway to not block the flow
                    }
                }, 2000); // 2 seconds timeout
            }
        });
    },

    requestWalletInfo: async function() {
        await this.waitForWalletReady();
        return new Promise((resolve, reject) => {
            this.state.walletInfo.resolver = resolve;

            const timeoutId = setTimeout(() => {
                this.state.walletInfo.resolver = null; // Clear the resolver
                reject(new Error('Xian Wallet Chrome extension not installed or not responding'));
            }, 2000); // 2 seconds timeout

            document.dispatchEvent(new CustomEvent('xianWalletGetInfo'));

            this.state.walletInfo.resolver = (info) => {
                clearTimeout(timeoutId);
                resolve(info);
                this.state.walletInfo.resolver = null; // Reset the resolver after use
            };
        });
    },

    signMessage: async function(message) {
        await this.waitForWalletReady();
        return new Promise((resolve, reject) => {
            this.state.signMessage.resolver = resolve;

            const timeoutId = setTimeout(() => {
                this.state.signMessage.resolver = null; // Clear the resolver
                reject(new Error('Xian Wallet Chrome extension not responding'));
            }, 30000); // 30 seconds timeout, this requires manual confirmation
            
            document.dispatchEvent(new CustomEvent('xianWalletSignMsg', {
                detail: {
                    message: message
                }
            }));

            this.state.signMessage.resolver = (signature) => {
                clearTimeout(timeoutId);
                resolve(signature);
                this.state.signMessage.resolver = null; // Reset the resolver after use
            };
        });
    },

    sendTransaction: async function(contract, method, kwargs) {
        await this.waitForWalletReady();
        return new Promise((resolve, reject) => {
            this.state.transaction.resolver = resolve;

            const timeoutId = setTimeout(() => {
                this.state.transaction.resolver = null; // Clear the resolver
                reject(new Error('Xian Wallet Chrome extension not responding'));
            }, 30000); // 30 seconds timeout, this requires manual confirmation

            document.dispatchEvent(new CustomEvent('xianWalletSendTx', {
                detail: {
                    contract: contract,
                    method: method,
                    kwargs: kwargs
                }
            }));

            // Do not reset the resolver here; reset it only when resolving or rejecting
        });
    },

    getTxResults: async function(txHash) {
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

    getBalanceRequest: async function(address, contract) {
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

    getBalance: async function(contract) {
        const info = await this.requestWalletInfo();
        const address = info.address;
        const balance = await this.getBalanceRequest(address, contract);
        return balance;
    },

    getApprovedBalanceRequest: async function(token_contract, address, approved_to) {
        const response = await fetch(`${this.rpcUrl}/abci_query?path=%22/get/${token_contract}.balances:${address}:${approved_to}%22`);
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

    getApprovedBalance: async function(token_contract, approved_to) {
        const info = await this.requestWalletInfo();
        const address = info.address;
        const balance = await this.getApprovedBalanceRequest(token_contract, address, approved_to);
        return balance;
    },

    getTxResultsAsyncBackoff: async function(txHash, retries = 5, delay = 1000) {
        try {
            return await this.getTxResults(txHash);
        } catch (error) {
            if (retries === 0) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            return await this.getTxResultsAsyncBackoff(txHash, retries - 1, delay * 2);
        }
    },

    hexToString: function(hex) {
        let bytes = [];
        for (let i = 0; i < hex.length; i += 2) {
            bytes.push(parseInt(hex.substr(i, 2), 16));
        }
        return String.fromCharCode.apply(String, bytes);
    },
};
export default XianWalletUtils;
