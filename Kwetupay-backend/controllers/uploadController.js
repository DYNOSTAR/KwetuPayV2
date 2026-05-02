const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'property-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No image file provided'
      });
    }

    // For local storage, return the file path
    const imageUrl = `/uploads/${req.file.filename}`;

    res.status(200).json({
      status: 'success',
      data: {
        imageUrl: imageUrl,
        publicId: req.file.filename
      }
    });

  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to upload image'
    });
  }
};

module.exports = {
  upload,
  uploadImage
};