/* global alert */
import React, { Component } from 'react';
import {
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  View,
  Dimensions,
  Image,
  TextInput,
  Linking,
  Platform,
  Text,
  PermissionsAndroid,
  StyleSheet,
} from 'react-native';
import Clipboard from '@react-native-community/clipboard';
import {
  BlueButton,
  SecondButton,
  BlueText,
  SafeBlueArea,
  BlueCard,
  BlueNavigationStyle,
  BlueSpacing20,
  BlueCopyToClipboardButton,
  BlueBigCheckmark,
  DynamicQRCode,
} from '../../BlueComponents';
import PropTypes from 'prop-types';
import Share from 'react-native-share';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { RNCamera } from 'react-native-camera';
import RNFS from 'react-native-fs';
import DocumentPicker from 'react-native-document-picker';
import { decodeUR, extractSingleWorkload } from 'bc-ur/dist';
import { Psbt } from 'bitcoinjs-lib';
import loc from '../../loc';
import { BlueCurrentTheme } from '../../components/themes';
const EV = require('../../blue_modules/events');
const BlueElectrum = require('../../blue_modules/BlueElectrum');
/** @type {AppStorage} */
const BlueApp = require('../../BlueApp');
const bitcoin = require('bitcoinjs-lib');
const { height, width } = Dimensions.get('window');

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BlueCurrentTheme.colors.elevated,
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 16,
  },
  rootCamera: {
    flex: 1,
    justifyContent: 'space-between',
  },
  rootPadding: {
    flex: 1,
    paddingTop: 20,
  },
  closeCamera: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    borderRadius: 20,
    position: 'absolute',
    right: 16,
    top: 64,
  },
  closeCameraImage: {
    alignSelf: 'center',
  },
  blueBigCheckmark: {
    marginTop: 143,
    marginBottom: 53,
  },
  hexWrap: {
    alignItems: 'center',
    flex: 1,
  },
  hexLabel: {
    color: BlueCurrentTheme.colors.foregroundColor,
    fontWeight: '500',
  },
  hexInput: {
    borderColor: BlueCurrentTheme.colors.formBorder,
    backgroundColor: BlueCurrentTheme.colors.inputBackgroundColor,
    borderRadius: 4,
    marginTop: 20,
    color: BlueCurrentTheme.colors.foregroundColor,
    fontWeight: '500',
    fontSize: 14,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 16,
  },
  hexTouch: {
    marginVertical: 24,
  },
  hexText: {
    color: BlueCurrentTheme.colors.foregroundColor,
    fontSize: 15,
    fontWeight: '500',
    alignSelf: 'center',
  },
  copyToClipboard: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default class PsbtWithHardwareWallet extends Component {
  cameraRef = null;

  _onReadUniformResource = ur => {
    try {
      const [index, total] = extractSingleWorkload(ur);
      const { animatedQRCodeData } = this.state;
      if (animatedQRCodeData.length > 0) {
        const currentTotal = animatedQRCodeData[0].total;
        if (total !== currentTotal) {
          alert('invalid animated QRCode');
          this.setState({ renderScanner: false });
        }
      }
      if (!animatedQRCodeData.find(i => i.index === index)) {
        this.setState(
          state => ({
            animatedQRCodeData: [
              ...state.animatedQRCodeData,
              {
                index,
                total,
                data: ur,
              },
            ],
          }),
          () => {
            if (this.state.animatedQRCodeData.length === total) {
              this.setState(
                {
                  renderScanner: false,
                },
                () => {
                  const payload = decodeUR(this.state.animatedQRCodeData.map(i => i.data));
                  const psbtB64 = Buffer.from(payload, 'hex').toString('base64');
                  const psbt = Psbt.fromBase64(psbtB64);
                  this.setState({ txhex: psbt.extractTransaction().toHex() });
                },
              );
            }
          },
        );
      }
    } catch (Err) {
      alert('invalid animated QRCode fragment, please try again');
    }
  };

  _combinePSBT = receivedPSBT => {
    return this.state.fromWallet.combinePsbt(
      this.state.isFirstPSBTAlreadyBase64 ? this.state.psbt : this.state.psbt.toBase64(),
      receivedPSBT,
    );
  };

  onBarCodeRead = ret => {
    if (RNCamera.Constants.CameraStatus === RNCamera.Constants.CameraStatus.READY) this.cameraRef.pausePreview();
    if (ret.data.toUpperCase().startsWith('UR')) {
      return this._onReadUniformResource(ret.data);
    }
    if (ret.data.indexOf('+') === -1 && ret.data.indexOf('=') === -1 && ret.data.indexOf('=') === -1) {
      // this looks like NOT base64, so maybe its transaction's hex
      this.setState({ renderScanner: false, txhex: ret.data });
      return;
    }

    this.setState({ renderScanner: false }, () => {
      try {
        const Tx = this._combinePSBT(ret.data);
        this.setState({ txhex: Tx.toHex() });
      } catch (Err) {
        alert(Err);
      }
    });
  };

  constructor(props) {
    super(props);
    this.state = {
      isLoading: false,
      renderScanner: false,
      qrCodeHeight: height > width ? width - 40 : width / 3,
      memo: props.route.params.memo,
      psbt: props.route.params.psbt,
      fromWallet: props.route.params.fromWallet,
      isFirstPSBTAlreadyBase64: props.route.params.isFirstPSBTAlreadyBase64,
      isSecondPSBTAlreadyBase64: false,
      deepLinkPSBT: undefined,
      txhex: props.route.params.txhex || undefined,
      animatedQRCodeData: [],
    };
    this.fileName = `${Date.now()}.psbt`;
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    const deepLinkPSBT = nextProps.route.params.deepLinkPSBT;
    const txhex = nextProps.route.params.txhex;
    if (deepLinkPSBT) {
      try {
        const Tx = prevState.fromWallet.combinePsbt(
          prevState.isFirstPSBTAlreadyBase64 ? prevState.psbt : prevState.psbt.toBase64(),
          deepLinkPSBT,
        );
        return {
          ...prevState,
          txhex: Tx.toHex(),
        };
      } catch (Err) {
        alert(Err);
      }
    } else if (txhex) {
      return {
        ...prevState,
        txhex: txhex,
      };
    }
    return prevState;
  }

  componentDidMount() {
    console.log('send/psbtWithHardwareWallet - componentDidMount');
  }

  broadcast = () => {
    this.setState({ isLoading: true }, async () => {
      try {
        await BlueElectrum.ping();
        await BlueElectrum.waitTillConnected();
        const result = await this.state.fromWallet.broadcastTx(this.state.txhex);
        if (result) {
          EV(EV.enum.REMOTE_TRANSACTIONS_COUNT_CHANGED); // someone should fetch txs
          this.setState({ success: true, isLoading: false });
          if (this.state.memo) {
            const txDecoded = bitcoin.Transaction.fromHex(this.state.txhex);
            const txid = txDecoded.getId();
            BlueApp.tx_metadata[txid] = { memo: this.state.memo };
          }
        } else {
          ReactNativeHapticFeedback.trigger('notificationError', { ignoreAndroidSystemSettings: false });
          this.setState({ isLoading: false });
          alert(loc.errors.broadcast);
        }
      } catch (error) {
        ReactNativeHapticFeedback.trigger('notificationError', { ignoreAndroidSystemSettings: false });
        this.setState({ isLoading: false });
        alert(error.message);
      }
    });
  };

  _renderScanner() {
    return (
      <SafeBlueArea style={styles.root}>
        <RNCamera
          captureAudio={false}
          androidCameraPermissionOptions={{
            title: loc.send.permission_camera_title,
            message: loc.send.permission_camera_message,
            buttonPositive: loc._.ok,
            buttonNegative: loc._.cancel,
          }}
          ref={ref => (this.cameraRef = ref)}
          style={styles.rootCamera}
          onBarCodeRead={this.onBarCodeRead}
          barCodeTypes={[RNCamera.Constants.BarCodeType.qr]}
        />
        <TouchableOpacity style={styles.closeCamera} onPress={() => this.setState({ renderScanner: false })}>
          <Image style={styles.closeCameraImage} source={require('../../img/close-white.png')} />
        </TouchableOpacity>
      </SafeBlueArea>
    );
  }

  _renderSuccess() {
    return (
      <SafeBlueArea style={styles.root}>
        <BlueBigCheckmark style={styles.blueBigCheckmark} />
        <BlueCard>
          <BlueButton onPress={() => this.props.navigation.dangerouslyGetParent().pop()} title={loc.send.success_done} />
        </BlueCard>
      </SafeBlueArea>
    );
  }

  _renderBroadcastHex() {
    return (
      <View style={styles.rootPadding}>
        <BlueCard style={styles.hexWrap}>
          <BlueText style={styles.hexLabel}>{loc.send.create_this_is_hex}</BlueText>
          <TextInput style={styles.hexInput} height={112} multiline editable value={this.state.txhex} />

          <TouchableOpacity style={styles.hexTouch} onPress={() => Clipboard.setString(this.state.txhex)}>
            <Text style={styles.hexText}>{loc.send.create_copy}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.hexTouch} onPress={() => Linking.openURL('https://coinb.in/?verify=' + this.state.txhex)}>
            <Text style={styles.hexText}>{loc.send.create_verify}</Text>
          </TouchableOpacity>
          <BlueSpacing20 />
          <SecondButton onPress={this.broadcast} title={loc.send.confirm_sendNow} />
        </BlueCard>
      </View>
    );
  }

  exportPSBT = async () => {
    if (Platform.OS === 'ios') {
      const filePath = RNFS.TemporaryDirectoryPath + `/${this.fileName}`;
      await RNFS.writeFile(filePath, this.state.isFirstPSBTAlreadyBase64 ? this.state.psbt : this.state.psbt.toBase64());
      Share.open({
        url: 'file://' + filePath,
      })
        .catch(error => console.log(error))
        .finally(() => {
          RNFS.unlink(filePath);
        });
    } else if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE, {
        title: loc.send.permission_storage_title,
        message: loc.send.permission_storage_message,
        buttonNeutral: loc.send.permission_storage_later,
        buttonNegative: loc._.cancel,
        buttonPositive: loc._.ok,
      });

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log('Storage Permission: Granted');
        const filePath = RNFS.ExternalCachesDirectoryPath + `/${this.fileName}`;
        await RNFS.writeFile(filePath, this.state.isFirstPSBTAlreadyBase64 ? this.state.psbt : this.state.psbt.toBase64());
        alert(loc.formatString(loc.send.txSaved, { filePath }));
      } else {
        console.log('Storage Permission: Denied');
      }
    }
  };

  openSignedTransaction = async () => {
    try {
      const res = await DocumentPicker.pick({
        type: Platform.OS === 'ios' ? ['io.bluewallet.psbt', 'io.bluewallt.psbt.txn'] : [DocumentPicker.types.allFiles],
      });
      const file = await RNFS.readFile(res.uri);
      if (file) {
        this.setState({ isSecondPSBTAlreadyBase64: true }, () => this.onBarCodeRead({ data: file }));
      } else {
        this.setState({ isSecondPSBTAlreadyBase64: false });
        throw new Error();
      }
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        alert(loc.send.details_no_signed_tx);
      }
    }
  };

  render() {
    if (this.state.isLoading) {
      return (
        <View style={styles.rootPadding}>
          <ActivityIndicator />
        </View>
      );
    }

    if (this.state.success) return this._renderSuccess();
    if (this.state.renderScanner) return this._renderScanner();
    if (this.state.txhex) return this._renderBroadcastHex();

    return (
      <SafeBlueArea style={styles.root}>
        <ScrollView centerContent contentContainerStyle={styles.scrollViewContent}>
          <View style={styles.container}>
            <BlueCard>
              <BlueText testID="TextHelperForPSBT">{loc.send.psbt_this_is_psbt}</BlueText>
              <BlueSpacing20 />
              <DynamicQRCode value={this.state.psbt.toHex()} capacity={200} />
              <BlueSpacing20 />
              <SecondButton
                icon={{
                  name: 'qrcode',
                  type: 'font-awesome',
                  color: BlueCurrentTheme.colors.buttonTextColor,
                }}
                onPress={() => this.setState({ renderScanner: true, animatedQRCodeData: [] })}
                title={loc.send.psbt_tx_scan}
              />
              <BlueSpacing20 />
              <SecondButton
                icon={{
                  name: 'file-import',
                  type: 'material-community',
                  color: BlueCurrentTheme.colors.buttonTextColor,
                }}
                onPress={this.openSignedTransaction}
                title={loc.send.psbt_tx_open}
              />
              <BlueSpacing20 />
              <SecondButton
                icon={{
                  name: 'share-alternative',
                  type: 'entypo',
                  color: BlueCurrentTheme.colors.buttonTextColor,
                }}
                onPress={this.exportPSBT}
                title={loc.send.psbt_tx_export}
              />
              <BlueSpacing20 />
              <View style={styles.copyToClipboard}>
                <BlueCopyToClipboardButton
                  stringToCopy={this.state.isFirstPSBTAlreadyBase64 ? this.state.psbt : this.state.psbt.toBase64()}
                  displayText={loc.send.psbt_clipboard}
                />
              </View>
            </BlueCard>
          </View>
        </ScrollView>
      </SafeBlueArea>
    );
  }
}

PsbtWithHardwareWallet.propTypes = {
  navigation: PropTypes.shape({
    goBack: PropTypes.func,
    navigate: PropTypes.func,
    dangerouslyGetParent: PropTypes.func,
  }),
  route: PropTypes.shape({
    params: PropTypes.object,
  }),
};

PsbtWithHardwareWallet.navigationOptions = () => ({
  ...BlueNavigationStyle(null, false),
  title: loc.send.header,
});
