const { JWT } = require('google-auth-library');
const axios = require('axios');

const serviceAccount = require('./skyees7777-firebase-adminsdk-fbsvc-fc3049524c.json');

const PROJECT_ID = 'skyees7777';
const DEVICE_TOKEN = 'dzrm7cWuSZSbu1u4ih1YlS:APA91bHTCb0cpLGb7iwp2ZSDW-POAkNqpONt1yLBy6BMbsKeXbvJoyN3yPe9W3EO4Qwq3cmcqXOt0ogiGQLoB2c2VItekgjYO3-Z2i3efXySRmKNxa70JeM';

async function sendTestCall() {
  try {
    const jwtClient = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });

    const { access_token } = await jwtClient.authorize();

    console.log("✅ Access token OK");

    const res = await axios.post(
      `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
      {
        message: {
          token: DEVICE_TOKEN,
          data: {
            type: "INCOMING_CALL",
            uuid: `call_${Date.now()}`,
            name: "Skyees Friend",
            channelId: "com.goboss.skyees.calls"
          }
        }
      },
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("🚀 Sent:", res.data);

  } catch (err) {
    console.error("❌", err.response?.data || err.message);
  }
}

sendTestCall();
