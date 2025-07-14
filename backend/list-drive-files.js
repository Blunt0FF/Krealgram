const { google } = require('googleapis');
require('dotenv').config();

async function listDriveFiles() {
  const credentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  });
  const drive = google.drive({ version: 'v3', auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  let pageToken = null;
  const fileMap = {};
  let total = 0;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 1000,
      pageToken
    });
    for (const file of res.data.files) {
      fileMap[file.name] = file.id;
      total++;
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  console.log(`// driveFileMap (fileName → fileId), total: ${total}`);
  console.log('module.exports = ' + JSON.stringify(fileMap, null, 2) + ';');
}

listDriveFiles(); 