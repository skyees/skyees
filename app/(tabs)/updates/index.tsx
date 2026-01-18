import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import InstagramPost from '@/components/InstagramPost';

const DUMMY_UPDATES = [
  {
    id: '1',
    userId: 'user_123',
    username: 'john_doe',
    userImage: 'https://i.pravatar.cc/150?u=1',
    postImage: 'https://picsum.photos/seed/post1/500/500',
    caption: 'Loving the vibe today! 🌴 #summer',
    likes: 124,
  },
  {
    id: '2',
    userId: 'user_456',
    username: 'jane_smith',
    userImage: 'https://i.pravatar.cc/150?u=2',
    postImage: 'https://picsum.photos/seed/post2/500/500',
    caption: 'Work hard, play hard. 💻🚀',
    likes: 89,
  },
];

export default function UpdatesScreen() {
  return (
    <View style={styles.container}>
      <FlatList
        data={DUMMY_UPDATES}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <InstagramPost post={item} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
});