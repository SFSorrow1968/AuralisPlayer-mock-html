const root = document.querySelector('#library-sandbox-root');
const { albums, artists, categories, songs } = window.LibrarySandboxData;

const state = {
  activeCategory: 'albums',
  query: 'dope'
};

const icons = {
  playlist: '<path d="M5 7h10M5 12h7M5 17h6"/><path d="M17 10v8"/><path d="M14 15h6"/>',
  album: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/>',
  artist: '<circle cx="12" cy="8" r="3"/><path d="M5 19c1.6-3.4 4-5 7-5s5.4 1.6 7 5"/>',
  song: '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  genre: '<path d="M12 4l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8z"/>',
  folder: '<path d="M3 7h7l2 2h9v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>',
  close: '<path d="m8 8 8 8M16 8l-8 8"/>',
  tune: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="M4 12h2M18 12h2M12 4v2M12 18v2M6.6 6.6 8 8M16 16l1.4 1.4M17.4 6.6 16 8M8 16l-1.4 1.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>',
  library: '<path d="M5 5h4v14H5zM10 5h4v14h-4zM15 5h4v14h-4z"/>',
  player: '<path d="M8 5v14l11-7z"/>',
  wifi: '<path d="M5 10c4.7-4 9.3-4 14 0M8 13c2.7-2 5.3-2 8 0M11 16c.7-.5 1.3-.5 2 0"/>',
  battery: '<rect x="3" y="7" width="16" height="10" rx="3"/><path d="M21 11v2"/>'
};

function svg(name, className = 'icon') {
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
}

function art(item, className = 'album-art') {
  return `<span class="${className}" style="--art:${item.color};--art-accent:${item.accent || item.color};"></span>`;
}

function normalize(value) {
  return value.toLowerCase().trim();
}

function getAlbumLensResults() {
  const query = normalize(state.query);
  if (!query) return albums;

  return albums.filter((album) => (
    normalize(album.title).includes(query)
    || normalize(album.artist).includes(query)
    || normalize(album.match).includes(query)
  ));
}

function getSongResults() {
  const query = normalize(state.query);
  if (!query) return songs;

  return songs.filter((song) => (
    normalize(song.title).includes(query)
    || normalize(song.artist).includes(query)
    || normalize(song.album).includes(query)
  ));
}

function getArtistResults() {
  const query = normalize(state.query);
  if (!query) return artists;

  return artists.filter((artist) => normalize(artist.name).includes(query));
}

function renderCategories() {
  return categories.map((category) => `
    <button class="library-nav-item ${state.activeCategory === category.id ? 'active' : ''}" data-category="${category.id}" type="button">
      <span class="library-nav-icon">${svg(category.icon)}</span>
      <span class="library-nav-copy">
        <strong>${category.label}</strong>
        <small>${category.count}</small>
      </span>
      <span class="library-nav-chevron">›</span>
    </button>
  `).join('');
}

function renderAlbumLens() {
  const matches = getAlbumLensResults();
  if (!matches.length) return renderEmptyState();

  return `
    <section class="search-section">
      <h2>Search</h2>
      <div class="section-rule"></div>
      ${matches.map((album) => `
        <article class="library-album-result" tabindex="0">
          ${art(album)}
          <span class="album-result-body">
            <strong>${album.title}</strong>
            <small>${album.artist}</small>
            ${state.query ? `<span class="track-match-pill">Track match inside: ${album.match}</span>` : ''}
          </span>
          <span class="album-result-meta">${album.trackCount} songs</span>
        </article>
      `).join('')}
    </section>
  `;
}

function renderSongs() {
  const matches = getSongResults();
  if (!matches.length) return renderEmptyState();

  return `
    <section class="search-section">
      <h2>${state.query ? 'Song Results' : 'Songs'}</h2>
      <div class="section-rule"></div>
      ${matches.map((song) => `
        <article class="song-row" tabindex="0">
          ${art(song, 'song-art')}
          <span class="song-copy">
            <strong>${song.title}</strong>
            <small>${song.artist} • ${song.album}</small>
          </span>
          <span class="duration">${song.duration}</span>
        </article>
      `).join('')}
    </section>
  `;
}

function renderArtists() {
  const matches = getArtistResults();
  if (!matches.length) return renderEmptyState();

  return `
    <section class="search-section">
      <h2>${state.query ? 'Artist Results' : 'Artists'}</h2>
      <div class="section-rule"></div>
      ${matches.map((artist) => `
        <article class="artist-row" tabindex="0">
          ${art(artist, 'artist-art')}
          <span>
            <strong>${artist.name}</strong>
            <small>${artist.meta}</small>
          </span>
        </article>
      `).join('')}
    </section>
  `;
}

function renderBrowse() {
  return `
    <section class="browse-panel">
      <div>
        <p class="eyebrow">Browse Library</p>
        <h2>Choose a category</h2>
      </div>
      <div class="album-grid">
        ${albums.map((album) => `
          <article class="album-card" tabindex="0">
            ${art(album)}
            <strong>${album.title}</strong>
            <small>${album.artist}</small>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderEmptyState() {
  return `
    <section class="empty-state">
      <strong>No matches here</strong>
      <small>Try another category, or clear the search to browse everything.</small>
    </section>
  `;
}

function renderResults() {
  if (!state.query) return renderBrowse();
  if (state.activeCategory === 'albums') return renderAlbumLens();
  if (state.activeCategory === 'artists') return renderArtists();
  if (state.activeCategory === 'songs') return renderSongs();
  return `
    <section class="search-section">
      <h2>${categories.find((item) => item.id === state.activeCategory)?.label || 'Library'}</h2>
      <div class="section-rule"></div>
      <article class="library-album-result" tabindex="0">
        ${art(albums[0])}
        <span class="album-result-body">
          <strong>${albums[0].title}</strong>
          <small>${albums[0].artist}</small>
          <span class="track-match-pill">Matching track lives in this collection</span>
        </span>
        <span class="album-result-meta">Open</span>
      </article>
    </section>
  `;
}

function render() {
  root.innerHTML = `
    <main class="sandbox-stage library-stage">
      <section class="library-phone" aria-label="Library design sandbox">
        <div class="phone-bezel"></div>
        <div class="library-screen ${state.query ? 'search-mode' : ''}">
          <header class="status-bar">
            <strong>12:00</strong>
            <span>${svg('wifi')}${svg('battery')}</span>
          </header>

          <div class="top-bar">
            <h1>Library</h1>
            <div class="top-actions">
              <button class="round-button" type="button" aria-label="Settings">${svg('settings')}</button>
              <button class="round-button soft" type="button" aria-label="Add">${svg('plus')}</button>
            </div>
          </div>

          <label class="dash-search library-searchbar">
            ${svg('search')}
            <input id="library-search-input" type="search" value="${state.query}" aria-label="Search library" placeholder="Search Library">
            <button class="search-tool clear-search" type="button" aria-label="Clear search">${svg('close')}</button>
            <button class="search-tool" type="button" aria-label="Sort and filter">${svg('tune')}</button>
          </label>

          <div class="library-nav-list" id="library-nav-container">
            ${renderCategories()}
          </div>

          <div id="search-results">
            ${renderResults()}
          </div>
        </div>

        <div class="mini-player-wrap">
          ${art(songs[0], 'mini-art')}
          <span>
            <strong>${songs[0].title}</strong>
            <small>${songs[0].artist}</small>
          </span>
          <button type="button" aria-label="Play">${svg('player')}</button>
        </div>

        <nav class="bottom-nav" aria-label="Sandbox navigation preview">
          <span class="nav-dot">${svg('home')}</span>
          <span class="nav-dot active">${svg('library')}</span>
          <span class="nav-dot">${svg('player')}</span>
        </nav>
      </section>
    </main>
  `;

  bindEvents();
}

function bindEvents() {
  root.querySelectorAll('[data-category]').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeCategory = button.dataset.category;
      render();
    });
  });

  root.querySelector('#library-search-input')?.addEventListener('input', (event) => {
    state.query = event.target.value;
    render();
    root.querySelector('#library-search-input')?.focus();
  });

  root.querySelector('.clear-search')?.addEventListener('click', () => {
    state.query = '';
    render();
  });
}

render();
