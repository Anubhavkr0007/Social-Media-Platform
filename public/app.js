const mainContent = document.getElementById('mainContent');
const logoutBtn = document.getElementById('logoutBtn');
const authTemplate = document.getElementById('auth-template');
const feedTemplate = document.getElementById('feed-template');

const storageKey = 'hiveup_token';
let authToken = localStorage.getItem(storageKey);
let currentUsername = '';
let activeView = 'login';

function setToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem(storageKey, token);
  } else {
    localStorage.removeItem(storageKey);
  }
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  headers['Content-Type'] = 'application/json';
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  const response = await fetch(`/api/${path}`, {
    ...options,
    headers,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'An unexpected error occurred');
  }
  return data;
}

function renderAuthScreen() {
  mainContent.innerHTML = '';
  const fragment = authTemplate.content.cloneNode(true);
  mainContent.appendChild(fragment);

  const authForm = document.getElementById('authForm');
  const showLogin = document.getElementById('showLogin');
  const showSignup = document.getElementById('showSignup');
  const usernameGroup = document.getElementById('usernameGroup');
  const authMessage = document.getElementById('authMessage');

  function updateView() {
    const isSignup = activeView === 'signup';
    showLogin.classList.toggle('active', !isSignup);
    showSignup.classList.toggle('active', isSignup);
    usernameGroup.classList.toggle('hidden', !isSignup);
    authForm.querySelector('button').textContent = isSignup ? 'Create account' : 'Log in';
    authMessage.textContent = '';
  }

  showLogin.addEventListener('click', () => {
    activeView = 'login';
    updateView();
  });
  showSignup.addEventListener('click', () => {
    activeView = 'signup';
    updateView();
  });

  authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    authMessage.textContent = '';
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      let result;
      if (activeView === 'signup') {
        if (!username) {
          throw new Error('Enter a display name to sign up.');
        }
        result = await api('signup', {
          method: 'POST',
          body: JSON.stringify({ username, email, password }),
        });
      } else {
        result = await api('login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
      }
      setToken(result.token);
      currentUsername = result.username;
      renderFeedScreen();
    } catch (error) {
      authMessage.textContent = error.message;
    }
  });

  updateView();
  logoutBtn.classList.add('hidden');
}

function createPostElement(post) {
  const card = document.createElement('article');
  card.className = 'post-item';

  const meta = document.createElement('div');
  meta.className = 'post-meta';
  meta.innerHTML = `<strong>${escapeHtml(post.author)}</strong><span>${new Date(post.createdAt).toLocaleString()}</span>`;

  const body = document.createElement('p');
  body.textContent = post.content;

  card.appendChild(meta);
  card.appendChild(body);
  return card;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function renderFeedScreen() {
  mainContent.innerHTML = '';
  const fragment = feedTemplate.content.cloneNode(true);
  mainContent.appendChild(fragment);

  logoutBtn.classList.remove('hidden');
  document.getElementById('welcomeTitle').textContent = `Hello, ${currentUsername || 'creator'} — share your next update.`;

  const postContent = document.getElementById('postContent');
  const postButton = document.getElementById('postButton');
  const postMessage = document.getElementById('postMessage');
  const refreshBtn = document.getElementById('refreshBtn');
  const feedList = document.getElementById('feedList');

  async function loadFeed() {
    feedList.innerHTML = '<p class="message">Loading posts...</p>';
    try {
      const posts = await api('posts');
      feedList.innerHTML = '';
      if (!posts.length) {
        feedList.innerHTML = '<p class="message">No posts yet — be the first to share.</p>';
      } else {
        posts.forEach((post) => feedList.appendChild(createPostElement(post)));
      }
    } catch (error) {
      feedList.innerHTML = `<p class="message">${escapeHtml(error.message)}</p>`;
    }
  }

  postButton.addEventListener('click', async () => {
    const content = postContent.value.trim();
    postMessage.textContent = '';
    if (!content) {
      postMessage.textContent = 'Write something before posting.';
      return;
    }
    postButton.disabled = true;
    try {
      await api('posts', { method: 'POST', body: JSON.stringify({ content }) });
      postContent.value = '';
      postMessage.textContent = 'Shared successfully!';
      loadFeed();
    } catch (error) {
      postMessage.textContent = error.message;
    } finally {
      postButton.disabled = false;
    }
  });

  refreshBtn.addEventListener('click', loadFeed);
  await loadFeed();
}

logoutBtn.addEventListener('click', () => {
  setToken(null);
  currentUsername = '';
  renderAuthScreen();
});

async function initializeApp() {
  if (!authToken) {
    renderAuthScreen();
    return;
  }

  try {
    const profile = await api('me');
    currentUsername = profile.username;
    renderFeedScreen();
  } catch (error) {
    setToken(null);
    renderAuthScreen();
  }
}

initializeApp();
