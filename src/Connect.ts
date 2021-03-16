import * as UtilsCrypto from './utils/Crypto.js';
import { BaseUrls } from './utils/URLBuilders/BaseUrls';
import * as connectService from './services/ConnectService';
import {
  IPisSetup,
  IPisConnectConfig,
  IAisConnectConfig,
  IPaymentPayload,
  IData,
  IAttributes,
  IMeta,
} from './interfaces/connect/ConnectInterface';
import { ISessionPayload } from './interfaces/pis/PisInterface';
import { IFintectureConfig } from './interfaces/ConfigInterface';
import { Constants } from './utils/Constants.js';
import { PIS } from './Pis';
import { PISV2 } from './PisV2';
import * as apiService from './services/ApiService';

export class Connect {
  public pis: PIS;
  public pisV2: PISV2;
  public axios: any;
  public config: IFintectureConfig;
  public connectConfig: IPisSetup;

  private signatureType: string;

  constructor(config: IFintectureConfig) {
    this.pis = new PIS(config);
    this.pisV2 = new PISV2(config);
    this.axios = connectService;
    this.config = config;
    this.signatureType = 'rsa-sha256';
  }

  /**
   * Generates a connect URL based on the AIS parameters
   *
   * @param {string} accessTOken
   * @param {payment} State
   */
  public getAisConnect(accessToken: string, connectConfig: any) {
    this.config = this._validateConfigIntegrity(this.config);

    const headers: any = this._buildHeaders(accessToken, 'get', null, this.config.private_key, this.signatureType);

    const config: IAisConnectConfig = {
      app_id: this.config.app_id,
      signature_type: this.signatureType,
      signature: headers['Signature'],
      redirect_uri: connectConfig.redirect_uri,
      origin_uri: connectConfig.origin_uri,
      state: connectConfig.state,
      psu_type: connectConfig.psu_type,
      country: connectConfig.country,
      date: headers['Date'],
      request_id: headers['X-Request-ID'],
      provider: connectConfig.provider,
    };

    if (accessToken) {
      config.access_token = accessToken;
    }

    const psuType = connectConfig.psu_type ? connectConfig.psu_type : 'retail';
    const country = connectConfig.country ? connectConfig.country : 'fr';

    const url = `${
      this.config.env === Constants.SANDBOXENVIRONMENT
        ? BaseUrls.FINTECTURECONNECTURL_SBX
        : BaseUrls.FINTECTURECONNECTURL_PRD
    }/ais/${psuType}/${country}`;

    const connect = {
      url: `${url}?config=${Buffer.from(JSON.stringify(config)).toString('base64')}`,
    };

    return connect;
  }

  /**
   * Generates a connect URL based on the PIS parameters
   *
   * @param {string} accessTOken
   * @param {payment} State
   */
  public async getPisConnect(accessToken: string, connectConfig: any) {
    this.config = this._validateConfigIntegrity(this.config);
    this.connectConfig = this._validatePisConnectConfigIntegrity(connectConfig);

    const paymentPayload: IPaymentPayload = this._buildPaymentPayload(connectConfig);

    const prepare: any = await this.pis.prepare(accessToken, paymentPayload);

    const sessionPayload: ISessionPayload = this._buildSessionPayload(prepare);

    const headers: any = this._buildHeaders(
      accessToken,
      'post',
      sessionPayload,
      this.config.private_key,
      this.signatureType,
    );

    const config: IPisConnectConfig = {
      app_id: this.config.app_id,
      access_token: accessToken,
      signature_type: this.signatureType,
      signature: headers['Signature'],
      redirect_uri: connectConfig.redirect_uri,
      origin_uri: connectConfig.origin_uri,
      state: connectConfig.state,
      payload: sessionPayload,
      psu_type: connectConfig.psu_type,
      country: connectConfig.country,
      date: headers['Date'],
      request_id: headers['X-Request-ID'],
      provider: connectConfig.provider,
    };

    const url = `${
      this.config.env === Constants.SANDBOXENVIRONMENT
        ? BaseUrls.FINTECTURECONNECTURL_SBX
        : BaseUrls.FINTECTURECONNECTURL_PRD
    }/pis`;

    const connect = {
      url: `${url}?config=${Buffer.from(JSON.stringify(config)).toString('base64')}`,
      session_id: prepare.meta.session_id,
    };

    return connect;
  }

  /**
   * Generates a V2 connect URL based on the PIS parameters
   *
   * @param {string} accessTOken
   * @param {payment} State
   */
  public async getPisV2Connect(accessToken: string, connectConfig: any) {
    this.config = this._validateConfigIntegrity(this.config);
    this.connectConfig = this._validatePisConnectConfigIntegrity(connectConfig);

    const paymentPayload: IPaymentPayload = this._buildPaymentPayload(connectConfig);

    const connect = await this.pisV2.connect(accessToken, paymentPayload, connectConfig);

    return connect;
  }

  private _validatePisConnectConfigIntegrity(connectConfig: any) {
    if (!connectConfig.amount) {
      throw Error('amount not set');
    }
    if (isNaN(connectConfig.amount)) {
      throw Error('amount must be a number');
    }
    if (!(connectConfig.amount >= 1)) {
      throw Error('amount must be greater than 1');
    }
    if (!connectConfig.currency) {
      throw Error('currency not set');
    }
    if (!connectConfig.customer_full_name && this.config.env === Constants.PRODUCTIONENVIRONMENT) {
      throw Error('customer full name must be set');
    }
    if (!connectConfig.customer_email && this.config.env === Constants.PRODUCTIONENVIRONMENT) {
      throw Error('customer email must be set');
    }
    if (!connectConfig.customer_ip && this.config.env === Constants.PRODUCTIONENVIRONMENT) {
      throw Error('customer ip must be set');
    }

    return connectConfig as IPisSetup;
  }

  private _buildHeaders(accessToken: string, method: string, payload: any, privateKey: string, algorithm: string): any {
    const headers = apiService.getHeaders(method, '', accessToken, this.config, payload);
    const signingString = UtilsCrypto.buildSigningString(headers, Constants.CONNECTHEADERPARAMETERLIST);
    headers['Signature'] = UtilsCrypto.signPayload(signingString, this.config.private_key);
    return headers;
  }

  private _buildPaymentPayload(payment: any) {
    const attributes: IAttributes = {
      amount: payment.amount,
      currency: payment.currency,
      communication: `${payment.communication}`,
      beneficiary: payment.beneficiary,
      execution_date: payment.execution_date,
      end_to_end_id: payment.end_to_end_id,
    };

    const meta: IMeta = {
      psu_name: payment.customer_full_name,
      psu_form: payment.customer_form,
      psu_incorporation: payment.customer_incorporation,
      psu_email: payment.customer_email,
      psu_ip: payment.customer_ip,
      psu_phone: payment.customer_phone,
      psu_address: payment.customer_address,
    };

    const data: IData = {
      type: 'SEPA',
      attributes,
    };

    const payload: IPaymentPayload = {
      data,
      meta,
    };

    return payload;
  }

  private _buildSessionPayload(payment) {
    const payload = {
      meta: {
        session_id: payment.meta.session_id,
      },
      data: {
        attributes: {
          amount: payment.data.attributes.amount,
          currency: payment.data.attributes.currency,
        },
      },
    } as ISessionPayload;

    if (payment.data.attributes.beneficiary) {
      payload.data.attributes.beneficiary = { name: payment.data.attributes.beneficiary.name };
    }

    if (payment.data.attributes.execution_date) {
      payload.data.attributes.execution_date = payment.data.attributes.execution_date;
    }

    return payload;
  }

  private _validateConfigIntegrity(config) {
    if (!config.private_key) {
      throw Error('private_key must be set to use this function');
    }

    return config as IFintectureConfig;
  }
}
