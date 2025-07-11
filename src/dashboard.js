import React from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';
import StickyHeader from './header';

const Dashboard = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <>
      <StickyHeader />
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Welcome to LakbAI Dashboard</h1>
        <p>You have successfully logged in!</p>
        <button 
          onClick={handleLogout}
          style={{
            backgroundColor: '#3b5fff',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Logout
        </button>
      </div>
    </>
  );
};

export default Dashboard;