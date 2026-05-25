const axios = require('axios');

const BASE_URL =
  process.env.MPESA_ENVIRONMENT === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

const isConfigured = () =>
  !!(
    process.env.MPESA_CONSUMER_KEY &&
    process.env.MPESA_CONSUMER_KEY !== 'your_mpesa_consumer_key' &&
    process.env.MPESA_CONSUMER_SECRET &&
    process.env.MPESA_CONSUMER_SECRET !== 'your_mpesa_consumer_secret' &&
    process.env.MPESA_SHORTCODE &&
    process.env.MPESA_PASSKEY &&
    process.env.MPESA_CALLBACK_URL
  );

// Normalize any phone format to 254XXXXXXXXX
const formatPhone = (phone) => {
  const raw = String(phone).replace(/[\s\-+()]/g, '');
  if (raw.startsWith('254')) return raw;
  if (raw.startsWith('0')) return '254' + raw.slice(1);
  if (raw.startsWith('7') || raw.startsWith('1')) return '254' + raw;
  return raw;
};

const getAccessToken = async () => {
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString('base64');

  const response = await axios.get(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  );
  return response.data.access_token;
};

const stkPush = async (phone, amount, accountRef, description) => {
  if (!isConfigured()) {
    console.warn('⚠️  M-Pesa not configured — using simulated STK push');
    return {
      simulated: true,
      CheckoutRequestID: `SIM-${Date.now()}`,
      MerchantRequestID: `MSIM-${Date.now()}`,
      ResponseCode: '0',
      ResponseDescription: 'Simulated — configure MPESA_* env vars for real prompts',
      CustomerMessage: 'Simulated STK push. No real M-Pesa prompt sent.',
    };
  }

  const token = await getAccessToken();
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

  const response = await axios.post(
    `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
    {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.ceil(parseFloat(amount)),
      PartyA: formatPhone(phone),
      PartyB: shortcode,
      PhoneNumber: formatPhone(phone),
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: String(accountRef).slice(0, 12),
      TransactionDesc: String(description).slice(0, 13),
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  return response.data;
};

module.exports = { stkPush, isConfigured, formatPhone };
