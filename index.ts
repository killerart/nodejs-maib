import https from 'https';
import axios, { AxiosResponse } from 'axios';
import fs from 'fs';
import _ from 'lodash';

export class MAIB {
  public readonly certFileName: string;
  public readonly certPass: string;
  public readonly merchantHandlerEndpoint: string;

  public readonly certFile: Buffer;

  constructor(
    certFileName: string,
    certPass: string,
    merchantHandlerEndpoint: string
  ) {
    this.certFileName = certFileName;
    this.certPass = certPass;
    this.merchantHandlerEndpoint = merchantHandlerEndpoint;
    this.certFile = fs.readFileSync(certFileName);
  }

  public createCommand() {
    return new MaibCommand(this);
  }
}

class MaibCommand {
  private _amount?: number;
  private _currency?: number;
  private _clientIpAddress?: string;
  private _description?: string;
  private _language?: string;

  constructor(private readonly maib: MAIB) {}

  private async request(payload: Record<string, string | number | undefined>) {
    const query = (
      Object.entries(payload).filter(entry => entry[1] !== undefined) as [
        string,
        string | number
      ][]
    )
      .map(
        entry =>
          `${encodeURIComponent(entry[0])}=${encodeURIComponent(entry[1])}`
      )
      .join('&');

    try {
      const response = await axios.post(
        this.maib.merchantHandlerEndpoint,
        query,
        {
          httpsAgent: new https.Agent({
            cert: this.maib.certFile,
            key: this.maib.certFile,
            passphrase: this.maib.certPass,
            rejectUnauthorized: false
          })
        }
      );
      return this.parseResponse(response);
    } catch (error) {
      console.log('ERROR', error);
      throw error;
    }
  }

  private parseResponse(response: AxiosResponse) {
    const rawData = response.data.trim().split('\n');

    const parsedResponse: Record<string, string> = {};

    for (let key in rawData) {
      const keyValues = rawData[key].split(':');
      parsedResponse[keyValues[0]] = keyValues[1].trim();
    }

    return _.mapKeys(parsedResponse, (_v, k) => _.camelCase(k));
  }

  public setAmount(amount: number) {
    this._amount = amount;
    return this;
  }

  public setCurrency(currency: number) {
    this._currency = currency;
    return this;
  }

  public setClientIpAddress(clientIpAddress: string) {
    this._clientIpAddress = clientIpAddress;
    return this;
  }

  public setDescription(description: string) {
    this._description = description;
    return this;
  }

  public setLanguage(language: string) {
    this._language = language;
    return this;
  }

  public async createTransaction(type: 'SMS' | 'DMS' = 'SMS') {
    if (this._amount === undefined) {
      throw new Error('_amount is undefined');
    }
    if (this._currency === undefined) {
      throw new Error('_currency is undefined');
    }
    if (this._clientIpAddress === undefined) {
      throw new Error('_clientIpAddress is undefined');
    }
    if (this._language === undefined) {
      throw new Error('_language is undefined');
    }
    const payload = {
      command: type === 'DMS' ? 'a' : 'v',
      amount: this._amount,
      currency: this._currency,
      client_ip_addr: this._clientIpAddress,
      description: this._description,
      language: this._language,
      msg_type: type
    };

    return await this.request(payload);
  }

  public async getTransactionStatus(transactionId: string) {
    if (this._clientIpAddress === undefined) {
      throw new Error('_clientIpAddress is undefined');
    }
    const payload = {
      command: 'c',
      trans_id: transactionId,
      client_ip_addr: this._clientIpAddress
    };

    return await this.request(payload);
  }

  public async commitTransaction(transactionId: string) {
    if (this._amount === undefined) {
      throw new Error('_amount is undefined');
    }
    if (this._currency === undefined) {
      throw new Error('_currency is undefined');
    }
    if (this._clientIpAddress === undefined) {
      throw new Error('_clientIpAddress is undefined');
    }
    if (this._language === undefined) {
      throw new Error('_language is undefined');
    }
    const payload = {
      command: 't',
      trans_id: transactionId,
      amount: this._amount,
      currency: this._currency,
      client_ip_addr: this._clientIpAddress,
      description: this._description,
      language: this._language
    };

    return await this.request(payload);
  }

  public async registerCard(cardId: string) {
    if (this._currency === undefined) {
      throw new Error('_currency is undefined');
    }
    if (this._clientIpAddress === undefined) {
      throw new Error('_clientIpAddress is undefined');
    }
    const payload = {
      command: 'p',
      currency: this._currency,
      client_ip_addr: this._clientIpAddress,
      description: this._description,
      biller_client_id: cardId,
      perspayee_expiry: '1299',
      perspayee_gen: 1,
      perspayee_overwrite: 1,
      msg_type: 'AUTH'
    };

    return await this.request(payload);
  }

  public async reverseTransaction(transactionId: string) {
    if (this._amount === undefined) {
      throw new Error('_amount is undefined');
    }
    const payload = {
      command: 'r',
      trans_id: transactionId,
      amount: this._amount
    };

    return await this.request(payload);
  }

  public async closeDay() {
    const payload = {
      command: 'b'
    };

    return await this.request(payload);
  }

  public async makeRegularPayment(cardId: string) {
    if (this._amount === undefined) {
      throw new Error('_amount is undefined');
    }
    if (this._currency === undefined) {
      throw new Error('_currency is undefined');
    }
    if (this._clientIpAddress === undefined) {
      throw new Error('_clientIpAddress is undefined');
    }
    const payload = {
      command: 'e',
      amount: this._amount,
      currency: this._currency,
      client_ip_addr: this._clientIpAddress,
      description: this._description,
      biller_client_id: cardId
    };

    return await this.request(payload);
  }

  public async deleteRegularPayment(cardId: string) {
    const payload = {
      command: 'x',
      biller_client_id: cardId
    };

    return await this.request(payload);
  }
}
