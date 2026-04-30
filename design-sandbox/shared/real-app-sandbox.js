(function () {
  const root = document.querySelector('[data-real-app-sandbox-root]');
  const screenName = document.body.dataset.screen || 'home';
  if (!root) return;

  const appUrl = new URL('../../Auralis_mock_zenith.html', window.location.href);
  appUrl.searchParams.set('designSandbox', screenName);
  appUrl.searchParams.set('sandboxVersion', 'real-app-slice-1');

  const note = document.createElement('div');
  note.className = 'sandbox-load-note';
  note.textContent = 'Loading the real Auralis screen...';

  const frame = document.createElement('iframe');
  frame.className = 'real-app-frame';
  frame.title = `${screenName.replace(/-/g, ' ')} real app sandbox`;
  frame.src = appUrl.href;

  root.append(note, frame);

  frame.addEventListener('load', () => {
    note.remove();
  });
}());
