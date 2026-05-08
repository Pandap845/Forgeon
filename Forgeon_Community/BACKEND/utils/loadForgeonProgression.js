
function shouldReloadProgressionModule() {
  if (process.env.FORGEON_HOT_RELOAD_PROGRESSION === '0') return false;
  return process.env.NODE_ENV === 'production' ? false : true;
}

function loadForgeonProgression() {
  const resolved = require.resolve('./forgeonProgression');
  if (shouldReloadProgressionModule()) {
    delete require.cache[resolved];
  }
  return require('./forgeonProgression');
}

module.exports = loadForgeonProgression;
