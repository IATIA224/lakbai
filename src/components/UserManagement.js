import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { getFirestore, collection, getDocs, getDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import '../Styles/UserManagement.css';
import '../Styles/adminNav.css';

const UserManagement = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [authInitialized, setAuthInitialized] = useState(false);
    const [showNotification, setShowNotification] = useState(false);
    const [notificationMessage, setNotificationMessage] = useState('');

    // Update document title with gear icon
    useEffect(() => {
        document.title = 'User Management';
        return () => {
            document.title = 'LakbAI'; // Reset to default title when component unmounts
        };
    }, []);

    // Handler for updating user fields (without showing notification)
    const updateUserField = async (field, value) => {
        try {
            setSelectedUser(prev => ({ ...prev, [field]: value }));
        } catch (error) {
            console.error('Error updating user field:', error);
        }
    };

    // Handler for form submission - saves all changes at once
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const userRef = doc(db, 'users', selectedUser.id);
            await updateDoc(userRef, selectedUser);
            
            setUsers(prev => prev.map(user => 
                user.id === selectedUser.id 
                    ? selectedUser
                    : user
            ));
            
            // Show success notification
            setNotificationMessage('Changes saved successfully!');
            setShowNotification(true);
            setTimeout(() => {
                setShowNotification(false);
            }, 3000);

            // Trigger a change event that the Profile page can listen to
            const changeEvent = new CustomEvent('userDataChanged', {
                detail: { userId: selectedUser.id }
            });
            window.dispatchEvent(changeEvent);
            
            setIsEditing(false);
        } catch (error) {
            console.error('Error saving changes:', error);
            setNotificationMessage('Failed to save changes: ' + error.message);
            setShowNotification(true);
            setTimeout(() => {
                setShowNotification(false);
            }, 3000);
        }
    };

    // Cloudinary upload function
    const uploadToCloudinary = async (file) => {
        const url = "https://api.cloudinary.com/v1_1/dxvewejox/image/upload";
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "dxvewejox");

        const response = await fetch(url, {
            method: "POST",
            body: formData,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Upload failed");
        return data.secure_url;
    };

    // Handler for profile picture changes
    const handleProfilePictureChange = async (e) => {
        try {
            const file = e.target.files[0];
            if (!file) return;

            // Show loading notification
            setNotificationMessage('Uploading profile picture...');
            setShowNotification(true);

            // Upload to Cloudinary
            const photoUrl = await uploadToCloudinary(file);
            
            // Update local state
            await updateUserField('profilePicture', photoUrl);

            // Show success notification
            setNotificationMessage('Profile picture uploaded successfully!');
            setShowNotification(true);
            setTimeout(() => {
                setShowNotification(false);
            }, 3000);
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            setNotificationMessage('Failed to upload profile picture: ' + error.message);
            setShowNotification(true);
            setTimeout(() => {
                setShowNotification(false);
            }, 3000);
        }
    };

    // Handler for travel interests
    const handleInterestChange = async (interest, isChecked) => {
        try {
            const currentInterests = selectedUser.travelInterests || [];
            let newInterests;
            
            if (isChecked) {
                newInterests = [...new Set([...currentInterests, interest])];
            } else {
                newInterests = currentInterests.filter(i => i !== interest);
            }
            
            await updateUserField('travelInterests', newInterests);
        } catch (error) {
            console.error('Error updating interests:', error);
            alert('Failed to update interests: ' + error.message);
        }
    };

    // Handler for adding photos to gallery
    const handleAddPhoto = async (e) => {
        try {
            const files = Array.from(e.target.files);
            const photoGallery = selectedUser.photoGallery || [];
            
            // Show loading notification
            setNotificationMessage('Uploading photos...');
            setShowNotification(true);
            
            for (const file of files) {
                // Upload to Cloudinary
                const photoUrl = await uploadToCloudinary(file);
                
                photoGallery.push({
                    url: photoUrl,
                    uploadedAt: new Date().toISOString()
                });
            }
            
            await updateUserField('photoGallery', photoGallery);
            
            // Show success notification
            setNotificationMessage('Photos uploaded successfully!');
            setShowNotification(true);
            setTimeout(() => {
                setShowNotification(false);
            }, 3000);
        } catch (error) {
            console.error('Error adding photos:', error);
            setNotificationMessage('Failed to add photos: ' + error.message);
            setShowNotification(true);
            setTimeout(() => {
                setShowNotification(false);
            }, 3000);
        }
    };

    // Handler for deleting photos
    const handleDeletePhoto = async (index) => {
        try {
            const photoGallery = [...(selectedUser.photoGallery || [])];
            photoGallery.splice(index, 1);
            await updateUserField('photoGallery', photoGallery);
        } catch (error) {
            console.error('Error deleting photo:', error);
            alert('Failed to delete photo: ' + error.message);
        }
    };

    // Handler for deleting activity
    const handleDeleteActivity = async (index) => {
        try {
            const activities = [...(selectedUser.recentActivity || [])];
            activities.splice(index, 1);
            await updateUserField('recentActivity', activities);
        } catch (error) {
            console.error('Error deleting activity:', error);
            alert('Failed to delete activity: ' + error.message);
        }
    };

    const auth = getAuth();
    const db = getFirestore();
    
    const makeAdmin = async () => {
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error('No user logged in');
            }
            console.log('Making user admin:', user.uid);
            const adminDocRef = doc(db, 'Admin', user.uid);
            console.log('Admin document path:', adminDocRef.path);
            await setDoc(adminDocRef, {
                role: 'admin',
                createdAt: new Date(),
                email: user.email
            });
            console.log('Admin document created');
            alert('Admin access granted! Reloading page...');
            window.location.reload();
        } catch (error) {
            console.error('Error:', error);
            alert('Error: ' + error.message);
        }
    };

    // Function to check if user exists in Admin collection
    const checkAdminStatus = async (userId) => {
        try {
            console.log('Checking admin status for:', userId);
            const adminDocRef = doc(db, 'Admin', userId);
            console.log('Admin document reference:', adminDocRef.path);
            const adminDoc = await getDoc(adminDocRef);
            console.log('Admin document exists:', adminDoc.exists());
            if (adminDoc.exists()) {
                console.log('Admin document data:', adminDoc.data());
            }
            return adminDoc.exists();
        } catch (error) {
            console.error('Error checking admin status:', error);
            return false;
        }
    };

    useEffect(() => {
        const user = auth.currentUser;
        if (user) {
            console.log('Your user ID is:', user.uid);
        }
    }, []);

  // Handle authentication state
useEffect(() => {
    let isMounted = true;
    
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
        if (!isMounted) return;
        
        setAuthInitialized(true);
        
        if (!user) {
            console.log('No user logged in');
            setLoading(false);
            navigate('/');
            return;
        }

        try {
            console.log('Checking admin status for user:', user.uid);
            // Check if user is admin in the Admin collection
            const adminDocRef = doc(db, 'Admin', user.uid);
            console.log('Admin document path:', adminDocRef.path);
            const adminDoc = await getDoc(adminDocRef);
            console.log('Document exists:', adminDoc.exists());
            const adminData = adminDoc.data();
            console.log('Admin data:', adminData); // Debug log
            
            if (adminDoc.exists() && adminData && (adminData.role === 'admin' || adminData.role === '"admin"')) {
                if (!isMounted) return;
                
                setIsAdmin(true);
                // Fetch users only if admin
                const usersRef = collection(db, 'users');
                const usersSnap = await getDocs(usersRef);
                const usersList = usersSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                if (!isMounted) return;
                setUsers(usersList);
            } else {
                console.log('User is not an admin');
                if (!isMounted) return;
                navigate('/dashboard');
            }
        } catch (error) {
            console.error('Error checking admin status:', error);
            if (!isMounted) return;
            navigate('/dashboard');
        } finally {
            if (!isMounted) return;
            setLoading(false);
        }
    });

    return () => {
        isMounted = false;
        unsubscribe();
    };
}, [db, navigate]);

  // Update user
// Temporary function to set up admin status - REMOVE AFTER USE
const setUpAdminStatus = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        console.log('No user logged in');
        return;
    }
    
    try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
            isAdmin: true
        });
        console.log('Admin status set successfully');
        window.location.reload();
    } catch (error) {
        console.error('Error setting admin status:', error);
    }
};

const handleUpdateUser = async (userId, updatedData) => {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, updatedData);
      // Refresh users list
    const updatedUsers = users.map(user => 
        user.id === userId ? { ...user, ...updatedData } : user
    );
    setUsers(updatedUsers);
    setIsEditing(false);
    } catch (error) {
    console.error('Error updating user:', error);
    }
};

  // Delete user
const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
    try {
        await deleteDoc(doc(db, 'users', userId));
        setUsers(users.filter(user => user.id !== userId));
    } catch (error) {
        console.error('Error deleting user:', error);
    }
    }
};

  // Upload profile picture
const handleProfilePictureUpload = async (file, userId) => {
    try {
        // Show loading notification
        setNotificationMessage('Uploading profile picture...');
        setShowNotification(true);

        // Upload to Cloudinary
        const photoUrl = await uploadToCloudinary(file);
        
        // Update user data
        await handleUpdateUser(userId, { profilePicture: photoUrl });

        // Show success notification
        setNotificationMessage('Profile picture uploaded successfully!');
        setShowNotification(true);
        setTimeout(() => {
            setShowNotification(false);
        }, 3000);
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        setNotificationMessage('Failed to upload profile picture: ' + error.message);
        setShowNotification(true);
        setTimeout(() => {
            setShowNotification(false);
        }, 3000);
    }
};

return (
    <div className="user-management-container">
    <button 
        onClick={makeAdmin}
        style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            zIndex: 1000
        }}
    >
        Make Admin
    </button>
    <button 
        className="admin-nav-button"
        onClick={() => navigate('/admin/destinations')}
    >
        🗺️ Go to Destination Manager
    </button>
    <h1 className="user-management-title">⚙️ User Management</h1>
    
    {loading ? (
        <div className="loading">Loading users...</div>
    ) : (
        <div className="users-grid">
        {users.map(user => (
            <div key={user.id} className="user-card">
            <div className="user-header">
                <img 
                src={user.profilePicture || '/user.png'} 
                alt="Profile" 
                className="profile-picture"
                />
                <div className="user-auth-badges">
                {user.googleAuth && <span title="Google Sign In">🔵</span>}
                {user.facebookAuth && <span title="Facebook Sign In">📘</span>}
                </div>
            </div>

            <div className="user-info">
                <h3>📧 {user.email}</h3>
                <p>👤 {user.name || 'No name set'}</p>
                <p>📝 {user.bio || 'No bio available'}</p>
                
                <div className="user-stats">
                <div>🌍 Places Visited: {user.placesVisited?.length || 0}</div>
                <div>📸 Photos Shared: {user.photosShared?.length || 0}</div>
                <div>⭐ Reviews Written: {user.reviewsWritten?.length || 0}</div>
                <div>👥 Friends: {user.friends?.length || 0}</div>
                <div>🏆 Achievements: {user.achievements?.length || 0}</div>
                </div>

                <div className="user-interests">
                <h4>✨ Travel Interests</h4>
                <div className="interests-tags">
                    {user.travelInterests?.map((interest, index) => (
                    <span key={index} className="interest-tag">{interest}</span>
                    ))}
                </div>
                </div>

                <div className="recent-activity">
                <h4>🕒 Recent Activity</h4>
                {user.recentActivity?.slice(0, 3).map((activity, index) => (
                    <div key={index} className="activity-item">
                    {activity.type === 'photo' && '📸'}
                    {activity.type === 'review' && '✍️'}
                    {activity.type === 'visit' && '📍'}
                    {activity.description}
                    </div>
                ))}
                </div>
            </div>

            <div className="user-actions">
                {/* Temporary button to set up admin status - REMOVE AFTER USE */}
                <button
                    onClick={makeAdmin}
                    style={{
                        padding: '10px',
                        margin: '10px',
                        backgroundColor: '#ff4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Set Up Admin Status
                </button>
                <button 
                onClick={() => {
                    setSelectedUser(user);
                    setIsEditing(true);
                }}
                className="edit-btn"
                >
                ✏️ Edit
                </button>
                <button 
                onClick={() => handleDeleteUser(user.id)}
                className="delete-btn"
                >
                🗑️ Delete
                </button>
            </div>
            </div>
        ))}
        </div>
    )}

      {/* Edit User Modal */}
    {isEditing && selectedUser && (
        <div className="modal">
        <div className="modal-content">
            <h2>✏️ Edit User</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-section">
                    <h3>🔐 Account Information</h3>
                    <div className="form-group">
                        <label>Email:</label>
                        <input 
                            type="email" 
                            value={selectedUser.email || ''} 
                            readOnly 
                        />
                        <small>Email cannot be changed</small>
                    </div>
                    <div className="form-group">
                        <label>Authentication Methods:</label>
                        <div className="auth-methods">
                            <span className={selectedUser.googleAuth ? 'active' : ''}>
                                🔵 Google
                            </span>
                            <span className={selectedUser.facebookAuth ? 'active' : ''}>
                                📘 Facebook
                            </span>
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h3>👤 Profile Information</h3>
                    <div className="form-group">
                        <label>Profile Picture:</label>
                        <div className="profile-pic-container">
                            <img 
                                src={selectedUser.profilePicture || '/user.png'} 
                                alt="Profile" 
                                className="preview-pic"
                            />
                            <input 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => handleProfilePictureChange(e)}
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Traveler Name:</label>
                        <input 
                            type="text" 
                            value={selectedUser.name || ''} 
                            onChange={(e) => updateUserField('name', e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>Traveler Bio:</label>
                        <textarea 
                            value={selectedUser.bio || ''} 
                            onChange={(e) => updateUserField('bio', e.target.value)}
                        />
                    </div>
                </div>

                <div className="form-section">
                    <h3>✈️ Travel Interests</h3>
                    <div className="form-group">
                        <label>Select Interests:</label>
                        <div className="interests-container">
                            {['Adventure', 'Culture', 'Food', 'Nature', 'Photography', 'Relaxation', 'Shopping', 'Sightseeing'].map(interest => (
                                <label key={interest} className="interest-checkbox">
                                    <input 
                                        type="checkbox" 
                                        checked={(selectedUser.travelInterests || []).includes(interest)}
                                        onChange={(e) => handleInterestChange(interest, e.target.checked)}
                                    />
                                    {interest}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h3>📊 User Stats</h3>
                    <div className="stats-grid">
                        <div className="stat-item">
                            <label>Places Visited:</label>
                            <span>{selectedUser.placesVisited?.length || 0}</span>
                        </div>
                        <div className="stat-item">
                            <label>Photos Shared:</label>
                            <span>{selectedUser.photosShared?.length || 0}</span>
                        </div>
                        <div className="stat-item">
                            <label>Reviews Written:</label>
                            <span>{selectedUser.reviewsWritten?.length || 0}</span>
                        </div>
                        <div className="stat-item">
                            <label>Friends:</label>
                            <span>{selectedUser.friends?.length || 0}</span>
                        </div>
                        <div className="stat-item">
                            <label>Achievements:</label>
                            <span>{selectedUser.achievements?.length || 0}</span>
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h3>📸 Photo Gallery</h3>
                    <div className="gallery-grid">
                        {(selectedUser.photoGallery || []).map((photo, index) => (
                            <div key={index} className="gallery-item">
                                <img src={photo.url} alt={`Gallery ${index + 1}`} />
                                <button 
                                    type="button" 
                                    onClick={() => handleDeletePhoto(index)}
                                    className="delete-photo"
                                >
                                    🗑️
                                </button>
                            </div>
                        ))}
                        <div className="add-photo">
                            <input 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => handleAddPhoto(e)}
                                multiple
                            />
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h3>🕒 Recent Activity</h3>
                    <div className="activity-list">
                        {(selectedUser.recentActivity || []).map((activity, index) => (
                            <div key={index} className="activity-item">
                                {activity.type === 'photo' && '📸'}
                                {activity.type === 'review' && '✍️'}
                                {activity.type === 'visit' && '📍'}
                                {activity.description}
                                <button 
                                    type="button" 
                                    onClick={() => handleDeleteActivity(index)}
                                    className="delete-activity"
                                >
                                    🗑️
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="modal-actions">
                    <button type="submit" className="save-btn">💾 Save Changes</button>
                    <button 
                        type="button" 
                        onClick={() => setIsEditing(false)} 
                        className="cancel-btn"
                    >
                        ❌ Cancel
                    </button>

                    {/* Notification Component */}
                    {showNotification && (
                        <div
                            style={{
                                position: 'fixed',
                                bottom: '20px',
                                right: '20px',
                                background: notificationMessage.includes('Failed') ? '#fee2e2' : '#ecfdf5',
                                color: notificationMessage.includes('Failed') ? '#991b1b' : '#065f46',
                                padding: '12px 24px',
                                borderRadius: '8px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                zIndex: 1000,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                animation: 'slideIn 0.3s ease-out'
                            }}
                        >
                            <span>{notificationMessage.includes('Failed') ? '❌' : '✅'}</span>
                            {notificationMessage}
                        </div>
                    )}
                    <button 
                        type="button" 
                        onClick={() => handleDeleteUser(selectedUser.id)}
                        className="delete-btn"
                    >
                        🗑️ Delete User
                    </button>
                </div>
            </form>
        </div>
        </div>
    )}
    </div>
);
};

export default UserManagement;

