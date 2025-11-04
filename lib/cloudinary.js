import { v2 as cloudinary } from "cloudinary";

// Cloudinary configuration
cloudinary.config({
  cloud_name: "doqc0aefh",
  api_key: "378363742539441",
  api_secret: "<your_api_secret>",
});

export async function uploadToCloudinary(filePath) {
  try {
    const uploadResult = await cloudinary.uploader.upload(filePath, {
      folder: "pgp_win_chat",
    });
    return uploadResult.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
}
