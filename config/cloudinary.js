const cloudinary = require('cloudinary').v2;

// This pulls your credentials securely from your .env file
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// A quick check to verify the credentials loaded (optional but helpful for debugging)
if (process.env.CLOUDINARY_CLOUD_NAME) {
    console.log(" Cloudinary Configuration Loaded");
} else {
    console.log(" Warning: Cloudinary environment variables are missing!");
}

module.exports = cloudinary;