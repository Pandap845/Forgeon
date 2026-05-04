(function () {
  function resolveAvatarUrl(url) {
    if (typeof window.resolveForgeonAvatarUrl === 'function') return window.resolveForgeonAvatarUrl(url);
    const s = url && String(url).trim();
    return s || '/assets/images/default-avatar.svg';
  }

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
    if (!date) return '';
    const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
    if (seconds < 60) return seconds + 's';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h';
    const days = Math.floor(hours / 24);
    return days + 'd';
  }

  function getQueryParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (e) {
      return null;
    }
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value == null ? '' : String(value);
  }

  function setHtml(id, html) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = html;
  }

  function setAttr(id, attr, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (value == null) el.removeAttribute(attr);
    else el.setAttribute(attr, value);
  }

  let currentThreadId = null;
  let currentEditCommentId = null;

  function setCommentsCount(n) {
    const header = document.getElementById('commentsHeader');
    if (header) header.textContent = `Comments (${n})`;
    setText('tvCommentsCount', String(n || 0));
  }

  function clearCommentsList() {
    const list = document.getElementById('commentsList');
    if (!list) return;
    list.innerHTML = '';
  }

  function renderCommentItem(comment) {
    const article = document.createElement('article');
    article.className = 'tv-comment';
    article.dataset.commentId = comment._id;

    const avatarUrl = resolveAvatarUrl(comment.author && (comment.author.avatarUrl || ''));
    const authorName = comment.author && (comment.author.username || comment.author.name) ? (comment.author.username || comment.author.name) : 'Unknown';

    article.innerHTML = `
      <div class="d-flex gap-3">
        <div class="avatar-shell avatar-shell--tv avatar-shell--border flex-shrink-0" data-forgeon-avatar>
          <div class="avatar-frame" aria-hidden="true"></div>
          <img class="forgeon-avatar" alt="${escapeHtml(authorName)} avatar" src="${escapeHtml(avatarUrl)}" />
        </div>
        <div class="flex-grow-1">
          <div class="d-flex align-items-center justify-content-between gap-3">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="fw-medium">${escapeHtml(authorName)}</span>
              <span class="text-muted-2 small">${escapeHtml(timeAgo(comment.createdAt) + ' ago')}</span>
            </div>
            <div class="d-flex gap-2 align-items-center">
              ${comment.isMine ? '<button class="btn btn-link edit-comment-btn p-0">Edit</button><button class="btn btn-link text-danger delete-comment-btn p-0">Delete</button>' : ''}
            </div>
          </div>
          <p class="text-muted-2 mb-3 mt-2 comment-content">${escapeHtml(comment.content)}</p>
          <div class="d-flex align-items-center gap-2 text-muted-2 small"><i class="bi bi-heart"></i> ${comment.likesCount || 0}</div>
        </div>
      </div>
    `;

    // attach edit/delete handlers if applicable
    if (comment.isMine) {
      const editBtn = article.querySelector('.edit-comment-btn');
      const delBtn = article.querySelector('.delete-comment-btn');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.preventDefault();
          currentEditCommentId = comment._id;
          const ta = document.getElementById('editCommentTextarea');
          if (ta) ta.value = comment.content || '';
          const modalEl = document.getElementById('editCommentModal');
          if (modalEl) {
            const bs = new bootstrap.Modal(modalEl);
            bs.show();
          }
        });
      }
      if (delBtn) {
        delBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          if (!confirm('Delete this comment?')) return;
          try {
            const res = await fetch('/api/comments/' + encodeURIComponent(comment._id), { method: 'DELETE', credentials: 'include' });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              alert(err.message || 'Failed to delete comment');
              return;
            }
            // remove from DOM
            article.remove();
            // update counts
            const currentCount = parseInt(document.getElementById('commentsList')?.children.length || '0', 10);
            // recompute true count by counting elements with data-comment-id
            const count = Array.from(document.getElementById('commentsList')?.children || []).filter(ch => ch.dataset && ch.dataset.commentId).length;
            setCommentsCount(count);
          } catch (err) {
            console.error(err);
            alert('Error deleting comment');
          }
        });
      }
    }

    return article;
  }

  async function loadComments(threadId) {
    if (!threadId) return;
    currentThreadId = threadId;
    const list = document.getElementById('commentsList');
    if (!list) return;
    list.innerHTML = '<div class="text-muted-2">Loading comments...</div>';
    try {
      const res = await fetch('/api/comments?thread=' + encodeURIComponent(threadId), { credentials: 'include' });
      if (!res.ok) {
        list.innerHTML = '<div class="text-danger">Failed to load comments</div>';
        return;
      }
      const comments = await res.json();
      clearCommentsList();
      if (!comments || comments.length === 0) {
        const no = document.createElement('div');
        no.id = 'noComments';
        no.className = 'text-muted-2';
        no.textContent = 'No comments yet. Be the first to comment.';
        list.appendChild(no);
        setCommentsCount(0);
        return;
      }
      comments.forEach(c => {
        const el = renderCommentItem(c);
        list.appendChild(el);
      });
      setCommentsCount(comments.length);
    } catch (e) {
      console.error('loadComments error', e);
      list.innerHTML = '<div class="text-danger">Error loading comments</div>';
    }
  }

  async function postNewComment() {
    const input = document.getElementById('newCommentInput');
    if (!input) return;
    const content = (input.value || '').trim();
    if (!content) return;
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread: currentThreadId, content }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to post comment');
        return;
      }
      const created = await res.json();
      // remove placeholder if present
      const no = document.getElementById('noComments');
      if (no) no.remove();
      const list = document.getElementById('commentsList');
      if (list) {
        const el = renderCommentItem(created);
        list.appendChild(el);
      }
      // clear input
      input.value = '';
      // update counts
      const count = Array.from(document.getElementById('commentsList')?.children || []).filter(ch => ch.dataset && ch.dataset.commentId).length;
      setCommentsCount(count);
    } catch (e) {
      console.error('postNewComment error', e);
      alert('Error posting comment');
    }
  }

  async function saveEditedComment() {
    const id = currentEditCommentId;
    if (!id) return;
    const ta = document.getElementById('editCommentTextarea');
    if (!ta) return;
    const content = (ta.value || '').trim();
    if (!content) {
      alert('Comment cannot be empty');
      return;
    }
    try {
      const res = await fetch('/api/comments/' + encodeURIComponent(id), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Failed to update comment');
        return;
      }
      const updated = await res.json();
      // update DOM
      const article = document.querySelector('[data-comment-id="' + id + '"]');
      if (article) {
        const p = article.querySelector('.comment-content');
        if (p) p.textContent = updated.content || '';
      }
      // hide modal
      const modalEl = document.getElementById('editCommentModal');
      if (modalEl) {
        const bs = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        bs.hide();
      }
      currentEditCommentId = null;
    } catch (e) {
      console.error('saveEditedComment error', e);
      alert('Error updating comment');
    }
  }

  async function loadThread() {
    const threadId = getQueryParam('thread');
    const articleEl = document.querySelector('.tv-post-card');
    if (!threadId) {
      if (articleEl) articleEl.innerHTML = '<div class="text-muted-2">No thread specified.</div>';
      return;
    }

    try {
      setHtml('tvPostTitle', 'Loading...');
      setText('tvPostBody', '');
      setText('tvAuthorName', '');
      setText('tvPostDate', '');
      setAttr('tvAuthorAvatar', 'src', '');
      setHtml('tvMediaGrid', '');

      const res = await fetch('/api/threads/' + encodeURIComponent(threadId), { credentials: 'include' });
      if (!res.ok) {
        const msg = 'Failed to load thread';
        if (articleEl) articleEl.innerHTML = '<div class="text-danger">' + escapeHtml(msg) + '</div>';
        return;
      }

      const thread = await res.json();
      if (!thread) {
        if (articleEl) articleEl.innerHTML = '<div class="text-muted-2">Thread not found.</div>';
        return;
      }

      // Title
      setText('tvPostTitle', thread.title || 'Untitled');

      // Author
      const authorName = thread.author && (thread.author.username || thread.author.name || thread.author.displayName) ? (thread.author.username || thread.author.name || thread.author.displayName) : 'Unknown';
      setText('tvAuthorName', authorName);
      const avatar = resolveAvatarUrl((thread.author && (thread.author.avatarUrl || thread.author.avatar)) || '');
      setAttr('tvAuthorAvatar', 'src', avatar);

      // Date
      setText('tvPostDate', thread.createdAt ? ('Published ' + timeAgo(thread.createdAt) + ' ago') : '');

      // Body
      setHtml('tvPostBody', escapeHtml(thread.description || thread.body || ''));

      // Likes
      const likes = typeof thread.likesCount === 'number' ? thread.likesCount : (thread.votes || 0);
      setText('tvLikesCount', String(likes || 0));
      // Comments count (not loading comments)
      setText('tvCommentsCount', String(thread.commentsCount || 0));

      // Media
      const mediaGrid = document.getElementById('tvMediaGrid');
      if (mediaGrid) {
        mediaGrid.innerHTML = '';
        if (thread.imageUrl) {
          const div = document.createElement('div');
          div.className = 'tv-media tv-media-wide';
          const img = document.createElement('img');
          img.alt = thread.title || 'media';
          img.src = thread.imageUrl;
          div.appendChild(img);
          mediaGrid.appendChild(div);
        }
      }

      // Forum / group breadcrumb
      const rootLink = document.getElementById('breadcrumbRootLink');
      const forum = thread.forum;
      const group = thread.group;
      if (group && (group._id || group.id || group.name)) {
        const groupId = group._id || group.id;
        const groupName = group.name || 'Group';
        setText('tvForumName', groupName);
        const bc = document.getElementById('breadcrumbForumLink');
        if (bc) {
          bc.textContent = groupName;
          bc.href = '../Groups/group_detail.html?groupId=' + encodeURIComponent(groupId);
        }
        if (rootLink) {
          rootLink.textContent = 'Groups';
          rootLink.href = '../Groups/user_groups.html';
        }
        document.title = (thread.title || 'Thread') + ' - ' + groupName + ' - Forgeon';
      } else if (forum && (forum._id || forum.id || forum.name)) {
        const forumId = forum._id || forum.id;
        const forumName = forum.name || forum;
        setText('tvForumName', forumName || 'Forum');
        const bc = document.getElementById('breadcrumbForumLink');
        if (bc) {
          bc.textContent = forumName || 'Forum';
          bc.href = './forumpage.html?forum=' + encodeURIComponent(forumId);
        }
        if (rootLink) {
          rootLink.textContent = 'Forums';
          rootLink.href = './forums.html';
        }
        document.title = (thread.title || 'Thread') + ' - ' + (forumName || 'Forum') + ' - Forgeon';
      } else {
        setText('tvForumName', 'Forum');
        const bc = document.getElementById('breadcrumbForumLink');
        if (bc) {
          bc.textContent = 'Forums';
          bc.href = './forums.html';
        }
        if (rootLink) {
          rootLink.textContent = 'Forums';
          rootLink.href = './forums.html';
        }
        document.title = (thread.title || 'Thread') + ' - Forgeon';
      }

      // load comments for this thread
      try {
        await loadComments(thread._id || thread.id);
      } catch (e) {
        // ignore
      }
    } catch (e) {
      console.error('Error loading thread', e);
      const articleEl2 = document.querySelector('.tv-post-card');
      if (articleEl2) articleEl2.innerHTML = '<div class="text-danger">Error loading thread</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadThread();
    const postBtn = document.getElementById('postCommentBtn');
    if (postBtn) postBtn.addEventListener('click', postNewComment);
    const saveBtn = document.getElementById('saveCommentEditBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveEditedComment);
    const newInput = document.getElementById('newCommentInput');
    if (newInput) newInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); postNewComment(); } });
  });
})();
