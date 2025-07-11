import React from 'react';
import StickyHeader from './header';

const Profile = () => {
  return (
    <>
      <StickyHeader />
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>User Profile</h1>
        <p>Profile page content goes here</p>
      </div>
    </>
  );
};

export default Profile;