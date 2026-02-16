import api from './axiosConfig';

export const uploadService = {
  // Upload single image
  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);

    const response = await api.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },

  // Upload multiple images
  uploadMultipleImages: async (files) => {
    const formData = new FormData();
    
    // Append all files
    for (let i = 0; i < files.length; i++) {
      formData.append('images', files[i]);
    }

    const response = await api.post('/api/upload/multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },

  // Delete image by public ID
  deleteImage: async (publicId) => {
    const response = await api.delete(`/api/upload/${encodeURIComponent(publicId)}`);
    return response.data;
  },

  // Helper: Get full image URL
  // With Cloudinary, imageUrl is already a full URL, but we keep backward compatibility
  getImageUrl: (imageUrl) => {
    if (!imageUrl) return '';
    // Cloudinary URLs are already full URLs
    if (imageUrl.startsWith('http')) return imageUrl;
    
    // Fallback for old local URLs (backward compatibility)
    const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    return `${baseURL}${imageUrl}`;
  },
};