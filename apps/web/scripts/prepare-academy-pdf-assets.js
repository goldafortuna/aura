/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..', '..', '..', '..');
const academySourceRoot = path.join(workspaceRoot, 'MateriAcademy');
const configPath = path.join(__dirname, 'academy-master-course.config.json');

function readConfig() {
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function resolveModuleSelection(modules, selectedSlug) {
  if (!selectedSlug) return modules;
  return modules.filter((module) => module.slug === selectedSlug);
}

function copyModulePdfToLessonAssets(moduleConfig, assetBasePath) {
  if (!moduleConfig.sourcePdf) {
    throw new Error(`sourcePdf belum diatur untuk module ${moduleConfig.slug}`);
  }

  const sourcePdfPath = path.join(academySourceRoot, moduleConfig.sourcePdf);
  if (!fs.existsSync(sourcePdfPath)) {
    throw new Error(`PDF sumber tidak ditemukan: ${sourcePdfPath}`);
  }

  const moduleOutputDir = path.join(academySourceRoot, assetBasePath, moduleConfig.slug);
  fs.mkdirSync(moduleOutputDir, { recursive: true });

  for (const lesson of moduleConfig.lessons) {
    const fileName = `${String(lesson.order).padStart(2, '0')}-${lesson.slug}.pdf`;
    const destinationPath = path.join(moduleOutputDir, fileName);
    fs.copyFileSync(sourcePdfPath, destinationPath);
    console.log(`Asset siap: ${path.relative(academySourceRoot, destinationPath)}`);
  }
}

function main() {
  const configData = readConfig();
  const selectedSlug = process.argv.find((arg) => arg.startsWith('--module='))?.split('=')[1] ?? '';
  const modules = resolveModuleSelection(configData.modules, selectedSlug);

  if (modules.length === 0) {
    throw new Error(selectedSlug ? `Module ${selectedSlug} tidak ditemukan di config.` : 'Tidak ada module untuk diproses.');
  }

  for (const moduleConfig of modules) {
    copyModulePdfToLessonAssets(moduleConfig, configData.assetBasePath);
  }
}

try {
  main();
} catch (error) {
  console.error('Gagal menyiapkan asset PDF Academy:', error);
  process.exitCode = 1;
}
