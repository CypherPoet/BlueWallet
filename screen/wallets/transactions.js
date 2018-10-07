import React, { Component } from 'react';
import { Text, Button, View, Image, FlatList, RefreshControl } from 'react-native';
import PropTypes from 'prop-types';
import { LinearGradient } from 'expo';
import {
  WatchOnlyWallet,
  HDLegacyBreadwalletWallet,
  HDSegwitP2SHWallet,
  LightningCustodianWallet,
  LegacyWallet,
  HDLegacyP2PKHWallet,
} from '../../class';
import {
  BlueTransactionOnchainIcon,
  ManageFundsBigButton,
  BlueTransactionIncommingIcon,
  BlueTransactionOutgoingIcon,
  BlueTransactionPendingIcon,
  BlueTransactionOffchainIcon,
  BlueSendButtonIcon,
  BlueReceiveButtonIcon,
  BlueList,
  BlueListItem,
} from '../../BlueComponents';
/** @type {AppStorage} */
let BlueApp = require('../../BlueApp');
let loc = require('../../loc');
const BigNumber = require('bignumber.js');
let EV = require('../../events');
let A = require('../../analytics');

export default class Transactions extends Component {
  static navigationOptions = ({ navigation }) => {
    return {
      headerRight: (
        <Button
          onPress={() =>
            navigation.navigate('WalletDetails', {
              address: navigation.state.params.wallet.getAddress(),
              secret: navigation.state.params.wallet.getSecret(),
            })
          }
          title={loc.wallets.options}
          color="#fff"
        />
      ),
      headerStyle: {
        backgroundColor: navigation.state.params.headerColor,
        borderBottomWidth: 0,
      },
      headerTintColor: '#FFFFFF',
    };
  };

  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      isTransactionsLoading: false,
      wallet: props.navigation.getParam('wallet'),
      gradientColors: ['#FFFFFF', '#FFFFFF'],
      dataSource: props.navigation.getParam('wallet').getTransactions(),
    };
    EV(EV.enum.WALLETS_COUNT_CHANGED, this.refreshFunction.bind(this));
    EV(EV.enum.TRANSACTIONS_COUNT_CHANGED, this.refreshTransactions.bind(this));
  }

  async componentDidMount() {
    this.refreshFunction();
    let gradient1 = '#65ceef';
    let gradient2 = '#68bbe1';

    if (new WatchOnlyWallet().type === this.state.wallet.type) {
      gradient1 = '#7d7d7d';
      gradient2 = '#4a4a4a';
    }

    if (new LegacyWallet().type === this.state.wallet.type) {
      gradient1 = '#40fad1';
      gradient2 = '#15be98';
    }

    if (new HDLegacyP2PKHWallet().type === this.state.wallet.type) {
      gradient1 = '#e36dfa';
      gradient2 = '#bd10e0';
    }

    if (new HDLegacyBreadwalletWallet().type === this.state.wallet.type) {
      gradient1 = '#fe6381';
      gradient2 = '#f99c42';
    }

    if (new HDSegwitP2SHWallet().type === this.state.wallet.type) {
      gradient1 = '#c65afb';
      gradient2 = '#9053fe';
    }

    if (new LightningCustodianWallet().type === this.state.wallet.type) {
      gradient1 = '#f1be07';
      gradient2 = '#f79056';
    }

    this.props.navigation.setParams({ headerColor: gradient1, wallet: this.state.wallet });
    this.setState({ gradientColors: [gradient1, gradient2] });
  }

  refreshFunction() {
    if (BlueApp.getBalance() !== 0) {
      A(A.ENUM.GOT_NONZERO_BALANCE);
    }

    setTimeout(() => {
      console.log('refreshFunction()');
      let showSend = false;
      let showReceive = false;
      const wallet = this.state.wallet;
      if (wallet) {
        showSend = wallet.allowSend();
        showReceive = wallet.allowReceive();
      }

      this.setState({
        isLoading: false,
        isTransactionsLoading: false,
        showReceiveButton: showReceive,
        showSendButton: showSend,
        showManageFundsBigButton: wallet && wallet.type === new LightningCustodianWallet().type,
        dataSource: wallet.getTransactions(),
      });
    }, 1);
  }

  isLightning() {
    let w = this.state.wallet;
    if (w && w.type === new LightningCustodianWallet().type) {
      return true;
    }

    return false;
  }

  /**
   * Forcefully fetches TXs and balance for lastSnappedTo (i.e. current) wallet
   */
  refreshTransactions() {
    this.setState(
      {
        isTransactionsLoading: true,
      },
      async function() {
        let that = this;
        setTimeout(async function() {
          // more responsive
          let noErr = true;
          try {
            await BlueApp.fetchWalletBalances(that.lastSnappedTo || 0);
            let start = +new Date();
            await BlueApp.fetchWalletTransactions(that.lastSnappedTo || 0);
            let end = +new Date();
            console.log('tx took', (end - start) / 1000, 'sec');
          } catch (err) {
            noErr = false;
            console.warn(err);
          }
          if (noErr) await BlueApp.saveToDisk(); // caching

          that.refreshFunction();
        }, 1);
      },
    );
  }

  renderWalletHeader = () => {
    return (
      <LinearGradient colors={[this.state.gradientColors[0], this.state.gradientColors[1]]} style={{ padding: 15, height: 164 }}>
        <Image
          source={
            (new LightningCustodianWallet().type === this.state.wallet.type && require('../../img/lnd-shape.png')) ||
            require('../../img/btc-shape.png')
          }
          style={{
            width: 99,
            height: 94,
            position: 'absolute',
            bottom: 0,
            right: 0,
          }}
        />

        <Text style={{ backgroundColor: 'transparent' }} />
        <Text
          numberOfLines={1}
          style={{
            backgroundColor: 'transparent',
            fontSize: 19,
            color: '#fff',
          }}
        >
          {this.state.wallet.getLabel()}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            backgroundColor: 'transparent',
            fontWeight: 'bold',
            fontSize: 36,
            color: '#fff',
          }}
        >
          {loc.formatBalance(this.state.wallet.getBalance())}
        </Text>
        <Text style={{ backgroundColor: 'transparent' }} />
        <Text
          numberOfLines={1}
          style={{
            backgroundColor: 'transparent',
            fontSize: 13,
            color: '#fff',
          }}
        >
          {loc.wallets.list.latest_transaction}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            backgroundColor: 'transparent',
            fontWeight: 'bold',
            fontSize: 16,
            color: '#fff',
          }}
        >
          {loc.transactionTimeToReadable(this.state.wallet.getLatestTransactionTime())}
        </Text>
      </LinearGradient>
    );
  };

  txMemo(hash) {
    if (BlueApp.tx_metadata[hash] && BlueApp.tx_metadata[hash]['memo']) {
      return BlueApp.tx_metadata[hash]['memo'];
    }
    return '';
  }

  _keyExtractor = (item, index) => index.toString();

  renderListHeaderComponent = () => {
    return (
      <View style={{ flexDirection: 'row', height: 50 }}>
        <Text
          style={{
            paddingLeft: 15,
            paddingTop: 15,
            fontWeight: 'bold',
            fontSize: 24,
            color: BlueApp.settings.foregroundColor,
          }}
        >
          {loc.transactions.list.title}
        </Text>
      </View>
    );
  };

  render() {
    const { navigate } = this.props.navigation;
    return (
      <View style={{ flex: 1 }}>
        {this.renderWalletHeader()}
        <View>
          {(() => {
            if (BlueApp.getTransactions(this.lastSnappedTo || 0).length === 0) {
              return (
                <View>
                  <Text
                    style={{
                      fontSize: 18,
                      color: '#9aa0aa',
                      textAlign: 'center',
                    }}
                  >
                    {(this.isLightning() &&
                      'Lightning wallet should be used for your daily\ntransactions. Fees are unfairly cheap and\nspeed is blazing fast.') ||
                      loc.wallets.list.empty_txs1}
                  </Text>
                  <Text
                    style={{
                      fontSize: 18,
                      color: '#9aa0aa',
                      textAlign: 'center',
                    }}
                  >
                    {(this.isLightning() && '\nTo start using it tap on "manage funds"\nand topup your balance') ||
                      loc.wallets.list.empty_txs2}
                  </Text>
                </View>
              );
            }
          })()}
        </View>

        <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
          <BlueList>
            <FlatList
              style={{ flex: 1 }}
              ListHeaderComponent={this.renderListHeaderComponent}
              refreshControl={<RefreshControl onRefresh={() => this.refreshTransactions()} refreshing={this.state.isTransactionsLoading} />}
              data={this.state.dataSource}
              extraData={this.state.dataSource}
              keyExtractor={this._keyExtractor}
              renderItem={rowData => {
                return (
                  <BlueListItem
                    avatar={(() => {
                      // is it lightning refill tx?
                      if (rowData.item.category === 'receive' && rowData.item.confirmations < 3) {
                        return (
                          <View style={{ width: 25 }}>
                            <BlueTransactionPendingIcon />
                          </View>
                        );
                      }

                      if (rowData.item.type && rowData.item.type === 'bitcoind_tx') {
                        return (
                          <View style={{ width: 25 }}>
                            <BlueTransactionOnchainIcon />
                          </View>
                        );
                      }
                      if (rowData.item.type === 'paid_invoice') {
                        // is it lightning offchain payment?
                        return (
                          <View style={{ width: 25 }}>
                            <BlueTransactionOffchainIcon />
                          </View>
                        );
                      }

                      if (!rowData.item.confirmations) {
                        return (
                          <View style={{ width: 25 }}>
                            <BlueTransactionPendingIcon />
                          </View>
                        );
                      } else if (rowData.item.value < 0) {
                        return (
                          <View style={{ width: 25 }}>
                            <BlueTransactionOutgoingIcon />
                          </View>
                        );
                      } else {
                        return (
                          <View style={{ width: 25 }}>
                            <BlueTransactionIncommingIcon />
                          </View>
                        );
                      }
                    })()}
                    title={loc.transactionTimeToReadable(rowData.item.received)}
                    subtitle={
                      (rowData.item.confirmations < 7 ? loc.transactions.list.conf + ': ' + rowData.item.confirmations + ' ' : '') +
                      this.txMemo(rowData.item.hash) +
                      (rowData.item.memo || '')
                    }
                    onPress={() => {
                      if (rowData.item.hash) {
                        navigate('TransactionDetails', {
                          hash: rowData.item.hash,
                        });
                      }
                    }}
                    badge={{
                      value: 3,
                      textStyle: { color: 'orange' },
                      containerStyle: { marginTop: 0 },
                    }}
                    hideChevron
                    rightTitle={new BigNumber((rowData.item.value && rowData.item.value) || 0).div(100000000).toString()}
                    rightTitleStyle={{
                      fontWeight: '600',
                      fontSize: 16,
                      color: rowData.item.value / 100000000 < 0 ? BlueApp.settings.foregroundColor : '#37c0a1',
                    }}
                  />
                );
              }}
            />
          </BlueList>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignSelf: 'center',
            backgroundColor: 'transparent',
            position: 'absolute',
            bottom: 30,
            borderRadius: 15,
            overflow: 'hidden',
          }}
        >
          {(() => {
            if (this.state.showReceiveButton) {
              return (
                <BlueReceiveButtonIcon
                  onPress={() => {
                    navigate('ReceiveDetails', { address: this.state.wallet.getAddress(), secret: this.state.wallet.getSecret() });
                    if (this.state.wallet.getAddress()) {
                      // EV(EV.enum.RECEIVE_ADDRESS_CHANGED, w.getAddress());
                    }
                  }}
                />
              );
            }
          })()}

          {(() => {
            if (this.state.showSendButton) {
              return (
                <BlueSendButtonIcon
                  onPress={() => {
                    if (this.state.wallet.type === new LightningCustodianWallet().type) {
                      navigate('ScanLndInvoice', { fromSecret: this.state.wallet.getSecret() });
                    } else {
                      navigate('SendDetails', { fromAddress: this.state.wallet.getAddress(), fromSecret: this.state.wallet.getSecret() });
                    }
                  }}
                />
              );
            }
          })()}

          {(() => {
            if (this.state.showManageFundsBigButton) {
              return (
                <ManageFundsBigButton
                  onPress={() => {
                    navigate('ManageFunds', { fromSecret: this.state.wallet.getSecret() });
                  }}
                />
              );
            }
          })()}
        </View>
      </View>
    );
  }
}

Transactions.propTypes = {
  navigation: PropTypes.shape({
    navigate: PropTypes.func,
    goBack: PropTypes.func,
    getParam: PropTypes.func,
    setParams: PropTypes.func,
  }),
};