import React, { createContext, useContext, useState } from "react";

const UserContext = createContext();

export function UserProvider({ children }) {
  const [profile, setProfile] = useState({
    name: "",
    bio: "",
    profilePicture: "/user.png",
    likes: [],
    dislikes: [],
    joined: "",
  });
  // Removed unused localProfile and setLocalProfile

  return (
    <UserContext.Provider value={{ profile, setProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  const { profile } = context;
  return profile;
};