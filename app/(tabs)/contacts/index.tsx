import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import axios from 'axios';import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import Colors from '@/constants/Colors';



// 2. Define and export the screen options
export const CustomScreen = () => {
  return (
    <Screen
      options={{
        title: 'Select Contact', // You can set your desired title here
        headerStyle: {
          backgroundColor: Colors.primary, // Optional: Style the header
        },
        headerTintColor: '#fff', // Optional: Change the title and back button color
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    />
  );
};

const ContactsScreen = () => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  const { getToken,isSignedIn } = useAuth();

  useEffect(() => {
         if (!isSignedIn) {
             setContacts([]); // Clear chats if the user signs out
           return;
        }
       fetchContacts();
  }, [isSignedIn]);

  const fetchContacts = async () => {
    try {
      // setLoading(true); // ✅ THIS LINE IS REMOVED TO PREVENT THE LOOP
      setError(null);
      const token = await getToken();

          console.log("🪪 Clerk token:", token,`${apiUrl}/api/users`);
      const res = await axios.get(`${apiUrl}/api/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setContacts(res.data);
      console.error("res.data contacts list  details:", res.data);
    } catch (err: any) {
      console.error("Error fetching contacts:", err);
      if (error.errors) console.error("Clerk error details:", error.errors);
      setError("Failed to load contacts. Please check your connection.");
    } finally {
      // This will now correctly turn off the loading indicator once
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color={Colors.primary || 'blue'} style={{ marginTop: 20 }} />;
  }

  if (error) {
    return <Text style={styles.errorText}>{error}</Text>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={contacts}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() =>
              router.push({
                pathname: '(tabs)/contacts/newCall',
                params: {
                  id: item._id,
                  name: item.name,
                  image: item.photoUrl || item.profilePic,
                },
              })
            }
          >
            <Image source={{ uri: item.photoUrl || item.profilePic }} style={styles.avatar} />
            <View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.status}>Tap to call</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.errorText}>No contacts found.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12 },
  name: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  status: { fontSize: 13, color: '#666' },
  errorText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
});

export default ContactsScreen;
