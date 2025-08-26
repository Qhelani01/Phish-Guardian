import express from 'express';
import axios from 'axios';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Basic security & parsers
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Config & API keys
const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY || '7a4dcef2ab3418416fd16a73f14cceeca569b0f3077b56351e4a0bb2d52aecb9';
const URLSCAN_API_KEY = process.env.URLSCAN_API_KEY || '0198dd31-3568-724b-94f7-f12ee643de82';

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Analyze a URL using VirusTotal and URLScan
app.post('/api/analyze/url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing url string' });
    }

    // VirusTotal URL analysis (v3)
    const vtHeaders = {
      'x-apikey': VIRUSTOTAL_API_KEY,
      'content-type': 'application/x-www-form-urlencoded',
    };

    // Submit URL for analysis
    const vtSubmitResponse = await axios.post(
      'https://www.virustotal.com/api/v3/urls',
      new URLSearchParams({ url }).toString(),
      { headers: vtHeaders }
    );
    const vtId = vtSubmitResponse?.data?.data?.id;

    let vtAnalysis = null;
    if (vtId) {
      // Poll result (simple single fetch; VT typically processes quickly)
      const vtAnalysisResponse = await axios.get(
        `https://www.virustotal.com/api/v3/analyses/${vtId}`,
        { headers: { 'x-apikey': VIRUSTOTAL_API_KEY } }
      );
      vtAnalysis = vtAnalysisResponse?.data?.data || null;
    }

    // URLScan quick scan (submission)
    const urlscanSubmit = await axios.post(
      'https://urlscan.io/api/v1/scan/',
      { url, visibility: 'private' },
      { headers: { 'API-Key': URLSCAN_API_KEY, 'Content-Type': 'application/json' } }
    );

    // We can optionally fetch the result using the result endpoint
    const urlscanUuid = urlscanSubmit?.data?.uuid;
    let urlscanResult = null;
    if (urlscanUuid) {
      try {
        // A short wait is often required; here we attempt one fetch without delay to keep UX snappy
        const urlscanGet = await axios.get(`https://urlscan.io/api/v1/result/${urlscanUuid}/`);
        urlscanResult = urlscanGet.data;
      } catch (_) {
        // If not ready, return submission details; frontend can show pending state
        urlscanResult = { pending: true, uuid: urlscanUuid, message: 'Result not ready yet. Try again shortly.' };
      }
    }

    res.json({
      virusTotal: vtAnalysis,
      urlscan: urlscanResult || urlscanSubmit.data,
    });
  } catch (error) {
    console.error('URL analysis error:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to analyze URL', details: error?.response?.data || error.message });
  }
});

// Analyze an email for potential phishing indicators using VirusTotal domain/IP/URL intel.
// This is heuristic: extract URLs/domains from the email text and analyze them.
app.post('/api/analyze/email', async (req, res) => {
  try {
    const { emailText } = req.body;
    if (!emailText || typeof emailText !== 'string') {
      return res.status(400).json({ error: 'Missing emailText string' });
    }

    // Simple extraction of URLs/domains from text
    const urlRegex = /(https?:\/\/[^\s<>\)\]]+)|(www\.[^\s<>\)\]]+)/gi;
    const found = emailText.match(urlRegex) || [];
    const uniqueUrls = Array.from(new Set(found)).slice(0, 5); // limit to 5

    const analyses = [];
    for (const candidate of uniqueUrls) {
      try {
        const normalized = candidate.startsWith('http') ? candidate : `http://${candidate}`;

        // VirusTotal URL submission
        const vtSubmit = await axios.post(
          'https://www.virustotal.com/api/v3/urls',
          new URLSearchParams({ url: normalized }).toString(),
          { headers: { 'x-apikey': VIRUSTOTAL_API_KEY, 'content-type': 'application/x-www-form-urlencoded' } }
        );
        const vtId = vtSubmit?.data?.data?.id;
        let vtData = null;
        if (vtId) {
          const vtResult = await axios.get(`https://www.virustotal.com/api/v3/analyses/${vtId}`,
            { headers: { 'x-apikey': VIRUSTOTAL_API_KEY } });
          vtData = vtResult?.data?.data || null;
        }

        analyses.push({ url: normalized, virusTotal: vtData });
      } catch (innerErr) {
        analyses.push({ url: candidate, error: innerErr?.response?.data || innerErr.message });
      }
    }

    res.json({ extractedUrls: uniqueUrls, analyses });
  } catch (error) {
    console.error('Email analysis error:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to analyze email', details: error?.response?.data || error.message });
  }
});

// Fallback to index.html for root
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


