'use strict';
// Isolated profile for verifying both development and packaged application.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { once } = require('node:events');
async function run(window, updates, folder) {
  window.webContents.setBackgroundThrottling(false);
  const timeout = setTimeout(() => { console.error('Diagnostics timed out'); require('electron').app.exit(1); }, 480000);
  const errors = [];
  window.webContents.on('console-message', event => { if (event.level === 'error') { errors.push(event.message); fs.writeFileSync(path.resolve(folder, 'renderer-errors.json'), JSON.stringify(errors)); } });
  await once(window.webContents, 'did-finish-load');
  const result = await window.webContents.executeJavaScript(`(() => {
    const snapshot = CraftApp.snapshot();
    return { title: document.title, button: document.getElementById('app-update')?.textContent,
      modes: [...document.querySelectorAll('button.nav[data-mode]')].map(b => b.dataset.mode),
      masteryNodes: Object.keys(MASTERY_DATA.nodes).length, snapshot: Boolean(snapshot),
      nodeExposed: typeof require !== 'undefined', desktopBridge: Boolean(window.DesktopApp), actionsInitiallyCollapsed: !document.getElementById('craft-actions').open, noDefaultProfitGoal: CraftApp.snapshot().config.goalTarget === null };
  })()`);
  assert.equal(result.button, 'Проверить обновления');
  assert.equal(result.masteryNodes, 344);
  assert.equal(result.nodeExposed, false);
  assert.equal(result.desktopBridge, true);
  assert.equal(result.actionsInitiallyCollapsed, true);
  assert.equal(result.noDefaultProfitGoal, true);
  assert.equal(result.modes.length, 17, JSON.stringify(errors));
  if (process.argv.includes('--procurement-only')) {
    result.procurement = await require('./compact-procurement-diagnostics.cjs').run(window, folder);
    result.errors = errors;
    assert.deepEqual(errors.filter(message => !/Failed to load resource.*(net::|status of)/.test(message)), []);
    fs.writeFileSync(path.resolve(folder, 'diagnostics.json'), JSON.stringify(result, null, 2));
    console.log('Compact procurement checks completed');
    clearTimeout(timeout);
    return;
  }
  if (process.argv.includes('--missing-data-only')) {
    result.missingData = await require('./missing-data-diagnostics.cjs').run(window, folder);
    result.errors = errors;
    assert.deepEqual(errors.filter(message => !/Failed to load resource.*(net::|status of)/.test(message)), []);
    fs.writeFileSync(path.resolve(folder, 'diagnostics.json'), JSON.stringify(result, null, 2));
    console.log('Missing data checks completed');
    clearTimeout(timeout);
    return;
  }
  if (process.argv.includes('--quick-navigation-only')) {
    result.quickNavigation = await require('./quick-navigation-diagnostics.cjs').run(window, folder);
    result.errors = errors;
    assert.deepEqual(errors.filter(message => !/Failed to load resource.*(net::|status of)/.test(message)), []);
    fs.writeFileSync(path.resolve(folder, 'diagnostics.json'), JSON.stringify(result, null, 2));
    console.log('Quick navigation checks completed');
    clearTimeout(timeout);
    return;
  }
  if (process.argv.includes('--advanced-only')) {
    result.advanced = await require('./advanced-settings-diagnostics.cjs').run(window, folder);
    result.errors = errors;
    assert.deepEqual(errors.filter(message => !/Failed to load resource.*(net::|status of)/.test(message)), []);
    fs.writeFileSync(path.resolve(folder, 'diagnostics.json'), JSON.stringify(result, null, 2));
    console.log('Additional settings checks completed');
    clearTimeout(timeout);
    return;
  }
  if (process.argv.includes('--catalog-only')) {
    result.onDemandCatalog = await require('./on-demand-catalog-diagnostics.cjs').run(window, folder);
    result.catalogSearch = await require('./catalog-search-diagnostics.cjs').run(window, folder);
    result.errors = errors;
    assert.deepEqual(errors.filter(message => !/Failed to load resource.*(net::|status of)/.test(message)), []);
    fs.writeFileSync(path.resolve(folder, 'diagnostics.json'), JSON.stringify(result, null, 2));
    console.log('Catalog checks completed');
    clearTimeout(timeout);
    return;
  }
  if (process.argv.includes('--interface-only')) {
    result.interface = await require('./interface-regressions.cjs').run(window, folder);
    result.compact = await require('./compact-result-diagnostics.cjs').run(window, folder);
    result.errors = errors;
    assert.deepEqual(errors.filter(message => !/Failed to load resource.*(net::|status of)/.test(message)), []);
    fs.writeFileSync(path.resolve(folder, 'diagnostics.json'), JSON.stringify(result, null, 2));
    console.log('Interface regressions completed');
    clearTimeout(timeout);
    return;
  }
  if (process.argv.includes('--ingredients-only')) {
    result.ingredients = await require('./ingredient-tree-diagnostics.cjs').run(window, folder);
    result.errors = errors;
    assert.deepEqual(errors.filter(message => !/Failed to load resource.*(net::|status of)/.test(message)), []);
    fs.writeFileSync(path.resolve(folder, 'diagnostics.json'), JSON.stringify(result, null, 2));
    console.log('Ingredient suite completed');
    clearTimeout(timeout);
    return;
  }
  result.layout = [];
  for (const width of process.argv.includes('--fast-diagnostics') ? [1440] : [1440, 800, 1920]) {
    for (const zoom of process.argv.includes('--fast-diagnostics') ? [1] : [1, 1.25, 1.5]) {
    window.webContents.setZoomFactor(zoom);
    window.setSize(width, 960);
    for (const mode of result.modes) {
      await window.webContents.executeJavaScript(`document.querySelector('button.nav[data-mode="${mode}"]').click()`);
      await new Promise(resolve => setTimeout(resolve, 100));
      const layout = await window.webContents.executeJavaScript(`(() => {
        const r = document.getElementById('app-update').getBoundingClientRect();
        return { activeMode: document.querySelector("button.nav.active").dataset.mode, width: innerWidth, scrollWidth: document.documentElement.scrollWidth, left: r.left, right: r.right, buttonWidth: r.width, screenVisible: !document.getElementById(['food','potions','gear','refine'].includes(document.querySelector('button.nav.active').dataset.mode)?'craft-content':document.querySelector('button.nav.active').dataset.mode+'-content').hidden };
      })()`);
      assert.equal(layout.activeMode, mode);
      assert.equal(layout.screenVisible, true, mode);
      assert.ok(layout.buttonWidth > 0 && layout.left >= 0 && layout.right <= layout.width, mode + ': ' + JSON.stringify(layout));
      assert.ok(layout.scrollWidth <= layout.width + 1, mode + ': ' + JSON.stringify(layout));
      result.layout.push({ mode, ...layout });
    }
  }
  }
  window.webContents.setZoomFactor(1);
  window.setSize(1440, 960);
  console.log("Checking scenarios");
  await window.webContents.executeJavaScript("Workspace.tabAction(Workspace.snapshot().active, 'others')");
  result.scenarios = await require('./scenario-diagnostics.cjs').run(window, folder);
  console.log("Checking profiles");
  await window.webContents.executeJavaScript("Workspace.tabAction(Workspace.snapshot().active, 'others')");
  result.profiles = await require('./profile-diagnostics.cjs').run(window, folder);
  console.log("Checking islands");
  await window.webContents.executeJavaScript("Workspace.tabAction(Workspace.snapshot().active, 'others')");
  result.islands = await require('./island-diagnostics.cjs').run(window, folder);
  console.log("Checking economy");
  await window.webContents.executeJavaScript("Workspace.tabAction(Workspace.snapshot().active, 'others')");
  result.economy = await require('./economy-diagnostics.cjs').run(window, folder);
  console.log("Checking gameUI");
  await window.webContents.executeJavaScript("Workspace.tabAction(Workspace.snapshot().active, 'others')");
  result.gameUI = await require('./game-ui-diagnostics.cjs').run(window, folder);
  console.log("Checking characterPicker");
  await window.webContents.executeJavaScript("Workspace.tabAction(Workspace.snapshot().active, 'others')");
  result.characterPicker = await require('./character-picker-diagnostics.cjs').run(window, folder);
  console.log("Checking searchSale");
  await window.webContents.executeJavaScript("Workspace.tabAction(Workspace.snapshot().active, 'others')");
  result.searchSale = await require('./search-sale-diagnostics.cjs').run(window, folder);
  console.log("Checking blockFolds");
  await window.webContents.executeJavaScript("Workspace.tabAction(Workspace.snapshot().active, 'others')");
  result.blockFolds = await require('./block-folds-diagnostics.cjs').run(window, folder);
  console.log("Checking transmutationFees");
  await window.webContents.executeJavaScript("Workspace.tabAction(Workspace.snapshot().active, 'others')");
  result.transmutationFees = await require('./transmutation-fees-diagnostics.cjs').run(window, folder);
  console.log("Checking qualityFeatures");
  await window.webContents.executeJavaScript("Workspace.tabAction(Workspace.snapshot().active, 'others')");
  result.qualityFeatures = await require('./quality-features-diagnostics.cjs').run(window, folder);
  console.log("Checking themes");
  await window.webContents.executeJavaScript("Workspace.tabAction(Workspace.snapshot().active, 'others')");
  result.themes = await require('./theme-diagnostics.cjs').run(window, folder);
  console.log("Checking workspace");
  result.workspace = await require("./workspace-diagnostics.cjs").run(window, folder);
  result.onDemandCatalog = await require('./on-demand-catalog-diagnostics.cjs').run(window, folder);
  result.catalogSearch = await require('./catalog-search-diagnostics.cjs').run(window, folder);
  result.interface = await require('./interface-regressions.cjs').run(window, folder);
  result.compact = await require('./compact-result-diagnostics.cjs').run(window, folder);
  result.advanced = await require('./advanced-settings-diagnostics.cjs').run(window, folder);
  result.missingData = await require('./missing-data-diagnostics.cjs').run(window, folder);
  result.quickNavigation = await require('./quick-navigation-diagnostics.cjs').run(window, folder);
  result.ingredients = await require('./ingredient-tree-diagnostics.cjs').run(window, folder);
  result.procurement = await require('./compact-procurement-diagnostics.cjs').run(window, folder);
  result.csp = await window.webContents.executeJavaScript("fetch(location.href).then(r => r.headers.get('content-security-policy'))");
  assert.ok(result.csp.includes("script-src 'self'"));
  await window.webContents.executeJavaScript("localStorage.setItem('desktop-diagnostics', 'persisted'); document.querySelector('button.nav[data-mode=character]').click();");
  const character = await window.webContents.executeJavaScript("!document.getElementById('character-content').hidden");
  assert.equal(character, true);
  const loaded = once(window.webContents, 'did-finish-load'); window.webContents.reload(); await loaded;
  assert.equal(await window.webContents.executeJavaScript("localStorage.getItem('desktop-diagnostics')"), 'persisted');
  await window.webContents.executeJavaScript("localStorage.removeItem('desktop-diagnostics'); document.querySelector('button.nav[data-mode=character]').click();");
  if (process.argv.includes('--check-release')) {
    const state = await updates.action();
    assert.ok(['current', 'available'].includes(state.phase), JSON.stringify(state));
    result.releaseCheck = state;
    if (state.phase === 'current') {
      await new Promise(resolve => setTimeout(resolve, 4200));
      result.updateNoticeDismissed = await window.webContents.executeJavaScript("document.getElementById('app-update-status').hidden");
      assert.equal(result.updateNoticeDismissed, true);
    }
  }
  if (process.argv.includes('--download-release')) {
    const { autoUpdater } = require('electron-updater');
    if (updates.snapshot().phase !== 'available') {
      autoUpdater.currentVersion = new (require('semver').SemVer)('0.0.0');
      assert.equal((await updates.action()).phase, 'available');
    }
    result.releaseDownload = await updates.action();
    assert.equal(result.releaseDownload.phase, 'ready');
    assert.equal(autoUpdater.autoInstallOnAppQuit, false);
  }
  // Return to the food page for a consistent screenshot of the update control.
  await window.webContents.executeJavaScript("document.querySelector('button.nav[data-mode=food]').click()");
  await new Promise(resolve => setTimeout(resolve, 1000));
  const screenshot = await window.webContents.capturePage();
  fs.writeFileSync(path.resolve(folder, 'desktop.png'), screenshot.toPNG());
  result.errors = errors;
  assert.deepEqual(errors.filter(message => !/Failed to load resource.*(net::|status of)/.test(message)), []);
  fs.writeFileSync(path.resolve(folder, 'diagnostics.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  clearTimeout(timeout);
}
module.exports = { run };
