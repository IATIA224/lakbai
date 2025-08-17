import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import './Styles/destinationManager.css';

function DestinationManager() {
  const [destinations, setDestinations] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    rating: 0,
    price: '',
    location: '',
    bestTime: '',
    tags: '',
    image: null,
    imagePreview: null
  });

  // Update the uploadImage function with better error handling and logging
  const uploadImage = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'lakbai_preset'); // Make sure this matches your Cloudinary preset name
    formData.append('cloud_name', 'dxvewejox');

    try {
      console.log('Starting image upload to Cloudinary...');
      const response = await fetch(
        'https://api.cloudinary.com/v1_1/dxvewejox/image/upload',
        {
          method: 'POST',
          body: formData
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Cloudinary upload failed:', data);
        throw new Error(data.error?.message || 'Failed to upload image');
      }

      if (!data.secure_url) {
        console.error('No secure URL in Cloudinary response:', data);
        throw new Error('Invalid response from image upload');
      }

      console.log('Image uploaded successfully:', data.secure_url);
      return data.secure_url;

    } catch (error) {
      console.error('Upload error details:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  };

  // Define handleSubmit first
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let imageUrl = '';
      
      if (formData.image) {
        try {
          imageUrl = await uploadImage(formData.image);
          console.log('Image uploaded successfully, URL:', imageUrl);
        } catch (imageError) {
          console.error('Image upload failed:', imageError);
          alert('Failed to upload image. Please try again.');
          return;
        }
      }

      // Convert tags to array safely
      const tagsArray = typeof formData.tags === 'string' 
        ? formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '')
        : Array.isArray(formData.tags) 
          ? formData.tags 
          : [];

      const destinationData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        rating: parseFloat(formData.rating) || 0,
        price: formData.price.trim(),
        location: formData.location.trim(),
        bestTime: formData.bestTime.trim(),
        tags: tagsArray,
        image: imageUrl,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'destinations'), destinationData);
      await fetchDestinations();
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        rating: 0,
        price: '',
        location: '',
        bestTime: '',
        tags: '',
        image: null,
        imagePreview: null
      });

      alert('Destination added successfully!');
    } catch (error) {
      console.error('Error adding destination:', error);
      alert(error.message || 'Error adding destination');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Update the handleImageChange function to better handle previews
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      // Validate file size (e.g., max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        alert('Image size should be less than 5MB');
        return;
      }

      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      
      setFormData(prev => ({
        ...prev,
        image: file,
        imagePreview: previewUrl
      }));

      // Clean up the preview URL when component unmounts
      return () => URL.revokeObjectURL(previewUrl);
    }
  };

  const handleTagsChange = (e) => {
    const tagsValue = e.target.value;
    setFormData(prev => ({
      ...prev,
      tags: tagsValue // Store as string in form state
    }));
  };

  // Fetch destinations
  const fetchDestinations = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'destinations'));
      const destinationsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDestinations(destinationsList);
    } catch (error) {
      console.error('Error fetching destinations:', error);
      alert('Error loading destinations');
    }
  };

  // Load destinations on component mount
  useEffect(() => {
    fetchDestinations();
  }, []);

  const handleEdit = (destination) => {
    setIsEditing(true);
    setEditingId(destination.id);
    setFormData({
      name: destination.name,
      description: destination.description,
      rating: destination.rating,
      price: destination.price,
      location: destination.location,
      bestTime: destination.bestTime,
      tags: Array.isArray(destination.tags) ? destination.tags.join(', ') : destination.tags,
      image: null,
      imagePreview: destination.image
    });
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this destination?')) {
      try {
        // First, get the destination data to access the image URL
        const destinationToDelete = destinations.find(dest => dest.id === id);
        
        if (destinationToDelete && destinationToDelete.image) {
          // Delete the image from Cloudinary
          try {
            await deleteImageFromCloudinary(destinationToDelete.image);
            console.log('Image deleted from Cloudinary successfully');
          } catch (imageError) {
            console.error('Error deleting image:', imageError);
            // Continue with destination deletion even if image deletion fails
          }
        }

        // Delete the destination from Firestore
        await deleteDoc(doc(db, 'destinations', id));
        
        // Refresh the destinations list
        await fetchDestinations();
        alert('Destination and associated image deleted successfully');
      } catch (error) {
        console.error('Error deleting destination:', error);
        alert('Error deleting destination');
      }
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      let imageUrl = formData.imagePreview;
      
      if (formData.image) {
        imageUrl = await uploadImage(formData.image);
      }

      const destinationData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        rating: parseFloat(formData.rating) || 0,
        price: formData.price.trim(),
        location: formData.location.trim(),
        bestTime: formData.bestTime.trim(),
        tags: Array.isArray(formData.tags) ? formData.tags : formData.tags.split(',').map(tag => tag.trim()),
        image: imageUrl,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'destinations', editingId), destinationData);
      setIsEditing(false);
      setEditingId(null);
      await fetchDestinations();
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        rating: 0,
        price: '',
        location: '',
        bestTime: '',
        tags: '',
        image: null,
        imagePreview: null
      });

      alert('Destination updated successfully!');
    } catch (error) {
      console.error('Error updating destination:', error);
      alert(error.message || 'Error updating destination');
    }
  };

  const deleteImageFromCloudinary = async (imageUrl) => {
    try {
      // Extract public_id from the Cloudinary URL
      const urlParts = imageUrl.split('/');
      const filenameWithExtension = urlParts[urlParts.length - 1];
      const public_id = filenameWithExtension.split('.')[0];

      const timestamp = new Date().getTime();
      const data = new FormData();
      data.append('public_id', public_id);
      data.append('api_key', 'your_cloudinary_api_key');
      data.append('timestamp', timestamp);
      // Generate signature - you'll need to implement this securely
      // data.append('signature', generateSignature(public_id, timestamp));

      const response = await fetch(
        'https://api.cloudinary.com/v1_1/dxvewejox/image/destroy',
        {
          method: 'POST',
          body: data,
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete image: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting image from Cloudinary:', error);
      throw error;
    }
  };

  return (
    <div className="destination-manager">
      <h2>{isEditing ? 'Edit Destination' : 'Add New Destination'}</h2>
      
      <form onSubmit={isEditing ? handleUpdate : handleSubmit} className="destination-form">
        <div className="form-group">
          <label>Name:</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Description:</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Rating:</label>
          <input
            type="number"
            name="rating"
            min="0"
            max="5"
            step="0.1"
            value={formData.rating}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Price Range:</label>
          <input
            type="text"
            name="price"
            placeholder="₱1,000 - ₱5,000"
            value={formData.price}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Location:</label>
          <input
            type="text"
            name="location"
            value={formData.location}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Best Time to Visit:</label>
          <input
            type="text"
            name="bestTime"
            placeholder="Nov - May"
            value={formData.bestTime}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Tags (comma-separated):</label>
          <input
            type="text"
            name="tags"
            placeholder="Nature, Adventure, Photography"
            value={formData.tags}
            onChange={handleTagsChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Image:</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            required
          />
          {formData.imagePreview && (
            <img
              src={formData.imagePreview}
              alt="Preview"
              className="image-preview"
            />
          )}
        </div>

        <button type="submit" className="submit-btn">
          {isEditing ? 'Update Destination' : 'Add Destination'}
        </button>
        
        {isEditing && (
          <button 
            type="button" 
            className="cancel-btn"
            onClick={() => {
              setIsEditing(false);
              setEditingId(null);
              setFormData({
                name: '',
                description: '',
                rating: 0,
                price: '',
                location: '',
                bestTime: '',
                tags: '',
                image: null,
                imagePreview: null
              });
            }}
          >
            Cancel Edit
          </button>
        )}
      </form>

      <div className="destinations-list">
        <h3>Current Destinations</h3>
        {destinations.map((destination) => (
          <div key={destination.id} className="destination-item">
            <img 
              src={destination.image} 
              alt={destination.name} 
              className="destination-thumbnail"
              onError={(e) => {
                console.error(`Failed to load image for ${destination.name}`);
                e.target.src = '/placeholder-image.jpg'; // Add a placeholder image
                e.target.onerror = null; // Prevent infinite loop
              }}
            />
            <div className="destination-info">
              <h4>{destination.name}</h4>
              <p>{destination.description}</p>
              <div className="destination-meta">
                <span>Rating: {destination.rating}</span>
                <span>Price: {destination.price}</span>
              </div>
            </div>
            <div className="destination-actions">
              <button 
                onClick={() => handleEdit(destination)}
                className="edit-btn"
              >
                Edit
              </button>
              <button 
                onClick={() => handleDelete(destination.id)}
                className="delete-btn"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DestinationManager;