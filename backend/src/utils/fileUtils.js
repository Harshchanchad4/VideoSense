const fs = require('fs');
const path = require('path');

// Move file - handles cross-device moves by falling back to copy+delete
const moveFile = async (src, dest) => {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    fs.rename(src, dest, (err) => {
      if (err && err.code === 'EXDEV') {
        // Cross-device: copy then delete
        const readStream = fs.createReadStream(src);
        const writeStream = fs.createWriteStream(dest);
        readStream.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('finish', () => {
          fs.unlink(src, (unlinkErr) => {
            if (unlinkErr) console.error('Failed to delete source after copy:', unlinkErr);
            resolve();
          });
        });
        readStream.pipe(writeStream);
      } else if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

const deleteFile = async (filePath) => {
  return new Promise((resolve, reject) => {
    if (!filePath || !fs.existsSync(filePath)) {
      return resolve();
    }
    fs.unlink(filePath, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

module.exports = { moveFile, deleteFile };
