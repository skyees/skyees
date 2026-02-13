// app/call/SelectParticipant.tsx
import React, { useEffect, useState } from "react";
import { 
  View, Text, FlatList, Image, TouchableOpacity, 
  StyleSheet, ActivityIndicator, TextInput 
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { useAuth } from "@clerk/clerk-expo";

export default function SelectParticipant({ onSelect, onClose }: any) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { getToken } = useAuth();
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const token = await getToken();
      const res = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data);
    } catch (err) {
      console.error("Fetch contacts error", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((u: any) => 
    u.username?.toLowerCase().includes(search.toLowerCase()) || 
    u.name?.toLowerCase().includes(search.toLowerCase())
  );

  const renderUser = ({ item }: any) => (
    <TouchableOpacity style={styles.userItem} onPress={() => onSelect(item)}>
      <Image 
        source={item.profilePic ? { uri: item.profilePic } : require("@/assets/images/user-default.jpg")} 
        style={styles.avatar} 
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.username || item.name}</Text>
        <Text style={styles.userStatus}>{item.status || "Available"}</Text>
      </View>
      <Ionicons name="add-circle-outline" size={24} color="#34C759" />
    </TouchableOpacity>
  );

  return (
    <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Add Participant</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="rgba(255,255,255,0.3)" />
          <TextInput
            placeholder="Search contacts..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            style={styles.input}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#fff" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={(item: any) => item.clerkId}
            renderItem={renderUser}
            contentContainerStyle={{ paddingBottom: 50 }}
          />
        )}
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  searchBar: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', 
    paddingHorizontal: 15, borderRadius: 15, marginBottom: 20 
  },
  input: { flex: 1, height: 45, color: '#fff', marginLeft: 10 },
  userItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 15 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  userInfo: { flex: 1, marginLeft: 15 },
  userName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  userStatus: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 }
});