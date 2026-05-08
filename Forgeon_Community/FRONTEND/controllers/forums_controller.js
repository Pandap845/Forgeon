const USER_KEY = 'forgeonCurrentUser';
const MIN_LEVEL_CREATE_FORUM = 5;

let forumCreationEligibility = { canCreate: true, level: null };

function getCurrentUserId() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return String((parsed && (parsed.id || parsed._id)) || '');
  } catch (_error) {
    return '';
  }
}

function applyForumCreationUiState() {
  const triggerBtn = document.querySelector('[data-bs-target="#createForumModal"]');
  const createBtn = document.getElementById('createForumBtn');
  const canCreate = Boolean(forumCreationEligibility.canCreate);

  [triggerBtn, createBtn].forEach((btn) => {
    if (!btn) return;
    if (canCreate) {
      btn.style.pointerEvents = '';
      btn.style.opacity = '';
      btn.removeAttribute('aria-disabled');
    } else {
      btn.style.pointerEvents = 'none';
      btn.style.opacity = '0.5';
      btn.setAttribute('aria-disabled', 'true');
    }
  });
}

async function resolveForumCreationEligibility() {
  const userId = getCurrentUserId();
  if (!userId || !window.ForgeonUsersController || !window.ForgeonUsersController.getById) {
    forumCreationEligibility = { canCreate: true, level: null };
    applyForumCreationUiState();
    return;
  }

  try {
    const user = await window.ForgeonUsersController.getById(userId);
    const level = parseInt(user && user.level, 10) || 1;
    forumCreationEligibility = { canCreate: level >= MIN_LEVEL_CREATE_FORUM, level };
  } catch (_error) {
    forumCreationEligibility = { canCreate: true, level: null };
  }

  applyForumCreationUiState();
}

async function loadForums() {
  try {
    const res = await fetch('/api/forums', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load forums');
    const forums = await res.json();
    const container = document.getElementById('forumsList');
    container.innerHTML = '';
    if (!forums.length) {
      container.innerHTML = '<div class="forgeon-card p-3">No forums yet. Be the first to create one!</div>';
      return;
    }

    forums.forEach(f => {
      const el = document.createElement('article');
      el.className = 'feed-post d-flex gap-2';
      el.innerHTML = `
        <div class="post-card flex-grow-1 p-3 position-relative">
          <div class="post-meta mb-2">${new Date(f.createdAt).toLocaleString()}</div>
          <h2 class="post-title mb-0"><a href="./forumpage.html?forum=${encodeURIComponent(f.slug)}" class="stretched-link text-decoration-none text-white">${escapeHtml(f.name)}</a></h2>
          <div class="mt-2 text-muted-2">${escapeHtml(f.description || '')}</div>
        </div>
      `;
      container.appendChild(el);
    });
  } catch (err) {
    console.error(err);
  }
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[s]));
}

async function createForum() {
  if (!forumCreationEligibility.canCreate) {
    const lvl = forumCreationEligibility.level == null ? 1 : forumCreationEligibility.level;
    alert(`You must be at least level ${MIN_LEVEL_CREATE_FORUM} to create forums. Your level is ${lvl}.`);
    return;
  }

  const name = document.getElementById('forumTitle').value.trim();
  const description = document.getElementById('forumDescription').value.trim();
  if (!name) return alert('Name is required');

  try {
    const res = await fetch('/api/forums', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return alert(body.error || 'Failed to create forum');
    }
    // close modal
    const modalEl = document.getElementById('createForumModal');
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.hide();
    document.getElementById('createForumForm').reset();
    await loadForums();
  } catch (err) {
    console.error(err);
    alert('Server error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  resolveForumCreationEligibility();
  loadForums();
  const btn = document.getElementById('createForumBtn');
  if (btn) btn.addEventListener('click', createForum);
});
