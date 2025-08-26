import express from 'express';
import axios from 'axios';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import session from 'express-session';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// In-memory user storage (replace with database in production)
const users = new Map();
const userScans = new Map();

// Basic security & parsers
app.use(cors({
  origin: 'http://localhost:8080',
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

// Session middleware
app.use(session({
  secret: JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve static frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Config & API keys
const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY || '7a4dcef2ab3418416fd16a73f14cceeca569b0f3077b56351e4a0bb2d52aecb9';

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Authentication routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }
    
    if (users.has(email)) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = Date.now().toString();
    
    users.set(email, {
      id: userId,
      email,
      password: hashedPassword,
      name,
      createdAt: new Date().toISOString()
    });
    
    userScans.set(userId, []);
    
    req.session.userId = userId;
    
    res.json({ 
      message: 'User registered successfully',
      user: { id: userId, email, name }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const user = users.get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    req.session.userId = user.id;
    
    res.json({ 
      message: 'Login successful',
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logout successful' });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (req.session.userId) {
    const user = Array.from(users.values()).find(u => u.id === req.session.userId);
    if (user) {
      res.json({ 
        user: { id: user.id, email: user.email, name: user.name }
      });
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// User scan history
app.get('/api/user/scans', requireAuth, (req, res) => {
  const scans = userScans.get(req.session.userId) || [];
  res.json({ scans });
});

// Analyze a URL using VirusTotal only
app.post('/api/analyze/url', requireAuth, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing url string' });
    }

    // VirusTotal URL analysis (v3)
    let vtAnalysis = null;
    try {
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

      if (vtId) {
        // Poll result (simple single fetch; VT typically processes quickly)
        const vtAnalysisResponse = await axios.get(
          `https://www.virustotal.com/api/v3/analyses/${vtId}`,
          { headers: { 'x-apikey': VIRUSTOTAL_API_KEY } }
        );
        vtAnalysis = vtAnalysisResponse?.data?.data || null;
      }
    } catch (vtError) {
      console.log('VirusTotal error:', vtError?.response?.data || vtError.message);
      res.status(500).json({ error: 'VirusTotal analysis failed', details: vtError?.response?.data || vtError.message });
      return;
    }

    const scanResult = {
      url,
      virusTotal: vtAnalysis,
      timestamp: new Date().toISOString(),
      userId: req.session.userId
    };

    // Save scan to user history
    const userScansList = userScans.get(req.session.userId) || [];
    userScansList.unshift(scanResult);
    userScans.set(req.session.userId, userScansList.slice(0, 50)); // Keep last 50 scans

    res.json(scanResult);
  } catch (error) {
    console.error('URL analysis error:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to analyze URL', details: error?.response?.data || error.message });
  }
});

// Analyze an email for potential phishing indicators
app.post('/api/analyze/email', requireAuth, async (req, res) => {
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

    const emailResult = {
      emailText: emailText.substring(0, 200) + (emailText.length > 200 ? '...' : ''),
      extractedUrls: uniqueUrls,
      analyses,
      timestamp: new Date().toISOString(),
      userId: req.session.userId
    };

    // Save email analysis to user history
    const userScansList = userScans.get(req.session.userId) || [];
    userScansList.unshift(emailResult);
    userScans.set(req.session.userId, userScansList.slice(0, 50)); // Keep last 50 scans

    res.json(emailResult);
  } catch (error) {
    console.error('Email analysis error:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Failed to analyze email', details: error?.response?.data || error.message });
  }
});

// Fallback to index.html for root
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
