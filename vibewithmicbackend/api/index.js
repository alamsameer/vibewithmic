import express from "express";
import multer from "multer";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import dotenv from "dotenv";
import fs from "fs";
import fsp from "fs/promises"; // <-- for async/await fs methods
import cors from "cors";
import { systemPrompt,exampleResponse,combinedPrompt } from "../utils/prompt.js";
import { extractJsonFromResponse, writeandAppendJsonToFile } from "../utils/json_utils.js";
import { GoogleGenAI } from "@google/genai";
// FFMPEG setup
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { json } from "stream/consumers";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Initial setup
dotenv.config();
const app = express();
const UPLOADS_DIR = "/tmp/"; // use /tmp on Vercel

app.use(cors({
  origin: "*", // Allow all domains
  methods: "GET,POST,PUT,DELETE,OPTIONS",
  allowedHeaders: "Origin,X-Requested-With,Content-Type,Accept,Authorization",
  credentials: false // Should be false when origin is "*"
}));

app.options("*", cors());
const ai = new GoogleGenAI({});
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
          // await fsp.unlink(originalFilePath);
          console.log(`Deleted original file: ${originalFilePath}`);
        }
      } catch (err) {
        console.error(`Failed to delete original file: ${originalFilePath}`, err);
      }
      
      try {
        if (fs.existsSync(convertedFilePath)) {
          // await fsp.unlink(convertedFilePath);
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

app.get("/genai", async (req, res) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${combinedPrompt}`,
    });
    console.log("GenAI response:", response.text);
    const json = extractJsonFromResponse(response.text);
    writeandAppendJsonToFile(json);
    res.status(200).json({ response: json.toString(response) });
  } catch (error) {
    console.error("Error in /genai route:", error);

    res.status(500).json({ error: "Failed to generate content", details: error.message });
  }
});

app.post("/transcribe-and-generate", upload.single("file"), async (req, res) => {
  console.log("Received a file upload request.");
  if (!req.file) {
    return res.status(400).json({ error: "No file was uploaded." });
  }

  const originalFilePath = req.file.path;
  const convertedFilePath = `${originalFilePath}.mp3`;

  try {
    console.log(`Received file: ${req.file.originalname}. Starting conversion to MP3...`);

    // 1. Convert uploaded file to MP3
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

    // 2. Transcribe converted file using ElevenLabs
    console.log("Sending converted file to ElevenLabs for transcription...");
    const audioBuffer = await fsp.readFile(convertedFilePath);
    const audioBlob = new Blob([audioBuffer], { type: "audio/mp3" });

    const transcription = await elevenlabs.speechToText.convert({
      file: audioBlob,
      modelId: "scribe_v1",
      tagAudioEvents: true,
      languageCode: null,
      diarize: true,
      responseFormat: "json",
    });

    console.log("Transcription successful:", transcription.text || "No text found");

    // 3. Generate content using AI based on transcription
      const  combinedPromptByuser=`${systemPrompt}\n\n${transcription.text}\n\nPlease provide your analysis in the specified JSON format. Here is an example of the expected output:\n\n${exampleResponse}`
      console.log("Combined Prompt for GenAI:", combinedPrompt);
    const aiResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: combinedPromptByuser,
    });

    console.log("GenAI response:", aiResponse.text);

    const json = extractJsonFromResponse(aiResponse.text);
    writeandAppendJsonToFile(json);

    // 4. Return both transcription and generated content
    res.status(200).json({
      success: true,
      originalFileName: req.file.originalname,
      transcription: transcription.text,
      generatedContent: json,
    });

  } catch (error) {
    console.error("Error occurred:", error);
    res.status(500).json({
      error: "Failed to process the audio file and generate content.",
      details: error.message,
      statusCode: error.statusCode || 500
    });
  } finally {
    // 5. Cleanup temporary files
    console.log("Cleaning up temporary files...");
    setTimeout(async () => {
      try { if (fs.existsSync(originalFilePath)) console.log(`Deleted original file: ${originalFilePath}`); } catch (err) { console.error(err); }
      try { if (fs.existsSync(convertedFilePath)) console.log(`Deleted converted file: ${convertedFilePath}`); } catch (err) { if (err.code !== "ENOENT") console.error(err); }
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


// export const handler = serverless(app);
app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});

export default app;
