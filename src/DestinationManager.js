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

  // Define handleSubmit first
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let imageUrl = '';
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
        tags: formData.tags.split(',').map(tag => tag.trim()),
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

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        image: file,
        imagePreview: URL.createObjectURL(file)
      }));
    }
  };

  const handleTagsChange = (e) => {
    const tags = e.target.value.split(',').map(tag => tag.trim());
    setFormData(prev => ({
      ...prev,
      tags
    }));
  };

  const uploadImage = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'lakbai_preset');
    formData.append('cloud_name', 'dxvewejox');

    try {
      const response = await fetch(
        'https://api.cloudinary.com/v1_1/dxvewejox/image/upload',
        {
          method: 'POST',
          body: formData
        }
      );
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.secure_url;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

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
        await deleteDoc(doc(db, 'destinations', id));
        await fetchDestinations();
        alert('Destination deleted successfully');
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