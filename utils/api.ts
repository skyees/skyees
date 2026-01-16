import Constants from 'expo-constants';

const getApiUrl = (): string => {
  const localhost = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  // Use your own server URL in production
  if (process.env.NODE_ENV === 'production') {
    return 'https://your-production-api.com';
  }
  return `http://${localhost}:3000`;
};

export default getApiUrl;