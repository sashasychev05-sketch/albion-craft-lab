'use strict';
const NAME='Albion Lab',LEGACY_NAME='Albion Craft Lab',APP_ID='com.albioncraftlab.desktop';
function configureIdentity(app){
 // Resolve the profile exactly as previous versions did, then pin it before
 // changing the visible brand. Keep the installer identity for upgrades.
 app.setName(LEGACY_NAME);const profile=app.getPath('userData');app.setPath('userData',profile);app.setName(NAME);app.setAppUserModelId(APP_ID);return profile;
}
module.exports={NAME,LEGACY_NAME,APP_ID,configureIdentity};
