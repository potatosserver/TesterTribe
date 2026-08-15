// Template loader - loads HTML templates from /templates directory
const templateCache = {};

export async function loadTemplates() {
  const templates = [
    'header',
    'market',
    'app-detail',
    'dev-profile',
    'publish',
    'modals',
    'login'
  ];

  await Promise.all(
    templates.map(async (name) => {
      try {
        // Use relative path from JS to templates (since JS is in js/ folder)
        const response = await fetch(`../templates/${name}.html`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        templateCache[name] = await response.text();
      } catch (err) {
        console.error(`Failed to load template: ${name}`, err);
        // Show error in the body for debugging
        const errorDiv = document.createElement('div');
        errorDiv.style.color = 'red';
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '10px';
        errorDiv.style.left = '10px';
        errorDiv.style.zIndex = '9999';
        errorDiv.textContent = `Failed to load template ${name}: ${err}`;
        document.body.appendChild(errorDiv);
        templateCache[name] = '';
      }
    })
  );

  // Inject templates into DOM
  document.getElementById('header-container').innerHTML = templateCache['header'];
  document.getElementById('main-content').innerHTML = 
    templateCache['market'] + 
    templateCache['app-detail'] + 
    templateCache['dev-profile'] + 
    templateCache['publish'] +
    templateCache['login'];
  document.getElementById('modal-container').innerHTML = templateCache['modals'];
}

export function getTemplate(name) {
  return templateCache[name] || '';
}