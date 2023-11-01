import User from './user';

var TransactionModel = {
    _transactions: [],
    watchingTransactions: false,
    transactionFeedBackDelay: "",
    handleTransactionFeedback: function(record) {

        if (TransactionModel.transactionFeedBackDelay) clearTimeout(TransactionModel.transactionFeedBackDelay);
        TransactionModel.transactionFeedBackDelay = setTimeout(function() {
            coinSound.play()
            if (browserIsMobile()) {
                if (window.navigator && window.navigator.vibrate) {
                    window.navigator.vibrate([100, 25, 100, 25, 100, 25]);
                }

            }

            M.toast({ html: TransactionModel.formatSnackBarMessage(record), displayLength: 2000 })
        }, 1000)
    },
    save: function(tx, record, feedback) {

        DB.txs.add(tx).then(function() {
            if (feedback) TransactionModel._transactions.unshift(tx);
            localStorage.setItem("lastPaymentCursor", record.paging_token);
            if (TransactionModel.watching = true && feedback) TransactionModel.handleTransactionFeedback(record);
            m.redraw();
        }).catch(function(err) {
            if (err.name === "ConstraintError") {
                return DB.txs.update(record.transaction_hash, tx);
            }
        })

        this.getLocalTransactions()
    },
    transactions: function() {
        return this._transactions;
    },
    addTransactions: function(transactions) {
        TransactionModel._transactions = transactions;
        m.redraw();

    },
    getLocalTransactions: function() {
        return DB.txs.toArray().then(this.addTransactions);
    },
    buildTransaction: function(record, feedback) {
        if (!record) return;

        let txobj = {};
        let newTx = new TransactionModel.tx(record, User.privateKey);
        newTx.getCounterPartyCoinIdByAccount(record)
            .then(newTx.setCounterpartyCoinId)
            .then(newTx.setMemo)
            .then(function(tx) {
                TransactionModel.save(tx, record, feedback);
            }).catch(function(e) {
                console.error(e);
            });

    },
    formatSnackBarMessage: function(record) {

        let amount = record.amount || record.starting_balance || localStorage.lastWalletBalance;
        if (record.type == "account_merge") {
            if (record.into === User.accountAddress())
                return returnMessage('Received')
            else
                return returnMessage('Sent')
        } else if (record.type === "create_account") {
            if (record.account === User.accountAddress())
                return returnMessage('Received')
            else
                return returnMessage('Sent')

        } else {

            if (record.to === User.accountAddress())
                return returnMessage('Received')
            else
                return returnMessage('Sent')
        }

        function returnMessage(type){
            return `${type} ${User.formatAmount(User.formatToGarvey(amount, User.currentDenomination.abbr))}ç`;
        }

    },
    tx: function(record, details) {
        let self = this;
        this.userSecret = new Wallet.getWallet(details).stellar().s;
        this.counterParty = record.to == User.accountAddress() ? record.from : record.to;
        this.record = record;
        this.tx = {}
        this.tx.type = record.to == User.accountAddress() ? "received" : "sent";
        this.tx.to = {
            account: record.to,
            coinId: record.to == User.accountAddress() ? User.displayName() : ""
        }
        this.tx.hash = record.transaction_hash;
        this.tx.from = {
            account: record.from,
            coinId: record.from == User.accountAddress() ? User.displayName() : ""
        }
        if (record.type == "create_account") {
            if (record.account === User.accountAddress()) {
                this.tx.from.account = record.source_account;
                this.tx.to.account = record.account;
                this.counterParty = record.source_account;
                this.tx.type = "received";
            } else {
                this.tx.to.account = record.account;
                this.tx.from.account = record.source_account;
                this.counterParty = record.account;
                this.tx.type = "sent";
            }
        }
        if (record.type == "account_merge") {
            if (record.account === User.accountAddress()) {
                this.tx.from.account = record.account;
                this.tx.to.account = record.into;
                this.counterParty = record.into;
                this.tx.type = "sent";
            } else {
                this.tx.to.account = record.into;
                this.tx.from.account = record.account;
                this.counterParty = record.account;
                this.tx.type = "received";
            }
        }


        this.setCounterpartyCoinId = function(account) {
            if (self.tx.type == "received")
                self.tx.from.coinId = account.coinId || self.counterParty;
            else
                self.tx.to.coinId = account.coinId || self.counterParty;
            return self;
        }
        let timeStamp = new Date(record.created_at);
        this.tx.date = timeStamp.getTime();
        this.tx.formatDate = timeStamp.toLocaleString('en-US');
        this.tx.amount = record.amount || record.starting_balance;
        this.tx.memo = "";
        this.getCounterPartyCoinIdByAccount = function(record) {

            var cpAccount = self.counterParty;
            if (record.type == "account_merge") {
                record.succeeds().then(function(result) {
                    self.tx.amount = result.records[1].amount;
                    localStorage.setItem('lastWalletBalance', result.records[1].amount)
                }).catch(function(e) {
                    console.log(e);
                })
            }


            return new Promise(function(resolve, reject) {
                //Check local first
                DB.contacts.get(cpAccount).then(function(account) {
                    if (!account) return checkRemote();
                    if (account.photoURL) User.picMap[account.account] = account.photoURL;
                    //update cached
                    if (new Date().getTime() - account.lastPulled > 86400 * 2) return checkRemote();
                    return resolve(account)
                }).catch(function(e) {
                    console.error(e);
                    return checkRemote()
                })
                //check remote
                function checkRemote() {
                    return User.getUserByAccount(cpAccount).then(function(account) {
                        account.lastPulled = new Date().getTime();
                        DB.contacts.add(account).then(function(accountId) {
                            if (account.photoURL) User.picMap[account.account] = account.photoURL;
                            return resolve(account);
                        }).catch(function(err) {
                            if (err.name === "ConstraintError") {
                                if (account.photoURL) User.picMap[account.account] = account.photoURL;
                                DB.contacts.update(cpAccount, account);
                                resolve(account);
                            }
                        });
                    }).catch(function(e) {
                        console.log(e);
                        resolve({ coinId: cpAccount, account: cpAccount })
                    });
                }

            })

        }

        this.setMemo = function() {

            return record.transaction()
                .then(function(txn) {
                    let memo = txn.memo;
                    if (!memo) { self.tx.memo = ""; return self.tx; }
                    try {
                        self.tx.memo = PAYLOAD.decryptMemo(memo, self.counterParty, self.userSecret, true);
                    } catch (e) {
                        console.log(e);
                        self.tx.memo = memo;
                    }

                    return self.tx;
                });


        }

        return this;
    }
}

export default TransactionModel;