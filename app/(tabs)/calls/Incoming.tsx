import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import useSocket from '@/utils/socket';
import { useAuth, useUser } from '@clerk/clerk-expo';
import axios from 'axios';

// Reanimated components for smooth animations
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedView = Animated.createAnimatedComponent(View);

const Incoming = () => {
    const router = useRouter();
    const socket = useSocket();
    const { getToken } = useAuth();
    const { user } = useUser();

    // Get call data passed from the previous screen
    const { callerName, callerId, receiverId, callType, _id: callId, callerImg } = useLocalSearchParams<{
        callerName: string;
        callerId: string;
        receiverId: string;
        callType: 'video' | 'audio';
        _id: string;
        callerImg: string;
    }>();

    const API_URL = process.env.EXPO_PUBLIC_API_URL;

    // This effect listens for when the caller hangs up before you answer
    useEffect(() => {
        if (!socket) return;

        const onCallCancelled = ({ callId: cancelledCallId }: { callId: string }) => {
            if (cancelledCallId === callId) {
                // If the incoming call is the one that was cancelled, close the modal
                if (router.canGoBack()) {
                    router.back();
                }
            }
        };

        socket.on('call-cancelled', onCallCancelled);

        return () => {
            socket.off('call-cancelled', onCallCancelled);
        };
    }, [socket, callId, router]);

    // Function to handle declining the call
    const onDecline = async () => {
        try {
            const token = await getToken();
            // Tell the backend that the call was missed/declined
            await axios.put(
                `${API_URL}/api/calls/end`,
                { callId, status: 'missed' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (error) {
            console.error("Error declining call:", error);
        } finally {
            // Close the incoming call modal. [1]
            if (router.canGoBack()) {
                router.back();
            }
        }
    };
const [isAccepting, setIsAccepting] = useState(false);
    // Function to handle accepting the call
    const onAccept = async () => {
        try {
            const token = await getToken();
    if (isAccepting) return; // prevent duplicate call
            // 1. Tell the backend that the call has been accepted
            await axios.put(
                `${API_URL}/api/calls/accept`,
                { callId },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // 2. Navigate to the main call screen, passing all necessary data
            // We use `replace` to prevent the user from going back to the incoming call screen.
            router.replace({
                pathname: '(tabs)/calls/Call',
                params: {
                  callerName,
                  callerId,
                  receiverId,
                  type: callType, // ✅ FIXED
                  callId,
                  isCaller: 'false'
                },
                          });
        } catch (error) {
            console.error("Error accepting call:", error);
            // If accepting fails, just close the modal. [1]
            if (router.canGoBack()) {
                setIsAccepting(false);
                router.back();
            }
        }
    };

    return (
        <AnimatedView style={styles.container} entering={FadeInDown} exiting={FadeOut}>
            <Image source={{ uri: callerImg }} style={styles.callerImage} />
            <Text style={styles.callerName}>{callerName}</Text>
            <Text style={styles.callType}>{callType === 'video' ? 'Video Call' : 'Audio Call'}</Text>

            <View style={styles.buttonContainer}>
                {/* Decline Button */}
                <AnimatedTouchableOpacity
                    onPress={onDecline}
                    style={[styles.button, styles.declineButton]}
                    entering={FadeInDown.delay(200)}
                >
                    <Feather name="x" size={40} color="white" />
                    <Text style={styles.buttonText}>Decline</Text>
                </AnimatedTouchableOpacity>
                {/* Accept Button */}
                <AnimatedTouchableOpacity
                    onPress={onAccept}
                    style={[styles.button, styles.acceptButton]}
                    entering={FadeInDown.delay(400)}
                >
                    <Feather name={callType === 'video' ? 'video' : 'phone'} size={40} color="white" />
                    <Text style={styles.buttonText}>Accept</Text>
                </AnimatedTouchableOpacity>
            </View>
        </AnimatedView>
    );
};


const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)', // Semi-transparent background
    },
    callerImage: {
        width: 120,
        height: 120,
        borderRadius: 60,
        marginBottom: 20,
    },
    callerName: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'white',
    },
    callType: {
        fontSize: 20,
        color: 'rgba(255, 255, 255, 0.7)',
        marginTop: 8,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '80%',
        position: 'absolute',
        bottom: 80,
    },
    button: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    declineButton: {
        backgroundColor: '#FF3B30', // iOS red
    },
    acceptButton: {
        backgroundColor: '#34C759', // iOS green
    },
    buttonText: {
        color: 'white',
        marginTop: 8,
        fontSize: 14,
    },
});

export default Incoming;
