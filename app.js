/* ==========================================
   SORTIE ACADÉMIQUE - PRODUCTION ANIMALE
   V3.1 : Correction du conflit de variable
   ========================================== */

const STUDENTS = [
    { id: 'E1', name: 'ALCENA Josué' },
    { id: 'E2', name: 'CELINÉ Georges' },
    { id: 'E3', name: 'CHARLES Lookendy Dukens' },
    { id: 'E4', name: 'DAVILMA Budelin' },
    { id: 'E5', name: 'EXCEUS Malorie' },
    { id: 'E6', name: 'FLEURANT Josué' },
    { id: 'E7', name: 'LEMEUBLE Angelo' },
    { id: 'E8', name: 'PAUL Mackenley' },
    { id: 'E9', name: 'PIERRE David' }
];

const BUCKET = 'memories'; // Si tu as nommé ton bucket 'souvenirs', change-le ici !
const TABLE = 'memories';

let supabaseClient = null; // <-- VARIABLE RENOMMÉE ICI
let memories = [];
let currentFilter = 'Tous';
let currentStudent = null;
let pendingMedia = null;
let pendingMediaType = null;
let pendingFile = null;

/* -------- Init Supabase -------- */
function initSupabase() {
    if (typeof SUPABASE_URL === 'undefined' || SUPABASE_URL.includes('TON_PROJET')) {
        alert("⚠️ Configure d'abord tes clés Supabase dans config.js !");
        return false;
    }
    // On utilise window.supabase (la librairie) pour créer notre client
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return true;
}

/* -------- Chargement depuis Supabase -------- */
async function loadMemories() {
    showLoading(true);
    const { data, error } = await supabaseClient
        .from(TABLE)
        .select('*')
        .order('date', { ascending: false });
    showLoading(false);

    if (error) {
        console.error('Erreur chargement:', error);
        alert("Erreur de chargement : " + error.message);
        memories = [];
    } else {
        memories = data || [];
    }
    renderTeam();
    renderCatalog();
}

function showLoading(show) {
    document.getElementById('loadingMsg').style.display = show ? 'block' : 'none';
    if (show) document.getElementById('catalogGrid').innerHTML = '';
}

/* -------- Upload fichier vers Supabase Storage -------- */
async function uploadFileToStorage(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { data, error } = await supabaseClient.storage
        .from(BUCKET)
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type
        });

    if (error) throw new Error("Upload échoué : " + error.message);

    const { data: urlData } = supabaseClient.storage
        .from(BUCKET)
        .getPublicUrl(fileName);

    return urlData.publicUrl;
}

/* -------- Helpers média -------- */
function getYouTubeId(url) {
    if (!url) return null;
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
}
function detectMediaType(url) {
    if (!url) return 'image';
    if (getYouTubeId(url)) return 'youtube';
    if (/\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(url)) return 'video';
    return 'image';
}
function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
function formatDate(d) {
    if (!d) return 'Date inconnue';
    try {
        return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return d; }
}

/* -------- Rendu équipe -------- */
function renderTeam() {
    const grid = document.getElementById('teamGrid');
    grid.innerHTML = STUDENTS.map(s => {
        const count = memories.filter(m => m.student === s.id).length;
        const active = currentStudent === s.id;
        return `
      <button class="team-card ${active ? 'active' : ''}" data-student="${s.id}" type="button">
        ${count > 0 ? `<span class="count-badge">${count}</span>` : ''}
        <div class="avatar">${s.id}</div>
        <h3>${escapeHtml(s.name)}</h3>
        <small>${count} souvenir${count > 1 ? 's' : ''}</small>
      </button>`;
    }).join('');

    grid.querySelectorAll('.team-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = card.dataset.student;
            currentStudent = (currentStudent === id) ? null : id;
            currentFilter = 'Tous';
            updateStudentFilter();
        });
    });
}

function updateStudentFilter() {
    renderTeam();
    renderFilters();
    renderCatalog();
    if (currentStudent) {
        document.getElementById('catalogue').scrollIntoView({ behavior: 'smooth' });
    }
}

/* -------- Filtres -------- */
function renderFilters() {
    const categories = ['Tous', 'Visites', 'Animaux', 'Paysages', 'Équipe', 'Moments'];
    const box = document.getElementById('filters');
    box.innerHTML = categories.map(c => `
    <button class="filter-btn ${c === currentFilter ? 'active' : ''}" data-cat="${c}">${c}</button>
  `).join('');
    box.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentFilter = btn.dataset.cat;
            renderFilters();
            renderCatalog();
        });
    });
}

/* -------- Rendu catalogue -------- */
function renderCardMedia(m) {
    const yt = getYouTubeId(m.media || '');
    if (yt) {
        return `<img src="https://img.youtube.com/vi/${yt}/hqdefault.jpg" alt=""
              onerror="this.src='https://picsum.photos/seed/${m.id}/800/600'">`;
    }
    if (m.media_type === 'video') {
        return `<video src="${m.media}" preload="metadata" muted playsinline></video>`;
    }
    return `<img src="${m.media}" alt="" loading="lazy"
            onerror="this.src='https://picsum.photos/seed/${m.id}/800/600'">`;
}

function renderCatalog() {
    const grid = document.getElementById('catalogGrid');
    const emptyMsg = document.getElementById('emptyMsg');
    const banner = document.getElementById('studentBanner');
    const bannerText = document.getElementById('studentBannerText');
    const titleEl = document.getElementById('catalogTitle');
    const subtitleEl = document.getElementById('catalogSubtitle');

    if (currentStudent) {
        const s = STUDENTS.find(x => x.id === currentStudent);
        bannerText.textContent = `📁 Souvenirs de ${s.id} — ${s.name}`;
        banner.style.display = 'flex';
        titleEl.textContent = `Souvenirs de ${s.name}`;
        subtitleEl.textContent = `Photos et vidéos partagées par ${s.name}`;
    } else {
        banner.style.display = 'none';
        titleEl.textContent = 'Catalogue des Souvenirs';
        subtitleEl.textContent = 'Nos plus beaux moments capturés lors de cette sortie';
    }

    let list = [...memories];
    if (currentStudent) list = list.filter(m => m.student === currentStudent);
    if (currentFilter !== 'Tous') list = list.filter(m => m.category === currentFilter);
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (list.length === 0) {
        grid.innerHTML = '';
        emptyMsg.style.display = 'block';
        emptyMsg.textContent = currentStudent
            ? `Aucun souvenir pour ${currentStudent} dans cette catégorie.`
            : 'Aucun souvenir dans cette catégorie.';
    } else {
        emptyMsg.style.display = 'none';
        grid.innerHTML = list.map(m => {
            const isVideo = m.media_type === 'video' || getYouTubeId(m.media);
            return `
        <article class="memory-card">
          <div class="media-wrap" data-id="${m.id}">
            ${renderCardMedia(m)}
            ${isVideo ? '<div class="play-icon">▶</div>' : ''}
          </div>
          <div class="memory-body">
            <div class="memory-top">
              <span class="memory-tag">${escapeHtml(m.category)}</span>
              ${m.student ? `<span class="memory-student">${m.student}</span>` : ''}
            </div>
            <h3>${escapeHtml(m.title)}</h3>
            <p class="memory-date">📅 ${formatDate(m.date)}</p>
            <p class="memory-desc">${escapeHtml(m.description || '')}</p>
            <button class="delete-btn" data-del="${m.id}">🗑 Supprimer</button>
          </div>
        </article>`;
        }).join('');
    }

    const totalVideos = memories.filter(m => m.media_type === 'video' || getYouTubeId(m.media)).length;
    document.getElementById('memoryCount').textContent = memories.length;
    document.getElementById('photoCount').textContent = memories.length - totalVideos;
    document.getElementById('videoCount').textContent = totalVideos;

    grid.querySelectorAll('.media-wrap').forEach(w => {
        w.addEventListener('click', () => openLightbox(w.dataset.id));
    });
    grid.querySelectorAll('[data-del]').forEach(btn => {
        btn.addEventListener('click', () => deleteMemory(Number(btn.dataset.del)));
    });
}

/* -------- Ajout -------- */
function populateStudentSelect() {
    const sel = document.getElementById('studentInput');
    sel.innerHTML = `<option value="">— Toute l'équipe —</option>` +
        STUDENTS.map(s => `<option value="${s.id}">${s.id} — ${escapeHtml(s.name)}</option>`).join('');
}

function openAddModal() {
    document.getElementById('addModal').classList.add('active');
    document.getElementById('memoryForm').reset();
    document.getElementById('previewBox').style.display = 'none';
    document.getElementById('uploadStatus').style.display = 'none';
    document.getElementById('submitBtn').disabled = false;
    document.getElementById('submitBtn').textContent = 'Enregistrer le souvenir';
    pendingMedia = null;
    pendingMediaType = null;
    pendingFile = null;
    document.getElementById('dateInput').valueAsDate = new Date();
    if (currentStudent) document.getElementById('studentInput').value = currentStudent;
}
function closeAddModal() {
    document.getElementById('addModal').classList.remove('active');
}

function showMediaPreview(src, type) {
    const box = document.getElementById('previewBox');
    const content = document.getElementById('previewContent');
    const yt = getYouTubeId(src);
    if (yt) {
        content.innerHTML = `<img src="https://img.youtube.com/vi/${yt}/hqdefault.jpg" alt="aperçu">
      <span class="preview-label">▶ Vidéo YouTube</span>`;
    } else if (type === 'video') {
        content.innerHTML = `<video src="${src}" controls muted></video>
      <span class="preview-label">▶ Vidéo</span>`;
    } else {
        content.innerHTML = `<img src="${src}" alt="aperçu">`;
    }
    box.style.display = 'block';
}

function setUploadStatus(msg, type) {
    const el = document.getElementById('uploadStatus');
    el.textContent = msg;
    el.className = 'upload-status ' + (type || '');
    el.style.display = 'block';
}

/* -------- Suppression -------- */
async function deleteMemory(id) {
    if (!confirm("Supprimer ce souvenir ?")) return;

    const mem = memories.find(m => m.id === id);
    if (!mem) return;

    if (mem.media && mem.media.includes(`/storage/v1/object/public/${BUCKET}/`)) {
        const path = mem.media.split(`/public/${BUCKET}/`)[1];
        if (path) {
            await supabaseClient.storage.from(BUCKET).remove([path]);
        }
    }

    const { error } = await supabaseClient.from(TABLE).delete().eq('id', id);
    if (error) { alert("Erreur : " + error.message); return; }

    memories = memories.filter(m => m.id !== id);
    renderTeam();
    renderCatalog();
}

/* -------- Lightbox -------- */
function openLightbox(id) {
    const m = memories.find(x => String(x.id) === String(id));
    if (!m) return;
    const content = document.getElementById('lightboxContent');
    const yt = getYouTubeId(m.media || '');
    if (yt) {
        content.innerHTML = `<iframe src="https://www.youtube.com/embed/${yt}?autoplay=1"
      allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    } else if (m.media_type === 'video') {
        content.innerHTML = `<video src="${m.media}" controls autoplay></video>`;
    } else {
        content.innerHTML = `<img src="${m.media}" alt="${escapeHtml(m.title)}">`;
    }
    const suffix = m.student ? ` • ${m.student}` : '';
    document.getElementById('lightboxCaption').textContent =
        `${m.title} — ${formatDate(m.date)}${suffix}`;
    document.getElementById('lightbox').classList.add('active');
}
function closeLightbox() {
    document.getElementById('lightbox').classList.remove('active');
    document.getElementById('lightboxContent').innerHTML = '';
}

/* -------- INIT -------- */
async function init() {
    renderTeam();
    renderFilters();
    document.getElementById('studentCount').textContent = STUDENTS.length;

    if (!initSupabase()) {
        document.getElementById('loadingMsg').style.display = 'none';
        return;
    }

    populateStudentSelect();
    await loadMemories();

    document.getElementById('btnAdd').addEventListener('click', openAddModal);
    document.getElementById('closeModal').addEventListener('click', closeAddModal);
    document.getElementById('addModal').addEventListener('click', (e) => {
        if (e.target.id === 'addModal') closeAddModal();
    });

    document.getElementById('btnRefresh').addEventListener('click', loadMemories);

    document.getElementById('clearStudentFilter').addEventListener('click', () => {
        currentStudent = null;
        currentFilter = 'Tous';
        updateStudentFilter();
    });

    document.getElementById('mediaFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        document.getElementById('mediaUrl').value = '';

        if (file.type.startsWith('image/')) {
            if (file.size > 10 * 1024 * 1024) {
                alert("⚠️ Image trop lourde (> 10 Mo).");
                e.target.value = '';
                return;
            }
            pendingFile = file;
            pendingMediaType = 'image';
            const reader = new FileReader();
            reader.onload = ev => showMediaPreview(ev.target.result, 'image');
            reader.readAsDataURL(file);
            pendingMedia = null;
        } else if (file.type.startsWith('video/')) {
            if (file.size > 25 * 1024 * 1024) {
                alert("⚠️ Vidéo trop lourde (> 25 Mo).");
                e.target.value = '';
                return;
            }
            pendingFile = file;
            pendingMediaType = 'video';
            const url = URL.createObjectURL(file);
            showMediaPreview(url, 'video');
            pendingMedia = null;
        } else {
            alert("Format non supporté.");
            e.target.value = '';
        }
    });

    document.getElementById('mediaUrl').addEventListener('input', (e) => {
        const url = e.target.value.trim();
        if (!url) return;
        document.getElementById('mediaFile').value = '';
        pendingFile = null;
        pendingMedia = url;
        pendingMediaType = detectMediaType(url);
        showMediaPreview(url, pendingMediaType);
    });

    document.getElementById('memoryForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('submitBtn');
        const title = document.getElementById('titleInput').value.trim();
        const date = document.getElementById('dateInput').value;
        const student = document.getElementById('studentInput').value;
        const category = document.getElementById('categoryInput').value;
        const description = document.getElementById('descInput').value.trim();
        const urlInput = document.getElementById('mediaUrl').value.trim();

        submitBtn.disabled = true;
        submitBtn.textContent = 'Enregistrement...';

        try {
            let media, mediaType;

            if (pendingFile) {
                setUploadStatus("📤 Envoi du fichier en cours...", "loading");
                media = await uploadFileToStorage(pendingFile);
                mediaType = pendingMediaType;
                setUploadStatus("✅ Fichier envoyé !", "");
            } else if (urlInput) {
                media = urlInput;
                mediaType = detectMediaType(urlInput);
            } else if (pendingMedia) {
                media = pendingMedia;
                mediaType = pendingMediaType;
            } else {
                alert("Choisis une image, une vidéo ou une URL.");
                submitBtn.disabled = false;
                submitBtn.textContent = 'Enregistrer le souvenir';
                return;
            }

            setUploadStatus("💾 Enregistrement dans la base...", "loading");
            const { error } = await supabaseClient.from(TABLE).insert({
                title, date, student: student || null,
                category, description, media, media_type: mediaType
            });

            if (error) throw new Error(error.message);

            setUploadStatus("✅ Souvenir ajouté !", "");
            await loadMemories();
            setTimeout(closeAddModal, 500);
        } catch (err) {
            console.error(err);
            setUploadStatus("❌ " + err.message, "error");
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enregistrer le souvenir';
        }
    });

    document.getElementById('closeLightbox').addEventListener('click', closeLightbox);
    document.getElementById('lightbox').addEventListener('click', (e) => {
        if (e.target.id === 'lightbox') closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAddModal();
            closeLightbox();
        }
    });
}

document.addEventListener('DOMContentLoaded', init);