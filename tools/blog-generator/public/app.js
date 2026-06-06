// Initialize Markdown-it parser
const md = window.markdownit({
  html: true,
  linkify: true,
  typographer: true
});
// Elegant toast notification system
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  if (type === 'warning') iconName = 'alert-triangle';
  if (type === 'error') iconName = 'alert-circle';
  
  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  if (window.lucide) {
    window.lucide.createIcons();
  }
  
  setTimeout(() => toast.classList.add('show'), 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Override default window.alert to use the premium toast system
window.alert = function(message) {
  let type = 'info';
  const msgLower = message.toLowerCase();
  if (msgLower.includes('fail') || msgLower.includes('error') || msgLower.includes('could not') || msgLower.includes('invalid') || msgLower.includes('too large') || msgLower.includes('missing')) {
    type = 'error';
  } else if (msgLower.includes('warning') || msgLower.includes('caution')) {
    type = 'warning';
  } else if (msgLower.includes('success') || msgLower.includes('saved') || msgLower.includes('updated') || msgLower.includes('emailed') || msgLower.includes('complete') || msgLower.includes('ready')) {
    type = 'success';
  }
  showToast(message, type);
};

// State
let appConfig = null;
let currentIdeas = [];
let activeDraft = null;
let savedFilename = '';

// Hero Image Manager State
let loadedPosts = { activeDraft: null, posts: [] };
let selectedPost = null;
let suggestedImages = [];
let uploadedBase64 = null;

// DOM Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const configStatus = document.getElementById('config-status');
const apiWarning = document.getElementById('api-warning');

// Ideas elements
const btnGenerateIdeas = document.getElementById('btn-generate-ideas');
const btnEmailIdeas = document.getElementById('btn-email-ideas');
const ideasLoader = document.getElementById('ideas-loader');
const ideasContainer = document.getElementById('ideas-container');

// Editor elements
const editorNavBtn = document.getElementById('editor-nav-btn');
const activePostTitle = document.getElementById('active-post-title');
const slugInfo = document.getElementById('slug-info');
const btnLoadDraft = document.getElementById('btn-load-draft');
const btnSaveDraft = document.getElementById('btn-save-draft');
const markdownEditor = document.getElementById('markdown-editor');
const htmlPreview = document.getElementById('html-preview');
const refinePrompt = document.getElementById('refine-prompt');
const btnRefineDraft = document.getElementById('btn-refine-draft');
const refineLoader = document.getElementById('refine-loader');

// Publish elements
const publishNavBtn = document.getElementById('publish-nav-btn');
const commitFilename = document.getElementById('commit-filename');
const commitMessage = document.getElementById('commit-message');
const btnGitPublish = document.getElementById('btn-git-publish');
const consoleLog = document.getElementById('console-log');
const btnClearConsole = document.getElementById('btn-clear-console');

// Hero Image elements
const imagePostSelector = document.getElementById('image-post-selector');
const imageSearchKeywords = document.getElementById('image-search-keywords');
const btnSearchImages = document.getElementById('btn-search-images');
const currentImagePreview = document.getElementById('current-image-preview');
const currentImageDetails = document.getElementById('current-image-details');
const galleryLoader = document.getElementById('gallery-loader');
const imageSuggestionsGrid = document.getElementById('image-suggestions-grid');
const galleryStatus = document.getElementById('gallery-status');
const dragDropZone = document.getElementById('drag-drop-zone');
const imageFileInput = document.getElementById('image-file-input');
const browseFileBtn = document.getElementById('browse-file-btn');
const uploadPreviewContainer = document.getElementById('upload-preview-container');
const uploadImagePreview = document.getElementById('upload-image-preview');
const uploadFileName = document.getElementById('upload-file-name');
const btnSubmitUpload = document.getElementById('btn-submit-upload');

// API Base URL (runs on the same host)
const API_BASE = '';

// Initialize Lucide Icons
function updateIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Tab Switching Logic
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetTab = btn.getAttribute('data-tab');
    
    // Update active tab buttons
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Update active content
    tabContents.forEach(content => {
      content.classList.remove('active');
      if (content.id === targetTab) {
        content.classList.add('active');
      }
    });
    
    // Initialize image manager tab if selected
    if (targetTab === 'image-tab') {
      initImageManagerTab();
    }
  });
});

// Navigate to tab helper
function navigateToTab(tabId) {
  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) btn.click();
}

// Fetch API config and update UI
async function fetchConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/config`);
    const config = await res.json();
    appConfig = config;
    
    // Update status indicator
    if (config.hasGeminiKey && config.hasResendKey) {
      configStatus.className = 'status-indicator ready';
      configStatus.innerHTML = '<span class="status-dot"></span> APIs Ready';
      apiWarning.classList.add('hidden');
    } else {
      configStatus.className = 'status-indicator warning';
      configStatus.innerHTML = '<span class="status-dot"></span> Config Warning';
      apiWarning.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error fetching config:', error);
    configStatus.className = 'status-indicator warning';
    configStatus.innerHTML = '<span class="status-dot"></span> Offline';
  }
}

// Fetch current proposals
async function loadIdeas() {
  try {
    const res = await fetch(`${API_BASE}/api/ideas`);
    const ideas = await res.json();
    currentIdeas = ideas;
    renderIdeas(ideas);
  } catch (error) {
    console.error('Error loading ideas:', error);
  }
}

// Render Ideas list
function renderIdeas(ideas) {
  ideasContainer.innerHTML = '';
  
  if (!ideas || ideas.length === 0) {
    ideasContainer.innerHTML = `
      <div class="empty-state">
        <i data-lucide="lightbulb" class="huge-icon"></i>
        <h3>No ideas loaded</h3>
        <p>Click "Generate New Ideas" to run Gemini and generate a personalized list of topics based on your site's history.</p>
      </div>
    `;
    btnEmailIdeas.disabled = true;
    updateIcons();
    return;
  }
  
  btnEmailIdeas.disabled = false;
  
  ideas.forEach(idea => {
    const card = document.createElement('div');
    card.className = 'idea-card';
    
    const outlineItems = idea.outline.map(pt => `<li>${pt}</li>`).join('');
    const tagsItems = idea.tags.map(t => `<span class="tag">#${t}</span>`).join('');
    
    card.innerHTML = `
      <h3 class="idea-title">${idea.title}</h3>
      <p class="idea-desc">"${idea.description}"</p>
      <div class="idea-outline-title">Outline Points:</div>
      <ul class="idea-outline">
        ${outlineItems}
      </ul>
      <div class="idea-tags">
        ${tagsItems}
      </div>
      <div class="idea-card-footer">
        <button class="btn btn-primary btn-select" data-id="${idea.id}">
          <i data-lucide="file-plus"></i> Select & Write Draft
        </button>
      </div>
    `;
    
    // Bind write draft event
    card.querySelector('.btn-select').addEventListener('click', async () => {
      await generateDraftForIdea(idea);
    });
    
    ideasContainer.appendChild(card);
  });
  
  updateIcons();
}

// Generate Blog Post Draft
async function generateDraftForIdea(idea) {
  // Disable all select buttons while generating
  document.querySelectorAll('.btn-select').forEach(b => b.disabled = true);
  btnGenerateIdeas.disabled = true;
  
  // Show loader in ideas container
  ideasContainer.classList.add('hidden');
  ideasLoader.classList.remove('hidden');
  ideasLoader.querySelector('p').innerText = `Gemini is writing the draft for: "${idea.title}"... This may take a moment.`;
  
  try {
    const response = await fetch(`${API_BASE}/api/draft/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea })
    });
    const result = await response.json();
    
    if (result.success) {
      loadDraftContent(result.content, idea.title);
      navigateToTab('editor-tab');
      
      // Notify user draft was also emailed
      if (appConfig && appConfig.hasResendKey && appConfig.userEmail) {
        alert(`Draft generated successfully and emailed to ${appConfig.userEmail}!`);
      } else {
        alert('Draft generated successfully! Load complete in local editor.');
      }
    } else {
      alert(`Generation failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Error generating draft:', error);
    alert(`Error: ${error.message}`);
  } finally {
    // Re-enable buttons
    document.querySelectorAll('.btn-select').forEach(b => b.disabled = false);
    btnGenerateIdeas.disabled = false;
    ideasContainer.classList.remove('hidden');
    ideasLoader.classList.add('hidden');
  }
}

// Load draft data into Editor UI
function loadDraftContent(markdownContent, title = '') {
  activeDraft = markdownContent;
  markdownEditor.value = markdownContent;
  markdownEditor.disabled = false;
  
  btnSaveDraft.disabled = false;
  refinePrompt.disabled = false;
  btnRefineDraft.disabled = false;
  
  if (title) {
    activePostTitle.innerText = title;
  } else {
    // Try to extract title from frontmatter
    const fm = parseFrontmatter(markdownContent);
    activePostTitle.innerText = fm && fm.title ? fm.title : 'Draft Post';
  }
  
  updatePreview(markdownContent);
  updateSlugDisplay(markdownContent);
}

// Compile Markdown to Live Preview
function updatePreview(markdownContent) {
  if (!markdownContent) {
    htmlPreview.innerHTML = `
      <div class="empty-preview">
        <p>No content to display.</p>
      </div>
    `;
    return;
  }
  
  // Separate frontmatter and body
  const match = markdownContent.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  let body = markdownContent;
  let frontmatterHtml = '';
  
  if (match) {
    body = markdownContent.substring(match[0].length);
    const fmText = match[1];
    frontmatterHtml = `
      <div class="frontmatter-preview">
        <strong>Frontmatter Configuration:</strong>
        <pre>${escapeHtml(fmText)}</pre>
      </div>
    `;
  }
  
  // Parse body Markdown
  const parsedBody = md.render(body);
  htmlPreview.innerHTML = frontmatterHtml + parsedBody;
}

// Generate & display slug suggestion
function updateSlugDisplay(markdownContent) {
  const fm = parseFrontmatter(markdownContent);
  if (fm && fm.title) {
    const slug = fm.title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    slugInfo.innerText = `slug: ${slug}.md`;
    slugInfo.setAttribute('data-slug', slug);
  } else {
    slugInfo.innerText = 'slug: none';
    slugInfo.removeAttribute('data-slug');
  }
}

// Local frontmatter parser helper
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!match) return null;
  const fmText = match[1];
  const result = {};
  fmText.split('\n').forEach(line => {
    const idx = line.indexOf(':');
    if (idx !== -1) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      result[key] = val;
    }
  });
  return result;
}

// Escape HTML helper
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Handle Editor Input Change
markdownEditor.addEventListener('input', (e) => {
  const content = e.target.value;
  activeDraft = content;
  updatePreview(content);
  updateSlugDisplay(content);
});

// Fetch active draft stored on server (if any)
async function loadActiveDraftFromServer() {
  try {
    const res = await fetch(`${API_BASE}/api/draft`);
    const draft = await res.json();
    if (draft && draft.content) {
      const title = draft.idea ? draft.idea.title : '';
      loadDraftContent(draft.content, title);
      navigateToTab('editor-tab');
    } else {
      alert('No active draft saved on the server. Select an idea to generate one!');
    }
  } catch (error) {
    console.error('Error loading draft:', error);
    alert('Failed to load draft from server.');
  }
}

// Generate Ideas Button Event
btnGenerateIdeas.addEventListener('click', async () => {
  btnGenerateIdeas.disabled = true;
  ideasContainer.classList.add('hidden');
  ideasLoader.classList.remove('hidden');
  ideasLoader.querySelector('p').innerText = 'Analyzing existing articles and brainstorming ideas...';
  
  try {
    const res = await fetch(`${API_BASE}/api/ideas/generate`, {
      method: 'POST'
    });
    const result = await res.json();
    if (result.success) {
      currentIdeas = result.ideas;
      renderIdeas(result.ideas);
    } else {
      alert(`Error generating ideas: ${result.error}`);
    }
  } catch (error) {
    console.error('Error generating ideas:', error);
    alert(`Failed to request ideas: ${error.message}`);
  } finally {
    btnGenerateIdeas.disabled = false;
    ideasLoader.classList.add('hidden');
    ideasContainer.classList.remove('hidden');
  }
});

// Email Ideas Button Event
btnEmailIdeas.addEventListener('click', async () => {
  btnEmailIdeas.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/api/ideas/send-email`, {
      method: 'POST'
    });
    const result = await res.json();
    if (result.success) {
      alert('Daily ideas successfully emailed!');
    } else {
      alert(`Failed to send email: ${result.error}`);
    }
  } catch (error) {
    console.error('Error sending ideas email:', error);
    alert(`Error: ${error.message}`);
  } finally {
    btnEmailIdeas.disabled = false;
  }
});

// Refine Draft Button Event
btnRefineDraft.addEventListener('click', async () => {
  const prompt = refinePrompt.value.trim();
  if (!prompt) return;
  
  refinePrompt.disabled = true;
  btnRefineDraft.disabled = true;
  refineLoader.classList.remove('hidden');
  
  try {
    const res = await fetch(`${API_BASE}/api/draft/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: activeDraft,
        suggestion: prompt
      })
    });
    const result = await res.json();
    if (result.success) {
      loadDraftContent(result.content);
      refinePrompt.value = '';
      alert('Suggestions applied! Draft updated.');
    } else {
      alert(`Refinement failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Error refining draft:', error);
    alert(`Error: ${error.message}`);
  } finally {
    refinePrompt.disabled = false;
    btnRefineDraft.disabled = false;
    refineLoader.classList.add('hidden');
  }
});

// Save Draft File Event
btnSaveDraft.addEventListener('click', async () => {
  const slug = slugInfo.getAttribute('data-slug');
  if (!slug) {
    alert('Could not determine slug. Please make sure the post has a title in frontmatter.');
    return;
  }
  
  // Prompt user to verify the slug
  const finalSlug = prompt('Verify slug/filename for markdown file:', slug);
  if (!finalSlug) return;
  
  btnSaveDraft.disabled = true;
  
  try {
    const res = await fetch(`${API_BASE}/api/draft/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: activeDraft,
        slug: finalSlug
      })
    });
    const result = await res.json();
    if (result.success) {
      savedFilename = result.filename;
      alert(`Successfully saved draft to: src/content/blog/${result.filename}!`);
      
      // Update publish tab state
      commitFilename.value = result.filename;
      commitMessage.value = `feat(blog): add post about ${activePostTitle.innerText}`;
      commitMessage.disabled = false;
      btnGitPublish.disabled = false;
      
      // Open publish tab
      navigateToTab('publish-tab');
    } else {
      alert(`Failed to save draft file: ${result.error}`);
    }
  } catch (error) {
    console.error('Error saving draft:', error);
    alert(`Error: ${error.message}`);
  } finally {
    btnSaveDraft.disabled = false;
  }
});

// Git Publisher Button Event
btnGitPublish.addEventListener('click', async () => {
  const msg = commitMessage.value.trim();
  if (!msg) {
    alert('Please enter a commit message.');
    return;
  }
  
  btnGitPublish.disabled = true;
  commitMessage.disabled = true;
  consoleLog.innerText = `Running Git publish workflow...\nStaging file...\nCommitting: "${msg}"...\nPushing to remote origin...`;
  
  try {
    const res = await fetch(`${API_BASE}/api/git/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        filename: savedFilename
      })
    });
    const result = await res.json();
    
    if (result.success) {
      consoleLog.innerText += `\n\n✅ SUCCESS!\n\n${result.log}`;
      alert('Successfully committed and pushed blog post to GitHub!');
    } else {
      consoleLog.innerText += `\n\n❌ ERROR!\n\n${result.error || result.stderr || 'Git operation failed.'}`;
      alert('Git operation encountered an error. Check the terminal log.');
    }
  } catch (error) {
    console.error('Git publish error:', error);
    consoleLog.innerText += `\n\n❌ CONNECTION ERROR:\n${error.message}`;
    alert(`Connection Error: ${error.message}`);
  } finally {
    btnGitPublish.disabled = false;
    commitMessage.disabled = false;
  }
});

// Load Saved Draft button binding
btnLoadDraft.addEventListener('click', loadActiveDraftFromServer);

// Clear console binding
btnClearConsole.addEventListener('click', () => {
  consoleLog.innerText = 'Console cleared. Ready.';
});


/* =================================================== */
/* HERO IMAGE MANAGER FRONTEND LOGIC */
/* =================================================== */

// Initialize the Image Manager Tab
async function initImageManagerTab() {
  // Clear file upload previews
  uploadedBase64 = null;
  uploadPreviewContainer.classList.add('hidden');
  imageFileInput.value = '';
  
  // Find out if we have a draft open in the editor tab
  let draftSlug = null;
  if (activeDraft) {
    draftSlug = slugInfo.getAttribute('data-slug');
    if (!draftSlug && loadedPosts.activeDraft) {
      draftSlug = loadedPosts.activeDraft.slug;
    }
  }
  
  await fetchPostsAndPopulateSelector(draftSlug);
}

// Fetch posts and populate selector dropdown
async function fetchPostsAndPopulateSelector(selectSlugAfterLoad = null) {
  try {
    const res = await fetch(`${API_BASE}/api/posts`);
    const data = await res.json();
    loadedPosts = data;
    
    // Clear and populate selector
    imagePostSelector.innerHTML = '<option value="">-- Select a post --</option>';
    
    if (data.activeDraft) {
      const option = document.createElement('option');
      option.value = 'active-draft';
      option.textContent = `📝 Active Draft: ${data.activeDraft.title}`;
      imagePostSelector.appendChild(option);
    }
    
    if (data.posts && data.posts.length > 0) {
      data.posts.forEach(post => {
        const option = document.createElement('option');
        option.value = post.slug;
        option.textContent = `📄 Saved Post: ${post.title}`;
        imagePostSelector.appendChild(option);
      });
    }
    
    // Set selection if requested
    if (selectSlugAfterLoad) {
      if (data.activeDraft && (selectSlugAfterLoad === 'active-draft' || data.activeDraft.slug === selectSlugAfterLoad)) {
        imagePostSelector.value = 'active-draft';
      } else {
        const hasPost = data.posts.some(p => p.slug === selectSlugAfterLoad);
        if (hasPost) {
          imagePostSelector.value = selectSlugAfterLoad;
        }
      }
    }
    
    // Trigger selector change event to render details
    imagePostSelector.dispatchEvent(new Event('change'));
  } catch (error) {
    console.error('Error fetching posts selector:', error);
    alert('Failed to load posts list.');
  }
}

// Handle post selector changes
imagePostSelector.addEventListener('change', () => {
  const val = imagePostSelector.value;
  
  if (!val) {
    selectedPost = null;
    imageSearchKeywords.disabled = true;
    imageSearchKeywords.value = '';
    btnSearchImages.disabled = true;
    
    renderCurrentImagePreview();
    imageSuggestionsGrid.innerHTML = '';
    galleryStatus.textContent = 'Select a post above to load suggestions';
    return;
  }
  
  if (val === 'active-draft') {
    selectedPost = loadedPosts.activeDraft;
  } else {
    selectedPost = loadedPosts.posts.find(p => p.slug === val);
  }
  
  if (selectedPost) {
    imageSearchKeywords.disabled = false;
    btnSearchImages.disabled = false;
    imageSearchKeywords.value = selectedPost.tags ? selectedPost.tags.join(', ') : '';
    
    renderCurrentImagePreview();
    searchImageSuggestions();
  }
});

// Render the current hero image preview panel
function renderCurrentImagePreview() {
  currentImagePreview.innerHTML = '';
  currentImageDetails.innerHTML = '';
  
  if (!selectedPost) {
    currentImagePreview.innerHTML = `
      <div class="empty-image-placeholder">
        <i data-lucide="image"></i>
        <p>No post selected</p>
      </div>
    `;
    updateIcons();
    return;
  }
  
  const imgUrl = selectedPost.heroImage;
  const isFallbackOrEmpty = !imgUrl || imgUrl === '/img/google-antigravity.png';
  
  if (isFallbackOrEmpty) {
    currentImagePreview.innerHTML = `
      <div class="empty-image-placeholder">
        <i data-lucide="alert-circle"></i>
        <p>No image generated/saved</p>
        <span style="font-size:11px;color:var(--text-muted);">Using default placeholder</span>
      </div>
    `;
  } else {
    // Add cache buster to render newly saved images
    const cacheBustedUrl = `${imgUrl}?t=${Date.now()}`;
    currentImagePreview.innerHTML = `<img src="${cacheBustedUrl}" alt="Current Hero Image">`;
  }
  
  currentImageDetails.innerHTML = `
    <table>
      <tr>
        <td>Post:</td>
        <td><strong>${selectedPost.title}</strong></td>
      </tr>
      <tr>
        <td>Slug:</td>
        <td><code>${selectedPost.slug}</code></td>
      </tr>
      <tr>
        <td>Image Path:</td>
        <td><code>${imgUrl || '/img/google-antigravity.png'}</code></td>
      </tr>
    </table>
  `;
  
  updateIcons();
}

// Search image suggestions
async function searchImageSuggestions() {
  if (!selectedPost) return;
  
  galleryLoader.classList.remove('hidden');
  imageSuggestionsGrid.classList.add('hidden');
  galleryStatus.textContent = 'Searching stock photos...';
  
  try {
    const title = selectedPost.title;
    const keywords = imageSearchKeywords.value.trim();
    const slug = selectedPost.slug;
    
    const url = `${API_BASE}/api/images/suggest?title=${encodeURIComponent(title)}&keywords=${encodeURIComponent(keywords)}&slug=${encodeURIComponent(slug)}`;
    const res = await fetch(url);
    const result = await res.json();
    
    galleryLoader.classList.add('hidden');
    imageSuggestionsGrid.classList.remove('hidden');
    
    if (result.success) {
      suggestedImages = result.suggestions;
      galleryStatus.textContent = `Found ${result.suggestions.length} options`;
      renderSuggestions(result.suggestions);
    } else {
      galleryStatus.textContent = 'Failed to load suggestions';
      alert(`Error loading suggestions: ${result.error}`);
    }
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    galleryLoader.classList.add('hidden');
    galleryStatus.textContent = 'Error loading suggestions';
  }
}

// Render stock suggestions grid cards
function renderSuggestions(suggestions) {
  imageSuggestionsGrid.innerHTML = '';
  
  if (!suggestions || suggestions.length === 0) {
    imageSuggestionsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No suggestions returned. Try changing keywords.</div>';
    return;
  }
  
  suggestions.forEach(item => {
    const card = document.createElement('div');
    card.className = 'image-card-suggest';
    
    // Check if currently active
    const isCurrentActive = selectedPost.heroImage && (selectedPost.heroImage === item.url || (selectedPost.heroImage.includes(selectedPost.slug) && item.source === 'Imagen 4' && !item.requires_generation));
    if (isCurrentActive) {
      card.classList.add('selected');
    }
    
    if (item.requires_generation) {
      card.classList.add('requires-generation');
      card.innerHTML = `
        <div class="generation-overlay">
          <i data-lucide="sparkles" style="color:var(--primary); width:28px; height:28px;"></i>
          <p>Generate high-quality vector art via Gemini Imagen 4</p>
          <button class="btn btn-primary btn-sm" id="btn-gen-imagen" style="padding:6px 12px; font-size:11px;">
            <i data-lucide="play" style="width:12px; height:12px;"></i> Generate Image
          </button>
        </div>
        <div class="suggest-img-wrapper">
          <img src="${item.url}" alt="Imagen 4 Placeholder">
        </div>
        <div class="suggest-img-details">
          <span class="suggest-img-source">${item.source}</span>
          <span class="suggest-img-author">${item.photographer}</span>
        </div>
      `;
      
      // Bind explicit Imagen 4 trigger
      card.querySelector('#btn-gen-imagen').addEventListener('click', (e) => {
        e.stopPropagation();
        generateImagen4(card);
      });
    } else {
      card.innerHTML = `
        <div class="suggest-img-wrapper">
          <img src="${item.url}" alt="Stock suggestion" crossorigin="anonymous">
        </div>
        <div class="suggest-img-details">
          <span class="suggest-img-source">${item.source}</span>
          <span class="suggest-img-author" title="${item.photographer}">${item.photographer}</span>
        </div>
      `;
      
      // Bind selection click
      card.addEventListener('click', () => {
        selectImage(item.url, item.source);
      });
    }
    
    imageSuggestionsGrid.appendChild(card);
  });
  
  updateIcons();
}

// Generate Imagen 4 on-demand
async function generateImagen4(cardElem) {
  const overlay = cardElem.querySelector('.generation-overlay');
  const originalOverlayHtml = overlay.innerHTML;
  
  overlay.innerHTML = `
    <div class="spinner" style="width:24px; height:24px; border-width:3px;"></div>
    <p style="font-size:11px; margin-top:4px;">Gemini is rendering your vector artwork...</p>
  `;
  
  try {
    const res = await fetch(`${API_BASE}/api/images/generate-imagen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: selectedPost.title,
        description: selectedPost.description,
        slug: selectedPost.slug
      })
    });
    const result = await res.json();
    
    if (result.success) {
      // Re-populate card elements with generated preview
      overlay.remove();
      cardElem.classList.remove('requires-generation');
      const imgElem = cardElem.querySelector('.suggest-img-wrapper img');
      imgElem.src = result.imageUrl;
      
      // Auto-select the newly generated image
      await selectImage(result.imageUrl, 'Imagen 4', result.tempPath);
    } else {
      alert(`Imagen 4 generation failed: ${result.error}`);
      overlay.innerHTML = originalOverlayHtml;
      // Rebind trigger event
      cardElem.querySelector('#btn-gen-imagen').addEventListener('click', (e) => {
        e.stopPropagation();
        generateImagen4(cardElem);
      });
      updateIcons();
    }
  } catch (error) {
    console.error('Imagen generation request error:', error);
    alert(`Request error: ${error.message}`);
    overlay.innerHTML = originalOverlayHtml;
    // Rebind trigger
    cardElem.querySelector('#btn-gen-imagen').addEventListener('click', (e) => {
      e.stopPropagation();
      generateImagen4(cardElem);
    });
    updateIcons();
  }
}

// Select a suggestions card (stock URL or local temp)
async function selectImage(url, source, tempPath = null) {
  if (!selectedPost) return;
  
  // Disable clicks while saving
  const cards = document.querySelectorAll('.image-card-suggest');
  cards.forEach(c => c.style.pointerEvents = 'none');
  galleryStatus.textContent = 'Saving image selection...';
  
  try {
    const res = await fetch(`${API_BASE}/api/images/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: url,
        slug: selectedPost.slug,
        source: source,
        tempPath: tempPath
      })
    });
    const result = await res.json();
    
    if (result.success) {
      selectedPost.heroImage = result.heroImage;
      
      // Sync markdown editor if draft is open
      updateEditorHeroImageIfActive(selectedPost.slug, result.heroImage);
      
      // Update UI
      renderCurrentImagePreview();
      searchImageSuggestions(); // reloads list and updates active highlight
      
      alert(`Hero Image successfully updated to: ${result.heroImage}!`);
    } else {
      alert(`Failed to save image selection: ${result.error}`);
      cards.forEach(c => c.style.pointerEvents = 'auto');
      galleryStatus.textContent = 'Selection failed';
    }
  } catch (error) {
    console.error('Error selecting image:', error);
    alert(`Error: ${error.message}`);
    cards.forEach(c => c.style.pointerEvents = 'auto');
    galleryStatus.textContent = 'Selection failed';
  }
}

// Search Button Binding
btnSearchImages.addEventListener('click', searchImageSuggestions);

// Auto-search suggestions on pressing Enter in keyword input
imageSearchKeywords.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    searchImageSuggestions();
  }
});


// Drag and Drop File Handlers
function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

// Setup drag and drop events
;['dragenter', 'dragover'].forEach(eventName => {
  dragDropZone.addEventListener(eventName, () => {
    dragDropZone.classList.add('dragover');
  }, false);
});

;['dragleave', 'drop'].forEach(eventName => {
  dragDropZone.addEventListener(eventName, () => {
    dragDropZone.classList.remove('dragover');
  }, false);
});

// Drop handler
dragDropZone.addEventListener('drop', (e) => {
  preventDefaults(e);
  
  if (!selectedPost) {
    alert('Please select a blog post first before dropping files.');
    return;
  }
  
  const dt = e.dataTransfer;
  const files = dt.files;
  if (files && files.length > 0) {
    processUploadedFile(files[0]);
  }
}, false);

// Dragenter / dragover handlers
dragDropZone.addEventListener('dragenter', preventDefaults, false);
dragDropZone.addEventListener('dragover', preventDefaults, false);
dragDropZone.addEventListener('dragleave', preventDefaults, false);

// Browse click binding
browseFileBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  imageFileInput.click();
});

imageFileInput.addEventListener('change', () => {
  if (imageFileInput.files && imageFileInput.files.length > 0) {
    processUploadedFile(imageFileInput.files[0]);
  }
});

// Process file selected/dropped
function processUploadedFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Invalid file format. Please upload an image file (PNG, JPG, WEBP).');
    return;
  }
  
  if (file.size > 10 * 1024 * 1024) {
    alert('File is too large. Maximum size allowed is 10MB.');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    uploadedBase64 = e.target.result;
    uploadImagePreview.src = uploadedBase64;
    uploadFileName.textContent = file.name;
    uploadPreviewContainer.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

// Submit manually uploaded file
btnSubmitUpload.addEventListener('click', async () => {
  if (!uploadedBase64 || !selectedPost) return;
  
  btnSubmitUpload.disabled = true;
  btnSubmitUpload.innerHTML = '<div class="spinner" style="width:12px; height:12px; border-width:2px; display:inline-block; margin-right:4px;"></div> Uploading...';
  
  try {
    const res = await fetch(`${API_BASE}/api/images/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: uploadedBase64,
        slug: selectedPost.slug
      })
    });
    
    if (!res.ok) {
      let errorMsg = `Server error: ${res.status} ${res.statusText}`;
      if (res.status === 413) {
        errorMsg = 'Upload failed: Image file is too large for the server configuration (max 50MB).';
      }
      throw new Error(errorMsg);
    }
    
    const result = await res.json();
    
    if (result.success) {
      selectedPost.heroImage = result.heroImage;
      
      // Update Markdown editor frontmatter
      updateEditorHeroImageIfActive(selectedPost.slug, result.heroImage);
      
      // Re-render previews
      renderCurrentImagePreview();
      searchImageSuggestions(); // reload suggestions grid
      
      // Clear upload preview
      uploadedBase64 = null;
      uploadPreviewContainer.classList.add('hidden');
      imageFileInput.value = '';
      
      alert(`Success! Image uploaded and saved to: ${result.heroImage}`);
    } else {
      alert(`Upload failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    alert(`Upload connection error: ${error.message}`);
  } finally {
    btnSubmitUpload.disabled = false;
    btnSubmitUpload.innerHTML = '<i data-lucide="check"></i> Optimize & Set Hero Image';
    updateIcons();
  }
});

// Update editor text when a new hero image is selected
function updateEditorHeroImageIfActive(slug, heroImagePath) {
  if (activeDraft) {
    const editorSlug = slugInfo.getAttribute('data-slug');
    const isMatchingSlug = editorSlug === slug || slug === 'active-draft' || 
                           (loadedPosts.activeDraft && loadedPosts.activeDraft.slug === slug);
                           
    if (isMatchingSlug) {
      const match = activeDraft.match(/^---\r?\n([\s\S]+?)\r?\n---/);
      if (match) {
        let fm = match[1];
        if (fm.match(/heroImage:\s*.+/)) {
          fm = fm.replace(/heroImage:\s*.+/, `heroImage: "${heroImagePath}"`);
        } else {
          fm = fm.trim() + `\nheroImage: "${heroImagePath}"\n`;
        }
        const newContent = activeDraft.replace(/^---\r?\n([\s\S]+?)\r?\n---/, `---\n${fm}---`);
        
        // Update state and textarea
        activeDraft = newContent;
        markdownEditor.value = newContent;
        updatePreview(newContent);
        console.log("Synchronized hero image frontmatter with Markdown Editor.");
      }
    }
  }
}


// App Entry Point
window.addEventListener('DOMContentLoaded', async () => {
  updateIcons();
  await fetchConfig();
  await loadIdeas();
});
