import asyncHandler from '../middleware/asyncHandler.js';
import { cloudinary } from '../config/cloudinary.js';

// @desc    Upload single image
// @route   POST /api/upload
// @access  Private
export const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('No file uploaded');
  }

  // Cloudinary returns the URL in req.file.path
  res.status(200).json({
    message: 'Image uploaded successfully',
    imageUrl: req.file.path, // Full Cloudinary URL
    publicId: req.file.filename, // Cloudinary public ID for deletion
    mimetype: req.file.mimetype,
    size: req.file.size
  });
});

// @desc    Upload multiple images
// @route   POST /api/upload/multiple
// @access  Private
export const uploadMultipleImages = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    res.status(400);
    throw new Error('No files uploaded');
  }

  const imageUrls = req.files.map(file => ({
    imageUrl: file.path, // Full Cloudinary URL
    publicId: file.filename, // Cloudinary public ID
    mimetype: file.mimetype,
    size: file.size
  }));

  res.status(200).json({
    message: 'Images uploaded successfully',
    images: imageUrls
  });
});

// @desc    Delete an image
// @route   DELETE /api/upload/:publicId
// @access  Private
export const deleteImage = asyncHandler(async (req, res) => {
  const { publicId } = req.params;
  
  try {
    // Delete from Cloudinary using public ID
    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result === 'ok') {
      res.status(200).json({
        message: 'Image deleted successfully',
        publicId
      });
    } else if (result.result === 'not found') {
      res.status(404);
      throw new Error('Image not found');
    } else {
      res.status(500);
      throw new Error('Failed to delete image');
    }
  } catch (error) {
    res.status(500);
    throw new Error(`Failed to delete image: ${error.message}`);
  }
});