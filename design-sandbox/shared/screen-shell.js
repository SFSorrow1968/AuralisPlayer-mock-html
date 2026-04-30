import { albums, artists, nowPlaying, playlists, tracks } from './mock-library.js';

const data = { albums, artists, nowPlaying, playlists, tracks };

function row(item, options = {}) {
  const artClass = options.round ? 'art round' : 'art';
  const right = options.right ? `<span>${options.right}</span>` : '';
  return `
    <div class="row">
      <div class="${artClass}"></div>
      <div>
        <strong>${item.title || item.name}</strong>
        <span>${item.artist || item.album || item.mood || `${item.albums || 0} albums · ${item.tracks || 0} tracks`}</span>
      </div>
      ${right}
    </div>
  `;
}

function card(album) {
  return `
    <article class="card" style="--accent:${album.accent}">
      <div class="cover"></div>
      <strong>${album.title}</strong>
      <span>${album.artist}</span>
    </article>
  `;
}

function miniPlayer() {
  return `
    <div class="mini-player">
      <div class="art"></div>
      <div>
        <strong>${nowPlaying.title}</strong>
        <span>${nowPlaying.artist}</span>
      </div>
      <div class="mini-controls">◀ ▶ ▶</div>
    </div>
    <nav class="bottom-nav">
      <div class="nav-dot active">⌂</div>
      <div class="nav-dot">▤</div>
    </nav>
  `;
}

function screenHeader(screen) {
  return `
    <div class="status">
      <span>12:00</span>
      <span class="status-icons">⌁ ▱</span>
    </div>
    <header class="topbar">
      <div>
        <p class="eyebrow">${screen.kicker || 'Design sandbox'}</p>
        <h1>${screen.title}</h1>
      </div>
      <div class="actions">
        ${(screen.actions || ['⚙', '+']).map((action) => `<button class="icon-button">${action}</button>`).join('')}
      </div>
    </header>
  `;
}

const sections = {
  hero(screen) {
    return `
      <section class="section panel">
        <p class="eyebrow">${screen.heroLabel || 'Focus'}</p>
        <h2>${screen.heroTitle || screen.title}</h2>
        <p class="meta">${screen.heroBody || 'A standalone layout surface for trying visual ideas safely.'}</p>
      </section>
    `;
  },
  albumHero(screen) {
    return `
      <section class="section">
        <div class="hero-art"></div>
        <div style="margin-top:18px">
          <p class="eyebrow">${screen.heroLabel || 'Album'}</p>
          <h2>${screen.heroTitle || albums[0].title}</h2>
          <p class="meta">${screen.heroBody || `${albums[0].artist} · ${albums[0].tracks} tracks`}</p>
        </div>
      </section>
    `;
  },
  search() {
    return `
      <label class="search">
        <span>⌕</span>
        <input value="dope" aria-label="Search" />
        <span>✕</span>
      </label>
      <div class="chip-row">
        <span class="chip">Playlists</span>
        <span class="chip active">Albums</span>
        <span class="chip">Artists</span>
      </div>
    `;
  },
  albumLens() {
    return `
      <section class="section">
        <div class="panel album-lens-card">
          ${row(albums[0])}
          <div class="pill primary" style="display:inline-flex;margin-top:10px">♪ Track match inside · ${tracks[0].title}</div>
        </div>
      </section>
    `;
  },
  rows(screen) {
    const source = data[screen.rows] || tracks;
    return `
      <section class="section">
        <h2>${screen.rowsTitle || 'Recent Activity'}</h2>
        ${source.slice(0, screen.rowsLimit || 6).map((item) => row(item, {
          round: screen.rows === 'artists',
          right: item.time
        })).join('')}
      </section>
    `;
  },
  cards(screen) {
    return `
      <section class="section">
        <h2>${screen.cardsTitle || 'Recently Added'}</h2>
        <div class="${screen.cardLayout || 'rail'}">${albums.slice(0, screen.cardsLimit || 5).map(card).join('')}</div>
      </section>
    `;
  },
  stats(screen) {
    return `
      <section class="section grid">
        ${(screen.stats || [
          ['19', 'albums'],
          ['4', 'artists'],
          ['254', 'tracks'],
          ['8', 'recent picks']
        ]).map(([value, label]) => `
          <div class="panel">
            <div class="big-number">${value}</div>
            <span>${label}</span>
          </div>
        `).join('')}
      </section>
    `;
  },
  controls() {
    return `
      <section class="section player-controls">
        <div class="hero-art"></div>
        <h2>${nowPlaying.title}</h2>
        <p class="meta">${nowPlaying.artist} · ${nowPlaying.album}</p>
        <div class="meter" style="--value:42%"><span></span></div>
        <div class="transport">
          <button>◀</button>
          <button class="play">▶</button>
          <button>▶</button>
        </div>
      </section>
    `;
  }
};

export function renderSandboxScreen(screen) {
  document.title = `${screen.title} Sandbox`;
  document.documentElement.style.setProperty('--accent', screen.accent || '#7c5cff');
  document.documentElement.style.setProperty('--accent-2', screen.accent2 || '#22d3ee');
  const root = document.querySelector('#sandbox-root');
  root.innerHTML = `
    <main class="sandbox-stage">
      <article class="phone">
        <div class="screen">
          ${screenHeader(screen)}
          ${(screen.blocks || ['hero', 'rows', 'cards']).map((block) => sections[block]?.(screen) || '').join('')}
        </div>
        ${screen.miniPlayer === false ? '' : miniPlayer()}
      </article>
    </main>
  `;
}

