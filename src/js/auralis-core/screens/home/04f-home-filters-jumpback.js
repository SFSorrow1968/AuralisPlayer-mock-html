    function renderJumpBackSection(featuredAlbums) {
        const mod = getEl('marvis-mod-section');
        if (!mod) return;

        mod.innerHTML = '';
        const albums = Array.isArray(featuredAlbums) ? featuredAlbums.slice(0, 8) : [];
        if (albums.length === 0) return;

        albums.forEach(album => {
            if (isGrid) {
                const card = document.createElement('div');
                card.className = 'cat-card';
                card.draggable = true;
                card.dataset.albumTitle = album.title;
                card.dataset.added = String(album.year || 0);
                card.dataset.plays = String(200);
                card.dataset.duration = String(album.tracks[0]?.durationSec || 0);
                applyArtBackground(card, album.artUrl, FALLBACK_GRADIENT);
                if (!album.artUrl && typeof lazyLoadArt === 'function') lazyLoadArt(album, card);
                card.style.border = '1px solid rgba(255,255,255,0.2)';
                card.addEventListener('click', () => navToAlbum(album.title, album.artist, getAlbumSourceIdentity(album)));
                card.addEventListener('mousedown', (e) => startLongPress(e, album.title, album.artist));
                card.addEventListener('mouseup', clearLongPress);
                card.addEventListener('mouseleave', clearLongPress);

                const span = document.createElement('span');
                span.textContent = album.title;
                span.style.textShadow = '0 2px 8px rgba(0,0,0,0.8)';
                card.appendChild(span);
                const jbKey = getAlbumIdentityKey(album, album.artist);
                const jbPlayBtn = document.createElement('div');
                jbPlayBtn.className = 'catalog-play-btn';
                jbPlayBtn.dataset.collectionType = 'album';
                jbPlayBtn.dataset.collectionKey = jbKey;
                jbPlayBtn.innerHTML = getPlaybackIconSvg(isCollectionPlaying('album', jbKey));
                jbPlayBtn.addEventListener('click', (evt) => {
                    evt.stopPropagation();
                    if (isCollectionActive('album', jbKey)) { togglePlayback(evt); }
                    else { playAlbumInOrder(album.title, 0, album.artist); }
                });
                card.appendChild(jbPlayBtn);
                mod.appendChild(card);
                return;
            }

            const card = document.createElement('div');
            card.className = 'media-card';
            card.addEventListener('click', () => navToAlbum(album.title, album.artist, getAlbumSourceIdentity(album)));
            card.addEventListener('mousedown', (e) => startLongPress(e, album.title, album.artist));
            card.addEventListener('mouseup', clearLongPress);
            card.addEventListener('mouseleave', clearLongPress);
            card.addEventListener('touchstart', (e) => startLongPress(e, album.title, album.artist), { passive: true });
            card.addEventListener('touchend', clearLongPress, { passive: true });

            const cover = document.createElement('div');
            cover.className = 'media-cover';
            applyArtBackground(cover, album.artUrl, FALLBACK_GRADIENT);
            if (!album.artUrl && typeof lazyLoadArt === 'function') lazyLoadArt(album, cover);
            const jbKey = getAlbumIdentityKey(album, album.artist);
            const jbPlayBtn = document.createElement('div');
            jbPlayBtn.className = 'catalog-play-btn';
            jbPlayBtn.dataset.collectionType = 'album';
            jbPlayBtn.dataset.collectionKey = jbKey;
            jbPlayBtn.innerHTML = getPlaybackIconSvg(isCollectionPlaying('album', jbKey));
            jbPlayBtn.addEventListener('click', (evt) => {
                evt.stopPropagation();
                if (isCollectionActive('album', jbKey)) { togglePlayback(evt); }
                else { playAlbumInOrder(album.title, 0, album.artist); }
            });
            cover.appendChild(jbPlayBtn);

            const wrap = document.createElement('div');
            const t = document.createElement('div');
            t.className = 'media-title';
            t.textContent = album.title;
            const s = document.createElement('div');
            s.className = 'media-sub';
            s.textContent = `${album.artist} - Album`;
            wrap.appendChild(t);
            wrap.appendChild(s);

            card.appendChild(cover);
            card.appendChild(wrap);
            mod.appendChild(card);
        });
    }

    function clearHomePlaceholders() {
        document.querySelectorAll('.home-placeholder').forEach(el => el.remove());
    }

    function createHomePlaceholder(typeLabel) {
        const container = document.createElement('div');
        container.className = 'home-placeholder card';
        container.style.cssText = 'text-align:center; margin-top:16px;';

        const h3 = document.createElement('h3');
        h3.style.cssText = 'margin-bottom:8px; color:var(--text-primary);';
        h3.textContent = `No ${typeLabel} here yet`;

        const p = document.createElement('p');
        p.style.marginBottom = '16px';
        p.textContent = 'Your local library has no matching items. Try browsing to add more.';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn';
        btn.style.cssText = 'width:auto; padding:10px 20px; font-size:13px;';
        btn.textContent = 'Browse Catalog';
        btn.addEventListener('click', () => switchTab('library', getEl('tabs')?.querySelectorAll('.nav-item')[1]));

        container.appendChild(h3);
        container.appendChild(p);
        container.appendChild(btn);
        return container;
    }

    function filterHome(type) {
        const mus = getEl('home-music-section');
        const vid = getEl('home-videos-section');
        if (!mus || !vid) return;

        clearHomePlaceholders();

        if (type === 'all') {
            mus.style.display = 'block';
            vid.style.display = 'block';
            toast('Filtering: All Content');
            return;
        }

        if (type === 'music') {
            mus.style.display = 'block';
            vid.style.display = 'none';
            toast('Filtering: Songs');
            return;
        }

        if (type === 'videos') {
            mus.style.display = 'none';
            vid.style.display = 'block';
            toast('Filtering: Videos');
            return;
        }

        if (type === 'Albums' || type === 'Artists') {
            mus.style.display = 'block';
            vid.style.display = 'none';
            toast(`Filtering: ${type}`);
            return;
        }

        mus.style.display = 'none';
        vid.style.display = 'none';
        getEl('home').appendChild(createHomePlaceholder(type));
        toast(`Filtering: ${type}`);
    }
