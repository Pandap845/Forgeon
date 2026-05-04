(function () {
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&"'<>]/g, function (m) {
      return ({
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#39;',
        '<': '&lt;',
        '>': '&gt;'
      })[m];
    });
  }

  function timeAgo(date) {
    const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
    if (seconds < 60) return seconds + 's';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h';
    const days = Math.floor(hours / 24);
    return days + 'd';
  }

  async function loadThreads() {
    const container = document.getElementById('threadFeed');
    if (!container) return;
    container.innerHTML = '<div class="text-muted-2">Loading threads...</div>';
    try {
      // support filtering by forum via query param
      const forumId = getQueryParam('forum');
      const qs = new URLSearchParams({ limit: '10' });
      if (forumId) qs.set('forum', forumId);
      const res = await fetch('/api/threads?' + qs.toString(), { credentials: 'include' });
      if (!res.ok) {
        container.innerHTML = '<div class="text-danger">Failed to load threads</div>';
        return;
      }
      const threads = await res.json();
      // if no forum query param but threads belong to a forum, set title from first forum found
      if (!forumId && threads && threads.length) {
        const ft = threads.find(x => x.forum && (x.forum.name || x.forum));
        if (ft && ft.forum && (ft.forum.name || ft.forum)) {
          const titleEl = document.getElementById('forumTitle');
          const bc = document.getElementById('breadcrumbForumName');
            const forumName = ft.forum.name || ft.forum;
            if (titleEl) titleEl.textContent = forumName;
            if (bc) bc.textContent = forumName;
            document.title = forumName + ' - Forgeon';
        }
      }
      if (!threads || threads.length === 0) {
        container.innerHTML = '<div class="text-muted-2">No threads yet.</div>';
        return;
      }
      container.innerHTML = '';
      threads.forEach(t => {
        const article = document.createElement('article');
        article.className = 'feed-post d-flex gap-2';

        const voteRail = document.createElement('div');
        voteRail.className = 'vote-rail d-flex flex-column align-items-center py-2';
        voteRail.innerHTML = `
          <button class="btn vote-btn p-0" type="button" aria-label="Upvote"><i class="bi bi-hand-thumbs-up"></i></button>
          <div class="vote-count">${t.votes || 0}</div>
          <button class="btn vote-btn p-0" type="button" aria-label="Downvote"><i class="bi bi-hand-thumbs-down"></i></button>
        `;

        const postCard = document.createElement('div');
        postCard.className = 'post-card flex-grow-1 p-3 position-relative';
        const author = t.author && t.author.username ? t.author.username : 'unknown';
        const target = t.publishTo === 'group' ? (t.group && t.group.name ? t.group.name : 'Group') : (t.publishTo === 'forum' ? (t.forum && (t.forum.name || t.forum) ? (t.forum.name || t.forum) : 'Forum') : 'General');
          const threadHref = './threadview.html' + (t._id || t.id ? ('?thread=' + encodeURIComponent(t._id || t.id)) : '');
        postCard.innerHTML = `
          <div class="post-meta mb-2">${escapeHtml(target)} • Posted by u/${escapeHtml(author)} ${timeAgo(t.createdAt)} ago</div>
          <h2 class="post-title mb-3"><a href="${threadHref}" class="stretched-link text-decoration-none text-white">${escapeHtml(t.title)}</a></h2>
          <div class="post-actions d-flex flex-wrap gap-4 position-relative z-1">
            <a href="${threadHref}" class="post-action text-decoration-none"><i class="bi bi-chat"></i> ${t.commentsCount || 0} Comments</a>
            <a class="post-action text-decoration-none"><i class="bi bi-share"></i> Share</a>
          </div>
        `;

        article.appendChild(voteRail);
        article.appendChild(postCard);
        container.appendChild(article);

        // wire upvote/downvote buttons: simple client-side increment/decrement and disable after vote
        try {
          const upBtn = article.querySelector('button[aria-label="Upvote"]');
          const downBtn = article.querySelector('button[aria-label="Downvote"]');
          const countEl = article.querySelector('.vote-count');
          if (upBtn && downBtn && countEl) {
            const threadId = t._id || t.id;
            const once = (delta) => {
              return function onClick(e) {
                e.preventDefault();
                const current = parseInt(countEl.textContent || '0', 10);
                countEl.textContent = String(current + delta);
                // disable both buttons so user can't spam
                upBtn.disabled = true;
                downBtn.disabled = true;
              };
            };
            upBtn.addEventListener('click', once(1));
            downBtn.addEventListener('click', once(-1));
          }
        } catch (err) {
          console.warn('Failed to attach vote handlers', err);
        }
      });
    } catch (err) {
      container.innerHTML = '<div class="text-danger">Error loading threads</div>';
      console.error(err);
    }
  }

  function getQueryParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (e) {
      return null;
    }
  }

  async function loadForumInfo(forumId) {
    if (!forumId) return;
    try {
      console.log('[threads_controller] loadForumInfo start', forumId);
      const res = await fetch('/api/forums/' + encodeURIComponent(forumId), { credentials: 'include' });
      let forum = null;
      if (res.ok) {
        forum = await res.json();
      } else {
        // fallback: maybe forumId is a slug or name; try listing forums and match
        console.warn('[threads_controller] direct forum fetch failed, trying list fallback', res.status);
        try {
          const listRes = await fetch('/api/forums?limit=100', { credentials: 'include' });
          if (listRes.ok) {
            const forums = await listRes.json();
            forum = (forums || []).find(f => f._id === forumId || f.slug === forumId || String(f.name).toLowerCase() === String(forumId).toLowerCase());
            if (!forum) console.warn('[threads_controller] fallback did not find forum for', forumId);
          }
        } catch (e) {
          console.warn('[threads_controller] fallback list fetch error', e);
        }
      }

      if (!forum) {
        console.warn('[threads_controller] no forum data available for', forumId);
        return;
      }

      const bc = document.getElementById('breadcrumbForumName');
      const title = document.getElementById('forumTitle');
      const desc = document.getElementById('forumDescription');
      console.log('[threads_controller] forum data', forum);
        const forumName = forum.name;
        if (bc && forumName) bc.textContent = forumName;
        if (title && forumName) title.textContent = forumName;
        if (desc) desc.textContent = forum.description || '';
        if (forumName) document.title = forumName + ' - Forgeon';

      // fetch threads for this forum to compute counts (simple approach)
      try {
        const searchForumId = forum && (forum._id || forum.id) ? (forum._id || forum.id) : forumId;
        const tRes = await fetch('/api/threads?forum=' + encodeURIComponent(searchForumId) + '&limit=100', { credentials: 'include' });
        if (tRes.ok) {
          const tlist = await tRes.json();
          const threadsCountEl = document.getElementById('threadsCount');
          const postsCountEl = document.getElementById('postsCount');
          if (threadsCountEl) threadsCountEl.textContent = String(tlist.length);
          if (postsCountEl) {
            const totalPosts = (tlist || []).reduce((sum, t) => sum + (t.commentsCount || 0), 0);
            postsCountEl.textContent = String(totalPosts);
          }
        }
      } catch (e) {
        // ignore
      }
    } catch (e) {
      console.warn('Could not load forum info', e);
    }
  }

  async function loadRecentGroups() {
    const list = document.getElementById('recentGroupsList');
    if (!list) return;
    list.innerHTML = '<li class="text-muted-2">Loading...</li>';
    try {
      const res = await fetch('/api/groups', { credentials: 'include' });
      if (!res.ok) {
        list.innerHTML = '<li class="text-danger">Failed to load groups</li>';
        return;
      }
      const groups = await res.json();
      list.innerHTML = '';
      if (!groups || groups.length === 0) {
        list.innerHTML = '<li class="text-muted-2">No groups yet</li>';
        return;
      }
      groups.slice(0,5).forEach(g => {
        const li = document.createElement('li');
        li.className = 'd-flex justify-content-between text-muted-2';
        const a = document.createElement('a');
        a.className = 'text-decoration-none text-muted-2';
        a.href = '../Groups/group_detail.html?groupId=' + encodeURIComponent(g._id || g.id);
        a.textContent = g.name || 'Group';
        li.appendChild(a);
        list.appendChild(li);
      });
    } catch (e) {
      console.error(e);
      list.innerHTML = '<li class="text-danger">Error loading groups</li>';
    }
  }

  async function populatePublishTargets() {
    const container = document.getElementById('publishTargets');
    if (!container) return;
    container.innerHTML = '<div class="text-muted-2">Loading options...</div>';

    const fragments = [];

    try {
      // groups (user's memberships)
      const gmRes = await fetch('/api/group-memberships', { credentials: 'include' });
      if (gmRes.ok) {
        const memberships = await gmRes.json();
        if (memberships && memberships.length) {
          memberships.forEach(m => {
            if (m.group && m.group._id && m.group.name) {
              fragments.push(renderRadioOption({
                id: 'group-' + m.group._id,
                label: m.group.name + ' (Group)',
                subtitle: 'Post to this group',
                value: 'group',
                dataAttrs: { groupId: m.group._id }
              }));
            }
          });
        }
      }
    } catch (e) {
      console.warn('Could not load group memberships', e);
    }

    try {
      const fRes = await fetch('/api/forums', { credentials: 'include' });
      if (fRes.ok) {
        const forums = await fRes.json();
        if (forums && forums.length) {
          forums.forEach(f => {
            fragments.push(renderRadioOption({
              id: 'forum-' + f._id,
              label: f.name + ' (Forum)',
              subtitle: f.description || '',
              value: 'forum',
              dataAttrs: { forumId: f._id }
            }));
          });
        }
      }
    } catch (e) {
      console.warn('Could not load forums', e);
    }

    if (fragments.length === 0) {
      container.innerHTML = '<div class="text-muted-2">You must join a group or be subscribed to a forum before creating a thread.</div>';
      const publishBtn = document.getElementById('publishThreadBtn');
      if (publishBtn) publishBtn.disabled = true;
      return;
    }

    container.innerHTML = '';
    fragments.forEach(frag => container.appendChild(frag));

    // wire change listeners to enable publish button
    container.querySelectorAll('input[name="publishTo"]').forEach(inp => {
      inp.addEventListener('change', validateCreateForm);
    });
  }

  async function loadPopularForums() {
    const list = document.getElementById('popularForumsList');
    if (!list) return;
    list.innerHTML = '<li class="text-muted-2">Loading...</li>';
    try {
      const res = await fetch('/api/forums?limit=5', { credentials: 'include' });
      if (!res.ok) {
        list.innerHTML = '<li class="text-danger">Failed to load forums</li>';
        return;
      }
      const forums = await res.json();
      list.innerHTML = '';
      if (!forums || forums.length === 0) {
        list.innerHTML = '<li class="text-muted-2">No forums yet</li>';
        return;
      }
      forums.slice(0,5).forEach(f => {
        const li = document.createElement('li');
        li.className = 'popular-item d-flex align-items-center justify-content-between';
        const a = document.createElement('a');
        a.className = 'post-action text-decoration-none d-inline-flex align-items-center gap-2';
        a.href = './forumpage.html?forum=' + encodeURIComponent(f._id);
        const icon = document.createElement('i');
        icon.className = 'bi bi-controller';
        a.appendChild(icon);
        a.append(' ' + (f.name || 'Unnamed'));
        li.appendChild(a);
        list.appendChild(li);
      });
    } catch (e) {
      console.error(e);
      list.innerHTML = '<li class="text-danger">Error loading forums</li>';
    }
  }

  function renderRadioOption({ id, label, subtitle, value, dataAttrs }) {
    const labelEl = document.createElement('label');
    labelEl.className = 'forgeon-radio-card';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'publishTo';
    input.value = value;
    input.id = id;
    if (dataAttrs) {
      Object.keys(dataAttrs).forEach(k => input.dataset[k] = dataAttrs[k]);
    }

    const dot = document.createElement('span');
    dot.className = 'forgeon-radio-dot';
    dot.setAttribute('aria-hidden', 'true');

    const txt = document.createElement('span');
    txt.className = 'd-flex flex-column';
    const lbl = document.createElement('span');
    lbl.className = 'fw-medium';
    lbl.textContent = label;
    txt.appendChild(lbl);
    if (subtitle) {
      const sub = document.createElement('small');
      sub.className = 'text-muted-2';
      sub.textContent = subtitle;
      txt.appendChild(sub);
    }

    labelEl.appendChild(input);
    labelEl.appendChild(dot);
    labelEl.appendChild(txt);
    return labelEl;
  }

  function validateCreateForm() {
    const title = document.getElementById('threadTitle')?.value?.trim();
    const desc = document.getElementById('threadDescription')?.value?.trim();
    const selected = document.querySelector('input[name="publishTo"]:checked');
    const publishBtn = document.getElementById('publishThreadBtn');
    if (title && desc && selected && publishBtn) {
      publishBtn.disabled = false;
    } else if (publishBtn) {
      publishBtn.disabled = true;
    }
  }

  async function publishThread() {
    const title = document.getElementById('threadTitle')?.value?.trim();
    const desc = document.getElementById('threadDescription')?.value?.trim();
    const imageInput = document.getElementById('threadImage');
    const selected = document.querySelector('input[name="publishTo"]:checked');
    if (!title || !desc || !selected) return;
    const publishTo = selected.value;
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', desc);
    formData.append('publishTo', publishTo);
    if (publishTo === 'group' && selected.dataset.groupId) formData.append('group', selected.dataset.groupId);
    if (publishTo === 'forum' && selected.dataset.forumId) formData.append('forum', selected.dataset.forumId);
    if (imageInput && imageInput.files && imageInput.files[0]) formData.append('threadImage', imageInput.files[0]);

    try {
      const res = await fetch('/api/threads', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to publish thread');
        return;
      }
      // success: close modal and reload threads
      const modalEl = document.getElementById('createThreadModal');
      if (modalEl) {
        const bsModal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        bsModal.hide();
      }
      // reset form
      document.getElementById('createThreadForm')?.reset();
      await loadThreads();
    } catch (e) {
      console.error(e);
      alert('Error publishing thread');
    }
  }

  function attachFormListeners() {
    const title = document.getElementById('threadTitle');
    const desc = document.getElementById('threadDescription');
    if (title) title.addEventListener('input', validateCreateForm);
    if (desc) desc.addEventListener('input', validateCreateForm);
    const publishBtn = document.getElementById('publishThreadBtn');
    if (publishBtn) publishBtn.addEventListener('click', publishThread);

    // reset form when modal shown
    const modalEl = document.getElementById('createThreadModal');
    if (modalEl) {
      modalEl.addEventListener('show.bs.modal', () => {
        validateCreateForm();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const forumId = getQueryParam('forum');
    if (forumId) loadForumInfo(forumId);
    loadThreads();
    populatePublishTargets();
    loadPopularForums();
    loadRecentGroups();
    attachFormListeners();
  });
})();
