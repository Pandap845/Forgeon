// Minimal frontend controller for forums page
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
  return (str || '').replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
}

async function createForum() {
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
  loadForums();
  const btn = document.getElementById('createForumBtn');
  if (btn) btn.addEventListener('click', createForum);
});
