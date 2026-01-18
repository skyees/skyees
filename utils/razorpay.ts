// utils/razorpay.ts
import RazorpayCheckout from 'react-native-razorpay';
import Colors from '@/constants/Colors';

export const RAZORPAY_KEY_ID = 'rzp_test_S4us6qyvzEystM'; // Your provided ID

export const handleRazorpayPayment = async (
  amount: number, 
  user: { name: string; email: string; contact: string },
  description: string = "Purchase"
) => {
  try {
    // 1. You must create an order on your backend first!
    // Razorpay requires an 'order_id' generated on the server for security.
    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/payments/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amount * 100 }), // Amount in paise
    });
    
    const orderData = await response.json();

    const options = {
      description: description,
      image: '../../..assets/skyees-logo-app.png'
      currency: 'INR',
      key: RAZORPAY_KEY_ID,
      amount: orderData.amount, // from server
      name: 'Skyees Marketplace',
      order_id: orderData.id, // from server
      prefill: {
        email: user.email,
        contact: user.contact,
        name: user.name,
      },
      theme: { color: Colors.primary || '#007AFF' }
    };

    const result = await RazorpayCheckout.open(options);
    return result; // contains razorpay_payment_id, etc.
  } catch (error) {
    console.error("Razorpay Error:", error);
    throw error;
  }
};