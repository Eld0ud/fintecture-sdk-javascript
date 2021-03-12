import qs from 'qs';

import { Endpoints } from './utils/URLBuilders/Endpoints';
import { IFintectureConfig } from './interfaces/ConfigInterface';
import * as apiService from './services/ApiService';
import { IPisV2Connect } from './interfaces/connect/ConnectInterface';

/**
 * Class responsible for performing PIS calls in Fintecture API.
 *
 * @export
 * @class PIS
 */
export class PISV2 {
  private axiosInstance;
  private config: IFintectureConfig;

  /**
   * Creates an instance of PIS.
   *
   * @param {Config} config
   */
  constructor(config: IFintectureConfig) {
    this.axiosInstance = this._getAxiosInstance(config.env);
    this.config = config;
  }

  /**
   * Connect
   *
   * @param {string} accessToken
   * @param {object} payload
   * @returns {Promise<object>}
   */
  public async connect(
    accessToken: string,
    payload: object,
    connectConfig: { state: string; redirect_uri?: string; origin_uri?: string },
  ): Promise<IPisV2Connect> {
    const url = `${Endpoints.PISV2}/connect?state=${connectConfig.state}${
      connectConfig.redirect_uri ? `&redirect_uri=${encodeURIComponent(connectConfig.redirect_uri)}` : ''
    }${connectConfig.origin_uri ? `&origin_uri=${encodeURIComponent(connectConfig.origin_uri)}` : ''}`;

    const headers = apiService.getHeaders('post', url, accessToken, this.config, payload);

    const response = await this.axiosInstance.post(url, payload, { headers });
    return response.data;
  }

  /**
   * This endpoint returns the details of all transfers or of a specific transfer
   *
   * @param {string} accessToken
   * @param {string} sessionId
   * @param {object} queryParameters (optional)
   * @returns {Promise<object>}
   */
  public async getPayments(accessToken: string, sessionId: string, queryParameters?: object): Promise<object> {
    const url =
      `${Endpoints.PISV2}/payments` +
      (sessionId ? '/' + sessionId : '') +
      (queryParameters ? '?' + qs.stringify(queryParameters) : '');

    const headers = apiService.getHeaders('get', url, accessToken, this.config);

    const response = await this.axiosInstance.get(url, { headers });

    return response.data;
  }

  /**
   * Private function that creates an instance of api
   * axios. This instance of axios include all the common headers
   * params.
   *
   * @param {string} appSecret
   * @returns {axios}
   */
  private _getAxiosInstance(env) {
    return apiService.getInstance(env);
  }
}
