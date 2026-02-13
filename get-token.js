const { JWT } = require('google-auth-library');
const key = require('./google-services.json'); // 👈 Use your file name

async function getAccessToken() {
  const client = new JWT(
    key.client_email,
    null,
    key.private_key,
    ['https://www.googleapis.com/auth/firebase.messaging']
  );
  const tokens = await client.authorize();
  console.log('🔑 YOUR ACCESS TOKEN:\n', tokens.access_token);
}
getAccessToken();