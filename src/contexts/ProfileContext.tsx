import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-expo';

// 1. Define the type to match the server model
interface ProfileContextType {
  username: string;
  status: string;
  profilePic: string;
  loading: boolean;
  setUsername: React.Dispatch<React.SetStateAction<string>>;
  setStatus: React.Dispatch<React.SetStateAction<string>>;
  setProfilePic: React.Dispatch<React.SetStateAction<string>>;
  saveProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSignedIn, getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // 2. Create states that match the server model
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState('');
  const [profilePic, setProfilePic] = useState('');
  
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;

  // Effect to fetch the initial profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (isSignedIn) {
        setLoading(true);
        try {
          const token = await getToken();
          if (!token) return;

          const res = await axios.get(`${apiUrl}/api/users/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          // 3. Populate states from fetched data, using the correct field names
          if (res.data) {
            setUsername(res.data.username || '');
            setStatus(res.data.status || '');
            setProfilePic(res.data.profilePic || '');
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setUsername('');
        setStatus('');
        setProfilePic('');
        setLoading(false);
      }
    };
    fetchProfile();
  }, [isSignedIn]);

  // 4. Define the saveProfile function to send the correct field names
  const saveProfile = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("No auth token");

      const updatedProfile = { username, status, profilePic };

      await axios.post(`${apiUrl}/api/users/profile`, updatedProfile, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setLoading(false);
    }
  };

  // 5. Provide all the states and functions with the correct names
  const value = {
    username,
    status,
    profilePic,
    loading,
    setUsername,
    setStatus,
    setProfilePic,
    saveProfile,
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
