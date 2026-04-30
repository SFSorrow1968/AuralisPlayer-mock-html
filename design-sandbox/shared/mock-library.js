export const albums = [
  { title: 'Mental Masturbation (1998)', artist: "da' Skunk Junkies", tracks: 6, accent: '#7c5cff' },
  { title: 'Electro-Shock Blues', artist: 'EELS', tracks: 16, accent: '#22d3ee' },
  { title: 'Watermark', artist: 'Enya', tracks: 11, accent: '#2dd4bf' },
  { title: 'Double Nickels On The Dime', artist: 'Minutemen', tracks: 45, accent: '#f97316' },
  { title: '3-Way Tie (For Last)', artist: 'Minutemen', tracks: 16, accent: '#f43f5e' },
  { title: 'Ballot Result', artist: 'Minutemen', tracks: 12, accent: '#a3e635' }
];

export const tracks = [
  { title: "Dope Smokin' Hippie", artist: "da' Skunk Junkies", album: 'Mental Masturbation (1998)', time: '2:30' },
  { title: 'Life As A Nun', artist: "da' Skunk Junkies", album: 'Mental Masturbation (1998)', time: '3:03' },
  { title: 'Bonnie and Clyde', artist: "da' Skunk Junkies", album: 'Mental Masturbation (1998)', time: '2:52' },
  { title: 'Last Stop This Town', artist: 'EELS', album: 'Electro-Shock Blues', time: '3:27' },
  { title: 'Orinoco Flow', artist: 'Enya', album: 'Watermark', time: '4:26' },
  { title: 'Political Song For Michael Jackson To Sing', artist: 'Minutemen', album: 'Double Nickels On The Dime', time: '1:31' }
];

export const artists = [
  { name: "da' Skunk Junkies", albums: 1, tracks: 6 },
  { name: 'EELS', albums: 1, tracks: 16 },
  { name: 'Enya', albums: 1, tracks: 11 },
  { name: 'Minutemen', albums: 16, tracks: 221 }
];

export const playlists = [
  { title: 'Late Night Static', tracks: 18, mood: 'glowing, strange, focused' },
  { title: 'Tiny Albums Club', tracks: 42, mood: 'short records, big opinions' },
  { title: 'Velvet Queue', tracks: 11, mood: 'soft edges, good bass' }
];

export const nowPlaying = tracks[0];

