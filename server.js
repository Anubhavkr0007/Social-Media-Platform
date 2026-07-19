const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const DATA_PATH = path.join(__dirname, 'data.json');
const JWT_SECRET = process.env.JWT_SECRET || 'hiveup-secret';
const PORT = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function ensureDataFile() {
  try {
    await fs.access(DATA_PATH);
  } catch (error) {
    const initial = { users: [], posts: [] };
    await fs.writeFile(DATA_PATH, JSON.stringify(initial, null, 2), 'utf8');
  }
}

async function readData() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_PATH, 'utf8');
  return JSON.parse(raw);
}

async function writeData(data) {
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function createToken(user) {
  return jwt.sign({ id: user.id, username: user.username, email: user.email }, JWT_SECRET, {
    expiresIn: '7d',
  });
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token missing' });
  }

  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

app.post('/api/signup', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Please provide username, email, and password.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const data = await readData();

  if (data.users.some((user) => user.email === normalizedEmail)) {
    return res.status(409).json({ error: 'A user with that email already exists.' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: Date.now().toString(),
    username: username.trim(),
    email: normalizedEmail,
    passwordHash: hashedPassword,
  };

  data.users.push(newUser);
  await writeData(data);

  const token = createToken(newUser);
  res.json({ token, username: newUser.username });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide both email and password.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const data = await readData();
  const user = data.users.find((u) => u.email === normalizedEmail);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = createToken(user);
  res.json({ token, username: user.username });
});

app.get('/api/me', authMiddleware, async (req, res) => {
  res.json({ username: req.user.username, email: req.user.email });
});

app.get('/api/posts', async (req, res) => {
  const data = await readData();
  const feed = data.posts
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((post) => ({
      id: post.id,
      author: post.author,
      content: post.content,
      createdAt: post.createdAt,
    }));
  res.json(feed);
});

app.post('/api/posts', authMiddleware, async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Post content cannot be empty.' });
  }

  const data = await readData();
  const newPost = {
    id: Date.now().toString(),
    author: req.user.username,
    content: content.trim(),
    createdAt: Date.now(),
  };

  data.posts.push(newPost);
  await writeData(data);
  res.status(201).json(newPost);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Hiveup server listening on http://localhost:${PORT}`);
});
