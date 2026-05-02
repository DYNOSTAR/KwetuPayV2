const axios = require('axios');

class MpesaService {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.passkey = process.env.MPESA_PASSKEY;
    this.shortcode = process.env.MPESA_SHORTCODE;
    this.callbackURL = process.env.MPESA_CALLBACK_URL;
    this.baseURL = process.env.NODE_ENV === 'production' 
      ? 'https://api.safaricom.co.ke' 
      : 'https://sandbox.safaricom.co.ke';
  }

  async getAccessToken() {
    try {
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      const response = await axios.get(
        `${this.baseURL}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`
          }
        }
      );
      return response.data.access_token;
    } catch (error) {
      console.error('M-Pesa auth error:', error);
      throw new Error('Failed to get M-Pesa access token');
    }
  }

  async initiateSTKPush(phoneNumber, amount, accountReference, transactionDesc) {
    try {
      const token = await this.getAccessToken();
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const password = Buffer.from(
        `${this.shortcode}${this.passkey}${timestamp}`
      ).toString('base64');

      const response = await axios.post(
        `${this.baseURL}/mpesa/stkpush/v1/processrequest`,
        {
          BusinessShortCode: this.shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: Math.ceil(amount), // M-Pesa requires integer
          PartyA: phoneNumber.replace('+', '').replace(/\s/g, ''),
          PartyB: this.shortcode,
          PhoneNumber: phoneNumber.replace('+', '').replace(/\s/g, ''),
          CallBackURL: this.callbackURL,
          AccountReference: accountReference || 'Kwetupay Rent',
          TransactionDesc: transactionDesc || 'Rent Payment'
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('M-Pesa STK Push error:', error);
      throw new Error('Failed to initiate M-Pesa payment');
    }
  }
}

module.exports = new MpesaService();