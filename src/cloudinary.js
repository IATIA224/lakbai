import { CloudinaryContext, Image, Video } from 'cloudinary-react';

const config = {
  cloudName: process.env.REACT_APP_CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.REACT_APP_CLOUDINARY_API_KEY,
  apiSecret: process.env.REACT_APP_CLOUDINARY_API_SECRET,
  secure: true
};

export { CloudinaryContext, Image, Video, config };