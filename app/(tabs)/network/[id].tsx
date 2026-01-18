
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import React from 'react';import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';

const { width } = Dimensions.get('window');

export default function NetworkDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  // In a real app, you would fetch the product data using this 'id'
  // For now, we'll use dummy data
  const product = {
    title: 'iPhone 15 Pro',
    price: 134900,
    description: 'Brand new iPhone 15 Pro with 256GB storage. Perfect condition with bill and warranty.',
    image: 'https://picsum.photos/600/600?random=1',
    location: 'Mumbai, India',
    seller: 'Rajesh Kumar',
  };

 const handleBuy = async () => {
  try {
    // 1. Get Order from your backend
    const response = await fetch('https://your-api.com/api/payments/create-order', {
      method: 'POST',
      body: JSON.stringify({ amount: product.price * 100 }), // Amount in paise
    });
    const order = await response.json();

    // 2. Open Razorpay Popup
    const options = {
      key: 'rzp_test_S4us6qyvzEystM', // ✅ Frontend KEY_ID goes here
      amount: order.amount,
      name: 'Skyees Network',
      order_id: order.id,
      prefill: {
        email: 'user@example.com',
        contact: '919999999999',
      },
      theme: { color: '#007AFF' }
    };

    const data = await RazorpayCheckout.open(options);
    alert(`Success! ID: ${data.razorpay_payment_id}`);
    
  } catch (error) {
    console.log(error);
  }
};


  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Post Details', headerBackTitle: 'Back' }} />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        <Image source={{ uri: product.image }} style={styles.image} />
        
        <View style={styles.content}>
          <Text style={styles.price}>₹{product.price.toLocaleString('en-IN')}</Text>
          <Text style={styles.title}>{product.title}</Text>
          
          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color="#888" />
            <Text style={styles.location}>{product.location}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{product.description}</Text>
          
          <View style={styles.sellerCard}>
             <Ionicons name="person-circle" size={40} color={Colors.primary} />
             <View style={{ marginLeft: 10 }}>
                <Text style={styles.sellerName}>{product.seller}</Text>
                <Text style={styles.sellerLabel}>Verified Seller</Text>
             </View>
          </View>
        </View>
      </ScrollView>

      {/* FIXED BOTTOM ACTION BAR */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.chatButton} onPress={() => router.back()}>
           <Ionicons name="chatbubble-outline" size={24} color={Colors.primary} />
           <Text style={styles.chatText}>Chat</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.buyButton} onPress={handleBuy}>
           <Text style={styles.buyText}>Buy Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  image: { width: width, height: width },
  content: { padding: 20 },
  price: { fontSize: 28, fontWeight: 'bold', color: '#000' },
  title: { fontSize: 20, color: '#333', marginTop: 5 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  location: { color: '#888', marginLeft: 5, fontSize: 14 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  description: { fontSize: 16, color: '#444', lineHeight: 24 },
  sellerCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#f9f9f9', 
    padding: 15, 
    borderRadius: 12, 
    marginTop: 20 
  },
  sellerName: { fontWeight: 'bold', fontSize: 16 },
  sellerLabel: { color: '#888', fontSize: 12 },
  bottomBar: {
    flexDirection: 'row',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'center',
    paddingBottom: 30, // For safe area
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    height: 50,
    marginRight: 10,
  },
  chatText: { color: Colors.primary, fontWeight: 'bold', marginLeft: 8 },
  buyButton: {
    backgroundColor: Colors.primary,
    flex: 2,
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buyText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});