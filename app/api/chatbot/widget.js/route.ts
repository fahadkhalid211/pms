import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const baseUrl = `${protocol}://${host}`;

  const jsContent = `
(function() {
  if (window.__lumina_widget_initialized) return;
  window.__lumina_widget_initialized = true;

  var script = document.currentScript || document.querySelector('script[src*="widget.js"]');
  var orgId = script ? (script.getAttribute('data-org') || '') : '';
  var propId = script ? (script.getAttribute('data-property') || '') : '';
  var apiBase = "${baseUrl}";

  var container = document.createElement('div');
  container.id = 'lumina-chat-widget';
  container.style.position = 'fixed';
  container.style.bottom = '20px';
  container.style.right = '20px';
  container.style.zIndex = '999999';
  container.style.fontFamily = 'system-ui, -apple-system, sans-serif';

  var button = document.createElement('button');
  button.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>';
  button.style.width = '56px';
  button.style.height = '56px';
  button.style.borderRadius = '50%';
  button.style.background = '#6D28D9';
  button.style.color = '#FFFFFF';
  button.style.border = 'none';
  button.style.cursor = 'pointer';
  button.style.boxShadow = '0 10px 25px -5px rgba(109, 40, 217, 0.5)';
  button.style.display = 'flex';
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';

  var panel = document.createElement('div');
  panel.style.display = 'none';
  panel.style.width = '360px';
  panel.style.height = '500px';
  panel.style.borderRadius = '16px';
  panel.style.background = '#090D16';
  panel.style.border = '1px solid #2E1065';
  panel.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.6)';
  panel.style.flexDirection = 'column';
  panel.style.overflow = 'hidden';
  panel.style.marginBottom = '12px';

  panel.innerHTML = [
    '<div style="padding: 16px; background: #130E26; border-bottom: 1px solid #2E1065; display: flex; align-items: center; justify-content: space-between;">',
    '  <div><div style="font-weight: 600; color: #FFFFFF; font-size: 14px;">Hotel Assistant</div><div style="font-size: 12px; color: #A78BFA;">Always here to help</div></div>',
    '  <button id="lumina-close" style="background: none; border: none; color: #9CA3AF; cursor: pointer; font-size: 18px;">&times;</button>',
    '</div>',
    '<div id="lumina-msgs" style="flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; font-size: 13px;">',
    '  <div style="background: #1C1538; color: #EDE9FE; padding: 10px 14px; border-radius: 12px; max-width: 85%;">Hello! How can I assist you with your stay, availability, or policies today?</div>',
    '</div>',
    '<div style="padding: 12px; border-top: 1px solid #2E1065; display: flex; gap: 8px;">',
    '  <input id="lumina-input" type="text" placeholder="Type your question..." style="flex: 1; background: #130E26; border: 1px solid #3B1C78; border-radius: 8px; padding: 8px 12px; color: #FFFFFF; font-size: 13px; outline: none;" />',
    '  <button id="lumina-send" style="background: #6D28D9; border: none; border-radius: 8px; color: #FFFFFF; padding: 8px 14px; cursor: pointer; font-size: 13px;">Send</button>',
    '</div>'
  ].join('');

  container.appendChild(panel);
  container.appendChild(button);
  document.body.appendChild(container);

  var isOpen = false;
  button.onclick = function() {
    isOpen = !isOpen;
    panel.style.display = isOpen ? 'flex' : 'none';
  };

  container.querySelector('#lumina-close').onclick = function() {
    isOpen = false;
    panel.style.display = 'none';
  };

  var sessionKey = 'guest_' + Math.random().toString(36).substring(2, 9);
  var input = container.querySelector('#lumina-input');
  var sendBtn = container.querySelector('#lumina-send');
  var msgs = container.querySelector('#lumina-msgs');

  function sendMessage() {
    var txt = input.value.trim();
    if (!txt) return;
    input.value = '';

    var userDiv = document.createElement('div');
    userDiv.style.background = '#6D28D9';
    userDiv.style.color = '#FFFFFF';
    userDiv.style.padding = '10px 14px';
    userDiv.style.borderRadius = '12px';
    userDiv.style.alignSelf = 'flex-end';
    userDiv.style.maxWidth = '85%';
    userDiv.innerText = txt;
    msgs.appendChild(userDiv);
    msgs.scrollTop = msgs.scrollHeight;

    fetch(apiBase + '/api/chatbot/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: orgId,
        propertyId: propId || null,
        sessionKey: sessionKey,
        message: txt
      })
    })
    .then(function(res) { return res.json(); })
    .then(function(json) {
      var botDiv = document.createElement('div');
      botDiv.style.background = '#1C1538';
      botDiv.style.color = '#EDE9FE';
      botDiv.style.padding = '10px 14px';
      botDiv.style.borderRadius = '12px';
      botDiv.style.alignSelf = 'flex-start';
      botDiv.style.maxWidth = '85%';
      botDiv.innerText = json.success ? json.data.reply : 'Sorry, I am unable to answer right now.';
      msgs.appendChild(botDiv);
      msgs.scrollTop = msgs.scrollHeight;
    })
    .catch(function() {
      var errDiv = document.createElement('div');
      errDiv.style.color = '#F87171';
      errDiv.style.fontSize = '12px';
      errDiv.innerText = 'Network error. Please try again.';
      msgs.appendChild(errDiv);
    });
  }

  sendBtn.onclick = sendMessage;
  input.onkeydown = function(e) { if (e.key === 'Enter') sendMessage(); };
})();
  `.trim();

  return new NextResponse(jsContent, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
