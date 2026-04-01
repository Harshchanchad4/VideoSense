const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

/**
 * Sightengine video sensitivity analyzer.
 *
 * Models used:
 *   nudity-2.1   — nudity and adult content (29 classes)
 *   violence     — violence and weapons
 *   offensive    — hate symbols, offensive gestures
 *   gore-2.0     — blood and gore
 *
 * Free tier: 500 operations/month — no credit card required.
 * Sign up at https://sightengine.com to get api_user + api_secret.
 *
 * Falls back to random classification if credentials are not configured,
 * so the app still works locally without a Sightengine account.
 */

const SIGHTENGINE_ENDPOINT = 'https://api.sightengine.com/1.0/video/check-sync.json';
const MODELS = 'nudity-2.1,violence,offensive,gore-2.0';

// Thresholds — if any frame exceeds these scores, the video is flagged
const THRESHOLDS = {
  nudity: 0.6,   // nudity-2.1: raw / partial scores
  violence: 0.7,
  offensive: 0.7,
  gore: 0.7,
};

/**
 * Parse Sightengine frames and decide safe/flagged.
 * Returns { result: 'safe'|'flagged', reason: string|null, details: object }
 */
const parseFrames = (frames) => {
  let maxNudity = 0;
  let maxViolence = 0;
  let maxOffensive = 0;
  let maxGore = 0;

  for (const frame of frames) {
    // nudity-2.1 returns nested scores; raw/partial are the sensitive ones
    if (frame.nudity) {
      const n = frame.nudity;
      const nudityScore = Math.max(
        n.raw ?? 0,
        n.partial ?? 0,
        n.sexual_activity ?? 0,
        n.suggestive ?? 0
      );
      if (nudityScore > maxNudity) maxNudity = nudityScore;
    }

    if (frame.violence?.prob != null && frame.violence.prob > maxViolence) {
      maxViolence = frame.violence.prob;
    }

    if (frame.offensive?.prob != null && frame.offensive.prob > maxOffensive) {
      maxOffensive = frame.offensive.prob;
    }

    if (frame.gore?.prob != null && frame.gore.prob > maxGore) {
      maxGore = frame.gore.prob;
    }
  }

  const details = {
    nudity: +maxNudity.toFixed(3),
    violence: +maxViolence.toFixed(3),
    offensive: +maxOffensive.toFixed(3),
    gore: +maxGore.toFixed(3),
  };

  let reason = null;
  if (maxNudity >= THRESHOLDS.nudity) reason = 'nudity';
  else if (maxViolence >= THRESHOLDS.violence) reason = 'violence';
  else if (maxOffensive >= THRESHOLDS.offensive) reason = 'offensive content';
  else if (maxGore >= THRESHOLDS.gore) reason = 'gore';

  return { result: reason ? 'flagged' : 'safe', reason, details };
};

/**
 * Analyze a video file using the Sightengine API.
 * Returns 'safe' or 'flagged'.
 */
const analyzeWithSightengine = async (videoDoc) => {
  const apiUser = process.env.SIGHTENGINE_API_USER;
  const apiSecret = process.env.SIGHTENGINE_API_SECRET;

  // Resolve to absolute path so fs.createReadStream works regardless of CWD
  const absolutePath = path.isAbsolute(videoDoc.filePath)
    ? videoDoc.filePath
    : path.resolve(process.cwd(), videoDoc.filePath);

  console.log(`[Sightengine] Sending file: ${absolutePath}`);
  console.log(`[Sightengine] api_user: ${apiUser}`);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found at path: ${absolutePath}`);
  }

  const form = new FormData();
  form.append('media', fs.createReadStream(absolutePath));
  form.append('models', MODELS);
  form.append('api_user', apiUser);
  form.append('api_secret', apiSecret);

  let response;
  try {
    response = await axios.post(SIGHTENGINE_ENDPOINT, form, {
      headers: form.getHeaders(),
      timeout: 120000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
  } catch (axiosErr) {
    // Axios throws on 4xx/5xx — log the actual Sightengine error body
    if (axiosErr.response) {
      console.error('[Sightengine] HTTP', axiosErr.response.status, JSON.stringify(axiosErr.response.data));
      throw new Error(`Sightengine HTTP ${axiosErr.response.status}: ${JSON.stringify(axiosErr.response.data)}`);
    }
    throw axiosErr;
  }

  console.log('[Sightengine] Raw response:', JSON.stringify(response.data));

  const { status, data } = response.data;

  if (status !== 'success') {
    throw new Error(`Sightengine returned status: ${status} — ${JSON.stringify(response.data)}`);
  }

  const frames = data?.frames ?? [];
  if (frames.length === 0) {
    console.warn('[Sightengine] No frames returned — marking as safe.');
    return { result: 'safe', reason: null, details: {} };
  }

  const parsed = parseFrames(frames);
  console.log(`[Sightengine] Result for "${videoDoc.title}":`, parsed);
  return parsed;
};

/**
 * Fallback: random classification used when Sightengine is not configured.
 */
const analyzeRandom = (videoDoc) => {
  return new Promise((resolve) => {
    const flaggedProbability = parseFloat(process.env.FLAGGED_PROBABILITY) || 0.3;
    const delay = parseInt(process.env.PROCESSING_DELAY_MS) || 1000;
    setTimeout(() => {
      const result = Math.random() < flaggedProbability ? 'flagged' : 'safe';
      console.log(`[FALLBACK] Random sensitivity result for "${videoDoc.title}": ${result}`);
      resolve({ result, reason: result === 'flagged' ? 'simulated' : null, details: {} });
    }, delay);
  });
};

/**
 * Main export — called by videoProcessor.js.
 * Returns { result: 'safe'|'flagged', reason: string|null, details: object }
 */
const analyze = async (videoDoc) => {
  const apiUser = process.env.SIGHTENGINE_API_USER;
  const apiSecret = process.env.SIGHTENGINE_API_SECRET;

  if (!apiUser || !apiSecret || apiUser === 'your_api_user_here') {
    console.warn('Sightengine credentials not set — using random fallback.');
    return analyzeRandom(videoDoc);
  }

  try {
    return await analyzeWithSightengine(videoDoc);
  } catch (err) {
    console.error('Sightengine API error — falling back to random:', err.message);
    return analyzeRandom(videoDoc);
  }
};

module.exports = { analyze };
