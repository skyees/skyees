import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

const InstagramPost = ({ post }) => {
  const [liked, setLiked] = useState(false);
  const router = useRouter();

  const openDirectMessage = () => {
    // Navigate to Chat with this specific image
    router.push({
      pathname: '/(tabs)/chats/[chatId]',
      params: {
        chatId: post.userId,
        name: post.username,
        image: post.userImage,
        shareImage: post.postImage, // 👈 Pass image to chat
      }
    });
  };

  return (
    <View style={styles.postContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Image source={{ uri: post.userImage }} style={styles.avatar} />
        <Text style={styles.username}>{post.username}</Text>
        <TouchableOpacity style={styles.more}>
          <Feather name="more-horizontal" size={20} />
        </TouchableOpacity>
      </View>

      {/* Post Image */}
      <Image source={{ uri: post.postImage }} style={styles.postImage} />

      {/* Actions */}
      <View style={styles.actions}>
        <View style={styles.leftActions}>
          <TouchableOpacity onPress={() => setLiked(!liked)}>
            <Ionicons 
              name={liked ? "heart" : "heart-outline"} 
              size={26} 
              color={liked ? "red" : "black"} 
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.icon}>
            <Feather name="message-circle" size={24} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openDirectMessage} style={styles.icon}>
            <Feather name="send" size={24} />
          </TouchableOpacity>
        </View>
        <Feather name="bookmark" size={24} />
      </View>

      {/* Caption */}
      <View style={styles.captionContainer}>
        <Text style={styles.likes}>{post.likes} likes</Text>
        <Text style={styles.caption}>
          <Text style={styles.usernameBold}>{post.username} </Text>
          {post.caption}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  postContainer: { marginBottom: 15, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  avatar: { width: 35, height: 35, borderRadius: 17.5, marginRight: 10 },
  username: { fontWeight: '600', fontSize: 14, flex: 1 },
  postImage: { width: width, height: width },
  actions: { flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
  leftActions: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginLeft: 15 },
  captionContainer: { paddingHorizontal: 12, paddingBottom: 10 },
  likes: { fontWeight: 'bold', marginBottom: 4 },
  usernameBold: { fontWeight: 'bold' },
  caption: { fontSize: 14, lineHeight: 18 },
});

export default InstagramPost;