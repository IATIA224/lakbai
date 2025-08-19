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

  return (
    <UserContext.Provider value={{ profile, setProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);