/**
 * Renders a LibreDesk SMS template.
 * @param {string} templateString - The template containing placeholders
 * @param {Object} variables - variables mapping e.g { ref: '123', message: 'Hello' }
 * @returns {string} The rendered SMS body
 */
function renderTemplate(templateString, variables) {
  if (!templateString) return '';
  
  let result = templateString;

  // Render {ref} or #{ref}
  if (variables.ref) {
    const safeRef = String(variables.ref);
    result = result.replace(/#\{ref\}/g, safeRef);
    result = result.replace(/\{ref\}/g, safeRef);
  }

  // Render {message}
  if (variables.message !== undefined) {
    const safeMsg = String(variables.message);
    result = result.replace(/\{message\}/g, safeMsg);
  } else {
    // If empty message, try to strip placeholder or gracefully degrade
    result = result.replace(/\{message\}/g, '');
  }

  return result.trim();
}

module.exports = {
  renderTemplate
};
