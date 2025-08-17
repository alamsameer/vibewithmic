import express from "express";
import multer from "multer";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import dotenv from "dotenv";
import fs from "fs";
import fsp from "fs/promises"; // <-- for async/await fs methods
import path from "path";
import serverless from "serverless-http";



// FFMPEG setup
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Initial setup
dotenv.config();
const app = express();
const UPLOADS_DIR = "/tmp"; // use /tmp on Vercel



// CORS middleware - Allow requests from your frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // Allow all origins, or specify your frontend URL
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});


// Ensure the uploads directory exists
(async () => {
  try {
    await fsp.mkdir(UPLOADS_DIR, { recursive: true });
  } catch (error) {
    console.error("Error creating uploads directory:", error);
    process.exit(1);
  }
})();

const upload = multer({ dest: `${UPLOADS_DIR}/` });

// Initialize the ElevenLabs client
const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

app.get("/", (req, res) => {
  res.send("Welcome to the ElevenLabs Speech-to-Text API!");
});

/**
 * POST /transcribe
 * Handles file uploads, converts them to MP3, and transcribes them.
 */
app.post("/transcribe", upload.single("file"), async (req, res) => {
  console.log("Received a file upload request.");
  if (!req.file) {
    return res.status(400).json({ error: "No file was uploaded." });
  }

  const originalFilePath = req.file.path;
  const convertedFilePath = `${originalFilePath}.mp3`;

  try {
    console.log(
      `Received file: ${req.file.originalname}. Starting conversion to MP3...`
    );

    // 1. Convert the uploaded file to MP3 using ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(originalFilePath)
        .toFormat("mp3")
        .audioCodec('libmp3lame')
        .audioBitrate(128)
        .audioChannels(1)
        .audioFrequency(22050)
        .on("end", () => {
          console.log("Conversion finished successfully.");
          resolve();
        })
        .on("error", (err) => {
          console.error("FFMPEG error:", err);
          reject(new Error("FFMPEG conversion failed."));
        })
        .save(convertedFilePath);
    });

    // 2. Transcribe the converted file using the ElevenLabs SDK
    console.log("Sending converted file to ElevenLabs for transcription...");

    // Read the file and convert to Blob (as per official documentation)
    const audioBuffer = await fsp.readFile(convertedFilePath);
    const audioBlob = new Blob([audioBuffer], { type: "audio/mp3" });


        const transcription = await elevenlabs.speechToText.convert({
      file: audioBlob,
      modelId: "scribe_v1", // Correct parameter name: modelId (not model_id)
      tagAudioEvents: true, // Tag audio events like laughter, applause, etc.
      languageCode: null, // Auto-detect the language of the audio file
      diarize: true, // Whether to annotate who is speaking
      responseFormat: "json", // Ensure response is in JSON format
    });

    console.log("Transcription successful.");
    console.log("Transcription result:", transcription.text || "No text found in transcription.");

    // 3. Send the transcription result back to the client
    res.status(200).json({
      success: true,
      transcription: transcription.text,
      originalFileName: req.file.originalname
    });

  } catch (error) {
    console.error("An error occurred in the transcription process:", error);
    
    // More detailed error logging
    if (error.statusCode) {
      console.error("Status Code:", error.statusCode);
    }
    if (error.body) {
      console.error("Error Body:", JSON.stringify(error.body, null, 2));
    }
    
    res.status(500).json({
      error: "Failed to process the audio file.",
      details: error.message,
      statusCode: error.statusCode || 500
    });
  } finally {
    // 4. IMPORTANT: Clean up both temporary files
    console.log("Cleaning up temporary files...");

    // Wait a tiny delay before cleanup to avoid deleting too soon
    setTimeout(async () => {
      try {
        if (fs.existsSync(originalFilePath)) {
          await fsp.unlink(originalFilePath);
          console.log(`Deleted original file: ${originalFilePath}`);
        }
      } catch (err) {
        console.error(`Failed to delete original file: ${originalFilePath}`, err);
      }
      
      try {
        if (fs.existsSync(convertedFilePath)) {
          await fsp.unlink(convertedFilePath);
          console.log(`Deleted converted file: ${convertedFilePath}`);
        }
      } catch (err) {
        if (err.code !== "ENOENT") {
          console.error(`Failed to delete converted file: ${convertedFilePath}`, err);
        }
      }
    }, 1000);
  }
});

// Add error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});


// Export for Vercel
export const handler = serverless(app);

// Run locally if not on Vercel
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
}