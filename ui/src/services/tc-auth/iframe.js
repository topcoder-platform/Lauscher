export default function createFrame(id, src) {
  const iframe = document.createElement('iframe');

  iframe.id = id;
  iframe.src = src;
  iframe.width = 0;
  iframe.height = 0;
  iframe.frameborder = 0;

  document.body.appendChild(iframe);

  return iframe;
}
