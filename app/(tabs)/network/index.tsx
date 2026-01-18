
import React from 'react';
import { View, Text, FlatList, Image, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Colors from '@/constants/Colors';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// 1. Updated with Indian Rupee symbols and realistic prices
const DUMMY_PRODUCTS = [
  { id: '1', title: 'iPhone 15 Pro', price: 134900, image: 'https://picsum.photos/200/200?random=1', location: 'Mumbai' },
  { id: '2', title: 'Nike Air Max', price: 9500, image: 'https://picsum.photos/200/200?random=2', location: 'Delhi' },
  { id: '3', title: 'Coffee Table', price: 4500, image: 'https://picsum.photos/200/200?random=3', location: 'Bangalore' },
  { id: '4', title: 'Gaming PC', price: 85000, image: 'https://picsum.photos/200/200?random=4', location: 'Pune' },
];

export default function MarketScreen() {
  const router = useRouter();

  // Format currency to Indian style (e.g., 1,34,900)
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Marketplace</Text>
        <TouchableOpacity style={styles.sellButton} onPress={() => router.push('/market/sell')}>
          <Text style={styles.sellText}>Sell</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={DUMMY_PRODUCTS}
        numColumns={2}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity 
               onPress={() => router.push({ pathname: '/market/[id]', params: { id: item.id } })}
            >
              <Image source={{ uri: item.image }} style={styles.productImg} />
            </TouchableOpacity>

            <View style={styles.info}>
              <Text style={styles.productTitle} numberOfLines={1}>{item.title}</Text>
              
              <View style={styles.locationContainer}>
                <Ionicons name="location-sharp" size={12} color="#888" />
                <Text style={styles.location}>{item.location}</Text>
              </View>

              {/* BUY BUTTON WITH RUPEE PRICE */}
              <TouchableOpacity 
                style={styles.buyButton}
                onPress={() => {
                
					  router.push({ 
						pathname: '/network/[id]', 
						params: { id: item.id } 
					  })

                }}
              >
                <Text style={styles.buyButtonText}>Buy {formatCurrency(item.price)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f4' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    padding: 15, 
    alignItems: 'center',
    backgroundColor: '#fff' 
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1c1e21' },
  sellButton: { backgroundColor: '#E7F3FF', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 18 },
  sellText: { color: '#0064E0', fontWeight: '600' },
  
  card: { 
    width: width / 2 - 15, 
    margin: 7, 
    borderRadius: 12, 
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    overflow: 'hidden'
  },
  productImg: { width: '100%', height: 150 },
  info: { padding: 10 },
  productTitle: { fontSize: 14, fontWeight: '500', color: '#333' },
  
  locationContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginVertical: 4 
  },
  location: { fontSize: 11, color: '#777', marginLeft: 2 },
  
  buyButton: {
    backgroundColor: Colors.primary || '#007AFF',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 5,
  },
  buyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
});