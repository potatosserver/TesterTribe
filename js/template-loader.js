// Template loader - loads HTML templates from /templates directory
const templateCache = {};

export async function loadTemplates() {
  const templates = [
    'header',
    'market',
    'app-detail',
    'dev-profile',
    'publish',
    'account',
    'modals'
  ];

  await Promise.all(
    templates.map(async (name) => {
      try {
        const response = await fetch(`templates/${name}.html`);
        templateCache[name] = await response.text();
      } catch (err) {
        console.error(`Failed to load template: ${name}`, err);
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
    templateCache['account'];
  document.getElementById('modal-container').innerHTML = templateCache['modals'];
}

export function getTemplate(name) {
  return templateCache[name] || '';
}