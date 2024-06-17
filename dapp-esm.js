const rpcUrlDefault = 'https://testnet.xian.org';

class XianWalletUtils {
    constructor(rpcUrl = rpcUrlDefault) {
        this.rpcUrl = rpcUrl;
        this.isWalletReady = false;
        this.walletReadyResolver = null;
        this.walletInfoResolver = null;
        this.transactionResolver = null;
    }

    init(rpcUrl) {
        if (rpcUrl) {
            this.rpcUrl = rpcUrl;
        }

        document.addEventListener('xianWalletInfo', event => {
            if (this.walletInfoResolver) {
                this.walletInfoResolver(event.detail);
                this.walletInfoResolver = null;
            }
        });

        document.addEventListener('xianWalletTxStatus', event => {
            if (this.transactionResolver) {
                if ('errors' in event.detail) {
                    this.transactionResolver(event.detail);
                    this.transactionResolver = null;
                    return;
                }
                this.getTxResultsAsyncBackoff(event.detail.txid).then(tx => {
                    let data = tx.result.tx_result.data;
                    let decodedData = window.atob(data);
                    let parsedData = JSON.parse(decodedData);
                    this.transactionResolver(parsedData);
                    this.transactionResolver = null;
                }).catch(error => {
                    console.error('Final error after retries:', error);
                    this.transactionResolver(null);
                });
            }
        });

        document.addEventListener('xianReady', () => {
            this.isWalletReady = true;
            if (this.walletReadyResolver) {
                this.walletReadyResolver();
                this.walletReadyResolver = null;
            }
            console.log('Xian Wallet is ready');
        });
    }

    waitForWalletReady() {
        return new Promise(resolve => {
            if (this.isWalletReady) {
                resolve();
            } else {
                this.walletReadyResolver = resolve;
                setTimeout(() => {
                    if (!this.isWalletReady) {
                        this.walletReadyResolver = null;
                        resolve();
                    }
                }, 2000);
            }
        });
    }

    async requestWalletInfo() {
        await this.waitForWalletReady();
        return new Promise((resolve, reject) => {
            this.walletInfoResolver = resolve;

            const timeoutId = setTimeout(() => {
                this.walletInfoResolver = null;
                reject(new Error('Xian Wallet Chrome extension not installed or not responding'));
            }, 2000);

            document.dispatchEvent(new CustomEvent('xianWalletGetInfo'));

            this.walletInfoResolver = (info) => {
                clearTimeout(timeoutId);
                resolve(info);
            };
        });
    }

    async sendTransaction(contract, method, kwargs) {
        await this.waitForWalletReady();
        return new Promise((resolve, reject) => {
            this.transactionResolver = resolve;
            document.dispatchEvent(new CustomEvent('xianWalletSendTx', {
                detail: {
                    contract: contract,
                    method: method,
                    kwargs: kwargs
                }
            }));

            const timeoutId = setTimeout(() => {
                this.transactionResolver = null;
                reject(new Error('Xian Wallet Chrome extension not responding'));
            }, 30000);

            this.transactionResolver = (txStatus) => {
                clearTimeout(timeoutId);
                resolve(txStatus);
            };
        });
    }

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
            throw error;
        }
    }

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
    }

    async getBalance(contract) {
        const info = await this.requestWalletInfo();
        const address = info.address;
        const balance = await this.getBalanceRequest(address, contract);
        return balance;
    }

    async getApprovedBalanceRequest(token_contract, address, approved_to) {
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
    }

    async getApprovedBalance(token_contract, approved_to) {
        const info = await this.requestWalletInfo();
        const address = info.address;
        const balance = await this.getApprovedBalanceRequest(token_contract, address, approved_to);
        return balance;
    }

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
}

export default XianWalletUtils;
