import 'dotenv/config'; // loads .env automatically (or use require('dotenv').config() for CommonJS)
import Replicate from "replicate";

// Use REPLICATE_API_TOKEN from environment
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const { prompt, aspect_ratio, safety_filter_level } = req.body;
  try {
    const output = await replicate.run("google/imagen-4", {
      input: { prompt, aspect_ratio, safety_filter_level }
    });
    // output may be a URL or an object with a url property
    const url = typeof output === "string" ? output : output.url ? output.url : output[0];
    res.status(200).json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
