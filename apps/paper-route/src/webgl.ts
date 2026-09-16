/** True when the device can create a WebGL context the 3D scene needs. */
export function hasWebGL(doc: Document = document): boolean {
  try {
    const canvas = doc.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Replaces the game with a plain message; no betting is offered on unsupported devices. */
export function showUnsupported(root: HTMLElement): void {
  root.replaceChildren();
  const box = document.createElement('div');
  box.setAttribute('role', 'alert');
  box.dataset.state = 'unsupported';
  box.style.cssText =
    'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:24px;text-align:center;pointer-events:auto;font-family:Chivo,sans-serif';
  const title = document.createElement('strong');
  title.textContent = 'This device is not supported';
  title.style.cssText = "font:900 28px Chivo,sans-serif;letter-spacing:-.4px";
  const body = document.createElement('p');
  body.textContent = 'Paper Route needs 3D graphics (WebGL), which this browser or device has turned off. No bet can be placed here.';
  body.style.cssText = 'margin:0;max-width:320px;font-size:15px;opacity:.75';
  box.append(title, body);
  root.appendChild(box);
}
