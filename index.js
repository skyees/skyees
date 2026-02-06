import { registerRootComponent } from 'expo';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './app/_layout'; // Points to your root layout
import RNNotificationCall from 'react-native-full-screen-notification-incoming-call';
// Register background tasks here
messaging().setBackgroundMessageHandler(async remoteMessage => {
  if (remoteMessage.data?.type === 'CALL_INVITE') {
    const { callId, callerName, callerImg, callType } = remoteMessage.data;

    // 🚀 This triggers the full-screen WhatsApp-style UI
    RNNotificationCall.displayNotification(
      callId,
      callerImg, 
      30000, // Timeout in ms
      {
        channelId: 'com.skyees.calls',
        channelName: 'Incoming Calls',
        notificationTitle: callerName,
        notificationBody: `Incoming ${callType} call`,
        answerText: 'Answer',
        declineText: 'Decline',
        notificationIcon: 'ic_launcher', // Must exist in android/app/src/main/res/mipmap
      }
    );
  }
});

// Manually register the root component
registerRootComponent(App);