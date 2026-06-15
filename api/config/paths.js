const path = require('path');

module.exports = {
  root: path.resolve(__dirname, '..', '..'),
  // UPLOADS_DIR permet de rediriger les fichiers vers un dossier toujours accessible
  // en ecriture (ex: /tmp/uploads sur Railway). Par defaut: ./uploads (comportement d'origine).
  uploads: process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.resolve(__dirname, '..', '..', 'uploads'),
  clientPath: path.resolve(__dirname, '..', '..', 'client'),
  dist: path.resolve(__dirname, '..', '..', 'client', 'dist'),
  publicPath: path.resolve(__dirname, '..', '..', 'client', 'public'),
  fonts: path.resolve(__dirname, '..', '..', 'client', 'public', 'fonts'),
  assets: path.resolve(__dirname, '..', '..', 'client', 'public', 'assets'),
  imageOutput: path.resolve(__dirname, '..', '..', 'client', 'public', 'images'),
  structuredTools: path.resolve(__dirname, '..', 'app', 'clients', 'tools', 'structured'),
  pluginManifest: path.resolve(__dirname, '..', 'app', 'clients', 'tools', 'manifest.json'),
};
