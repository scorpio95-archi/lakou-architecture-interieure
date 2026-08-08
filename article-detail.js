/* ============================================================
   ARCHITECTURE INTÉRIEURE — article-detail.js
   Utilise le client Supabase unique créé par supabase-client.js.
   ============================================================ */

function escapeHtml(str){
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(iso){
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function init(){
  const params = new URLSearchParams(window.location.search);
  const articleId = params.get('id');
  if (!articleId){ window.location.href = 'articles.html'; return; }

  const { data: article, error } = await sb.from('articles')
    .select('id, title, content, cover_image_url, created_at, profiles ( full_name, avatar_url ), article_categories ( label )')
    .eq('id', articleId)
    .single();

  if (error || !article){
    document.getElementById('articleGuardMsg').textContent = 'Cet article est introuvable ou pas encore validé.';
    return;
  }

  document.getElementById('articleGuardMsg').style.display = 'none';
  document.getElementById('articleContent').style.display = 'block';
  document.title = article.title + ' — Articles — Architecture Intérieure';
  document.getElementById('articleFil').textContent = article.title;

  const author = article.profiles || {};
  const authorName = escapeHtml(author.full_name || 'Membre');
  const initial = (author.full_name || '?').trim().charAt(0).toUpperCase() || '?';
  const avatarHtml = author.avatar_url ? `<img src="${escapeHtml(author.avatar_url)}" alt="">` : `<span>${escapeHtml(initial)}</span>`;
  const catLabel = article.article_categories ? escapeHtml(article.article_categories.label) : '';

  document.getElementById('articleDetail').innerHTML = `
    ${article.cover_image_url ? `<img src="${escapeHtml(article.cover_image_url)}" class="projet-cover">` : ''}
    ${catLabel ? `<span class="gc-cat" style="display:block; margin-top:20px;">${catLabel}</span>` : ''}
    <h1 class="forum-detail-title">${escapeHtml(article.title)}</h1>
    <div class="gc-author" style="margin:14px 0;">
      <div class="gc-avatar">${avatarHtml}</div>
      <span>${authorName} · ${formatDate(article.created_at)}</span>
    </div>
    <div class="forum-detail-content">${escapeHtml(article.content).replace(/\n/g, '<br>')}</div>
  `;
}

init();
