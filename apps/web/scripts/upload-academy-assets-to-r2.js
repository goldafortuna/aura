/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { config } = require('dotenv');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

config({ path: '.env' });
config({ path: '.env.local', override: true });

const workspaceRoot = path.resolve(__dirname, '..', '..', '..', '..');
const academySourceRoot = path.join(workspaceRoot, 'MateriAcademy');
const configPath = path.join(__dirname, 'academy-master-course.config.json');

function readConfig() {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function getModuleSelection() {
  const arg = process.argv.find((value) => value.startsWith('--module='));
  return arg ? arg.split('=')[1] : '';
}

function buildLessonStoragePath(courseSlug, moduleSlug, lessonOrder, lessonSlug) {
  return path.posix.join(
    'academy',
    'lessons',
    courseSlug,
    moduleSlug,
    `${lessonOrder.toString().padStart(2, '0')}-${lessonSlug}.pdf`,
  );
}

function createClient() {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 environment variables are incomplete.');
  }

  return new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function uploadLessonPdf(client, bucket, courseSlug, moduleConfig, assetBasePath, lessonConfig) {
  const fileName = `${lessonConfig.order.toString().padStart(2, '0')}-${lessonConfig.slug}.pdf`;
  const localRelativePath = path.join(assetBasePath, moduleConfig.slug, fileName);
  const localAbsolutePath = path.join(academySourceRoot, localRelativePath);

  if (!fs.existsSync(localAbsolutePath)) {
    throw new Error(`File lesson tidak ditemukan: ${localAbsolutePath}`);
  }

  const storagePath = buildLessonStoragePath(courseSlug, moduleConfig.slug, lessonConfig.order, lessonConfig.slug);
  const body = fs.readFileSync(localAbsolutePath);

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: storagePath,
    Body: body,
    ContentType: 'application/pdf',
  }));

  console.log(`Uploaded: ${storagePath}`);
}

async function main() {
  const configData = readConfig();
  const selectedModuleSlug = getModuleSelection();
  const modules = selectedModuleSlug
    ? configData.modules.filter((module) => module.slug === selectedModuleSlug)
    : configData.modules;

  if (selectedModuleSlug && modules.length === 0) {
    throw new Error(`Module ${selectedModuleSlug} tidak ditemukan di config.`);
  }

  const bucket = process.env.R2_BUCKET || process.env.OBJECT_STORAGE_BUCKET;
  if (!bucket) throw new Error('R2 bucket is not configured.');

  const client = createClient();

  for (const moduleConfig of modules) {
    for (const lessonConfig of moduleConfig.lessons) {
      if (lessonConfig.contentType === 'text' || !lessonConfig.slug) {
        continue;
      }

      await uploadLessonPdf(client, bucket, configData.course.slug, moduleConfig, configData.assetBasePath, lessonConfig);
    }
  }
}

main().catch((error) => {
  console.error('Failed to upload Academy assets to R2:', error);
  process.exitCode = 1;
});
