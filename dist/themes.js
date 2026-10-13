(function(root){'use strict';
const entries=[['albion','Albion'],['black','Тёмная'],['light','Светлая'],['harbor','Ночной порт'],['forest','Лес Тетфорда'],['caerleon','Карлион'],['frost','Форт-Стерлинг']];
function normalize(value){if(value==='graphite')return 'black';return entries.some(([id])=>id===value)?value:'albion';}
root.AppearanceThemes={entries,normalize};
})(typeof window!=='undefined'?window:globalThis);
