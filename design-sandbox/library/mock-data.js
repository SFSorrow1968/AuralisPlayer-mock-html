export const categories = [
  { id: 'playlists', label: 'Playlists', count: '14 mixes', icon: 'playlist' },
  { id: 'albums', label: 'Albums', count: '42 records', icon: 'album' },
  { id: 'artists', label: 'Artists', count: '18 profiles', icon: 'artist' },
  { id: 'songs', label: 'Songs', count: '315 tracks', icon: 'song' },
  { id: 'genres', label: 'Genres', count: '9 moods', icon: 'genre' },
  { id: 'folders', label: 'Folders', count: '3 sources', icon: 'folder' }
];

export const albums = [
  {
    id: 'mental-masturbation',
    title: 'Mental Masturbation (1998)',
    artist: "da' Skunk Junkies",
    year: '1998',
    trackCount: 9,
    match: "Dope Smokin' Hippie",
    color: '#d9dee7',
    accent: '#5369a6'
  },
  {
    id: 'electro-shock-blues',
    title: 'Electro-Shock Blues',
    artist: 'EELS',
    year: '1998',
    trackCount: 16,
    match: 'Hospital Food',
    color: '#74879a',
    accent: '#e0b34f'
  },
  {
    id: 'watermark',
    title: 'Watermark',
    artist: 'Enya',
    year: '1988',
    trackCount: 12,
    match: 'Storms in Africa',
    color: '#6e90a8',
    accent: '#a9d6ef'
  },
  {
    id: 'double-nickels',
    title: 'Double Nickels on the Dime',
    artist: 'Minutemen',
    year: '1984',
    trackCount: 45,
    match: 'Political Song for Michael Jackson to Sing',
    color: '#c9985f',
    accent: '#27211d'
  }
];

export const artists = [
  { id: 'skunk-junkies', name: "da' Skunk Junkies", meta: '1 album, 9 songs', color: '#5369a6' },
  { id: 'eels', name: 'EELS', meta: '3 albums, 31 songs', color: '#e0b34f' },
  { id: 'enya', name: 'Enya', meta: '2 albums, 24 songs', color: '#83c7ed' },
  { id: 'minutemen', name: 'Minutemen', meta: '2 albums, 57 songs', color: '#c9985f' },
  { id: 'massive-attack', name: 'Massive Attack', meta: '1 album, 11 songs', color: '#9ca3af' }
];

export const songs = [
  {
    id: 'dope-smokin-hippie',
    title: "Dope Smokin' Hippie",
    artist: "da' Skunk Junkies",
    album: 'Mental Masturbation (1998)',
    duration: '2:30',
    color: '#d9dee7',
    accent: '#5369a6'
  },
  {
    id: 'hospital-food',
    title: 'Hospital Food',
    artist: 'EELS',
    album: 'Electro-Shock Blues',
    duration: '3:23',
    color: '#74879a',
    accent: '#e0b34f'
  },
  {
    id: 'storms-in-africa',
    title: 'Storms in Africa',
    artist: 'Enya',
    album: 'Watermark',
    duration: '4:05',
    color: '#6e90a8',
    accent: '#a9d6ef'
  },
  {
    id: 'political-song',
    title: 'Political Song for Michael Jackson to Sing',
    artist: 'Minutemen',
    album: 'Double Nickels on the Dime',
    duration: '1:31',
    color: '#c9985f',
    accent: '#27211d'
  }
];
