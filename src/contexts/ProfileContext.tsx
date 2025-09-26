import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "@clerk/clerk-expo";

// Define the shape
type ProfileType = {
  name: string;
  status: string;
  photoUrl: string;
  setName: (val: string) => void;
  setStatus: (val: string) => void;
  setPhotoUrl: (val: string) => void;
  saveProfile: () => Promise<void>;
  loading: boolean;
};

// Context default value
const ProfileContext = createContext<ProfileType>({
  name: "",
  status: "",
  photoUrl: "",
  setName: () => {},
  setStatus: () => {},
  setPhotoUrl: () => {},
  saveProfile: async () => {},
  loading: true,
});

// Provider component
export const ProfileProvider = ({ children }: { children: React.ReactNode }) => {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [loading, setLoading] = useState(true);

  const { getToken } = useAuth();

  useEffect(() => {
    const fetchProfile = async () => {
      const token = await getToken();
      try {
        const res = await axios.get("http://192.168.31.230:3000/api/users/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data) {
          setName(res.data.username || "");
          setStatus(res.data.status || "");
          setPhotoUrl(res.data.profilePic || "");
        }
      } catch (err) {
        console.error("Failed to fetch profile", err);
      }
      setLoading(false);
    };

    fetchProfile();
  }, []);

  const saveProfile = async () => {
    const token = await getToken();
    try {
      const res = await axios.post(
        "http://157.50.98.77:3000/api/users/profile",
        {
          username: name,
          status: status,
          profilePic: photoUrl,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log("Saved profile:", res.data);
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  return (
    <ProfileContext.Provider
      value={{ name, status, photoUrl, setName, setStatus, setPhotoUrl, saveProfile, loading }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

// Custom hook for easy usage
export const useProfile = () => useContext(ProfileContext);
