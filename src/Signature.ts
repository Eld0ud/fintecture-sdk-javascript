import { IFintectureConfig } from './interfaces/ConfigInterface';
import { createHash, privateDecrypt } from 'crypto';
import { URLSearchParams } from 'url';
import assert from 'assert';

export class Signature {
  public config: IFintectureConfig;

  constructor(config: IFintectureConfig) {
    this.config = config;
  }

  /**
   * Checks request signature
   *
   * @param {string} accessTOken
   * @param {payment} State
   */
  public authenticateRequest(req): void {
    const headers = req.headers;
    const signature = headers.signature;
    try {
      const signatureComponents = this._extractSignatureComponents(signature);
      assert.ok(signatureComponents.size === 4, 'There should be 4 components in the signature');
      assert.ok(signatureComponents.has('keyId'), 'The signature should have a "keyId" component');
      assert.ok(signatureComponents.has('algorithm'), 'The signature should have an "algorithm" component');
      assert.ok(signatureComponents.has('headers'), 'The signature should have a "headers" component');
      assert.ok(signatureComponents.has('signature'), 'The signature should have a "signature" component');
      const rawBody = new URLSearchParams(req.body).toString();
      const digest = createHash('sha256')
        .update(rawBody)
        .digest('base64');
      assert.ok(headers.digest === `SHA-256=${digest}`, 'The digest should be valid');
      const PRIVATE_KEY = this.config.private_key;

      assert.ok(
        this._verifySignature(
          signatureComponents.get('signature'),
          headers,
          signatureComponents.get('headers'),
          PRIVATE_KEY,
        ),
        'The signature should be valid',
      );
    } catch (err) {
      throw err;
    }
  }

  private _verifySignature(expectedSignature, headers, signatureParameters, privateKey) {
    if (signatureParameters.includes('(request-target)')) {
      headers['(request-target)'] = 'post /webhook';
    }
    const actualPayload = signatureParameters
      .toLocaleLowerCase()
      .split(' ')
      .map(header => `${header}: ${headers[header]}`)
      .join('\n');
    const expectedPayload = privateDecrypt(privateKey, Buffer.from(expectedSignature, 'base64')).toString();
    return actualPayload === expectedPayload;
  }

  private _extractSignatureComponents(signature) {
    const pattern = /([a-z]+)\s*=\s*"([^"]+)"/gi;
    const signatureComponents = new Map();
    if (!signature || !pattern.test(signature)) {
      return signatureComponents;
    }
    pattern.lastIndex = 0;
    let result = pattern.exec(signature);
    while (result !== null) {
      signatureComponents.set(result[1], result[2]);
      result = pattern.exec(signature);
    }
    return signatureComponents;
  }
}
