import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import Colors from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';


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

  useFocusEffect(
   useCallback(() => {
      if (isSignedIn) {
          setLoading(true);
          setError(null);
        fetchContacts();
      } else {
          setContacts([]);
          setLoading(false);
          setError('You must be signed in to view contacts.');
      }
      return()=>{}
    }, [isSignedIn])
  );

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
      // Pressing the main part of the row will go to the chat screen
      onPress={() =>
        router.push({
          pathname: '/(tabs)/chats/[chatId]', // <- CHANGE THIS to your chat screen path
          params: {
            chatId: item.clerkId, // Use the clerkId or another unique ID for the chat
            name: item.name || item.username,
            receiverId: item.clerkId,
            image: item.photoUrl || item.profilePic,
            isRoom: false,
          },
        })
      }>
      <Image source={{ uri: item.photoUrl || item.profilePic }} style={styles.avatar} />

      <View style={styles.nameContainer}>
        <Text style={styles.name}>{item.name || item.username}</Text>
        <Text style={styles.status}>{item.status || 'Available'}</Text>
      </View>

      {/* This is the new container for the call button */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={{ marginRight: 15 }}
          onPress={() =>
            router.push({
              pathname: '/(tabs)/contacts/newCall',
              params: {
                id: String(item.clerkId),
                name: String(item.name || item.username),
                image: String(item.photoUrl || item.profilePic),
                type: 'audio',
              },
            })
          }
        >
    <Ionicons name="call-outline" size={24} color={Colors.primary} />
  </TouchableOpacity>

  {/* Video Call Button */}
<TouchableOpacity
  onPress={() =>
    router.push({
      pathname: '/(tabs)/contacts/newCall',
      params: {
        id: String(item.clerkId),
        name: String(item.name || item.username),
        image: String(item.photoUrl || item.profilePic),
        type: 'video',
      },
    })
  }
>

  <Ionicons name="videocam-outline" size={26} color={Colors.primary} />
</TouchableOpacity>


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
      paddingHorizontal: 15,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#f0f0f0', // Lighter border color
    },
    avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15 },
    nameContainer: {
      flex: 1, // This makes the name container take up all available space
    },
    name: { fontSize: 17, fontWeight: '600', color: '#000' }, // Slightly adjusted font
    status: { fontSize: 14, color: '#666', paddingTop: 2 },
    actionsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingLeft: 10,
    }
});

export default ContactsScreen;
