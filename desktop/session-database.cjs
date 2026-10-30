'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const serverName = value => ({America:'west',Asia:'east',Europe:'europe'})[value] || String(value || '').toLowerCase();
const time = value => { const n = typeof value === 'number' ? value : Date.parse(value); return Number.isFinite(n) ? n : null; };
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const text = value => String(value ?? '').slice(0, 500);
function contributions(record) {
  const d = record.data || {};
  if (record.kind === 'stat') {
    const e = d.entry || {}, metric = text(e.valueType);
    return metric ? [[metric, ['ItemQualityRerollResult','ItemQualityRerollAttempt'].includes(metric) ? number(e.itemQuantity) : number(e.value)]] : [];
  }
  if (record.kind !== 'combat') return [];
  const result = [['party' + text(d.metric), number(d.value)]];
  if (d.sourceLocal && ['Damage','Heal','Overheal'].includes(d.metric)) result.push(['local' + d.metric, number(d.value)]);
  if (d.targetLocal && d.metric === 'TakenDamage') result.push(['localTakenDamage', number(d.value)]);
  if (d.targetLocal && d.metric === 'Heal') result.push(['localHealingReceived', number(d.value)]);
  return result;
}

class SessionDatabase {
  constructor(filename) {
    fs.mkdirSync(path.dirname(filename), {recursive:true});
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, character TEXT NOT NULL, server TEXT NOT NULL, start INTEGER NOT NULL, end INTEGER, data TEXT NOT NULL, updated INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY, sid TEXT NOT NULL, kind TEXT NOT NULL, at INTEGER NOT NULL, data TEXT NOT NULL, updated INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS records_session_time ON records(sid,at);
      CREATE INDEX IF NOT EXISTS records_time ON records(at);
      CREATE TABLE IF NOT EXISTS totals(sid TEXT, metric TEXT, value REAL NOT NULL, PRIMARY KEY(sid,metric));
      CREATE TABLE IF NOT EXISTS buckets(sid TEXT, metric TEXT, minute INTEGER, value REAL NOT NULL, PRIMARY KEY(sid,metric,minute));
      CREATE TABLE IF NOT EXISTS local_combat(id TEXT PRIMARY KEY,sid TEXT NOT NULL,at INTEGER NOT NULL,damage REAL NOT NULL,heal REAL NOT NULL);
      CREATE INDEX IF NOT EXISTS local_combat_time ON local_combat(at,sid);
      CREATE TABLE IF NOT EXISTS state(key TEXT PRIMARY KEY, at INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS cursors(file TEXT PRIMARY KEY, position INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS documents(path TEXT PRIMARY KEY, server TEXT, module TEXT, modified REAL, data TEXT);
      PRAGMA user_version=1;`);
    this.insertRecord = this.db.prepare('INSERT INTO records(id,sid,kind,at,data,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET sid=excluded.sid,kind=excluded.kind,at=excluded.at,data=excluded.data,updated=excluded.updated');
    this.oldRecord = this.db.prepare('SELECT sid,at,data,updated FROM records WHERE id=?');
    this.total = this.db.prepare('INSERT INTO totals(sid,metric,value) VALUES(?,?,?) ON CONFLICT(sid,metric) DO UPDATE SET value=value+excluded.value');
    this.bucket = this.db.prepare('INSERT INTO buckets(sid,metric,minute,value) VALUES(?,?,?,?) ON CONFLICT(sid,metric,minute) DO UPDATE SET value=value+excluded.value');
    this.session = this.db.prepare('INSERT INTO sessions(id,character,server,start,end,data,updated) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET character=excluded.character,server=excluded.server,start=excluded.start,end=excluded.end,data=excluded.data,updated=excluded.updated WHERE excluded.updated>=sessions.updated');
    this.state = this.db.prepare('INSERT INTO state(key,at,data) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET at=excluded.at,data=excluded.data WHERE excluded.at>=state.at');
    this.localCombat=this.db.prepare('INSERT INTO local_combat(id,sid,at,damage,heal) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET sid=excluded.sid,at=excluded.at,damage=excluded.damage,heal=excluded.heal');
    this.removeLocalCombat=this.db.prepare('DELETE FROM local_combat WHERE id=?');
    this.version = 0;
  }
  close() { this.db.close(); }
  apply(record) {
    if (!record || typeof record.id !== 'string' || record.id.length>200 || typeof record.kind !== 'string') throw Error('Некорректное событие SAT');
    const at = time(record.time); if (at === null) throw Error('Некорректное время события SAT');
    const sid = text(record.sessionId), d = record.data || {};
    const updated = time(record.updatedAtUtc) ?? at;
    if (record.kind === 'session') {
      const start = time(d.startedAtUtc), end = d.endedAtUtc == null ? null : time(d.endedAtUtc);
      if (!d.id || start === null || end !== null && end < start) throw Error('Некорректная игровая сессия');
      this.session.run(text(d.id),text(d.characterName),serverName(d.serverLocation),start,end,JSON.stringify(d),updated);
      return;
    }
    if (record.kind === 'context') { this.state.run('context',at,JSON.stringify({...d,sessionId:sid,at})); return; }
    const serialized = JSON.stringify(record), previous = this.oldRecord.get(record.id);
    if (previous?.data === serialized) return;
    if (previous && (d.historical || previous.updated>updated)) return;
    if (previous) for (const [metric,value] of contributions(JSON.parse(previous.data))) {
      this.total.run(previous.sid,metric,-value); this.bucket.run(previous.sid,metric,Math.floor(previous.at/60000),-value);
    }
    this.insertRecord.run(record.id,sid,record.kind,at,serialized,updated);
    if(record.kind==='combat'&&d.sourceLocal===true&&['Damage','Heal'].includes(d.metric))this.localCombat.run(record.id,sid,at,d.metric==='Damage'?number(d.value):0,d.metric==='Heal'?number(d.value):0);
    else if(previous)this.removeLocalCombat.run(record.id);
    for (const [metric,value] of contributions(record)) {
      this.total.run(sid,metric,value); this.bucket.run(sid,metric,Math.floor(at/60000),value);
    }
  }
  ingest(records, cursor) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const record of records) this.apply(record);
      if (cursor) this.db.prepare('INSERT INTO cursors(file,position) VALUES(?,?) ON CONFLICT(file) DO UPDATE SET position=excluded.position').run(cursor.file,cursor.position);
      this.db.exec('COMMIT'); this.version++;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  importJournal(filename, maxBytes=1024*1024) {
    const stat = fs.lstatSync(filename); if (!stat.isFile() || stat.isSymbolicLink()) return 0;
    let position = this.db.prepare('SELECT position FROM cursors WHERE file=?').get(filename)?.position || 0;
    if (position>stat.size) position=0;
    if (position===stat.size) return 0;
    const length=Math.min(maxBytes,stat.size-position), buffer=Buffer.alloc(length), fd=fs.openSync(filename,'r');
    let read; try { read=fs.readSync(fd,buffer,0,length,position); } finally { fs.closeSync(fd); }
    const end=buffer.subarray(0,read).lastIndexOf(10); if (end<0) return 0;
    const records=buffer.subarray(0,end).toString('utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line));
    this.ingest(records,{file:filename,position:position+end+1});
    return end+1;
  }
  context() { const row=this.db.prepare("SELECT data FROM state WHERE key='context'").get(); return row?JSON.parse(row.data):null; }
  where(filter={}, alias='s') {
    const clauses=[], values=[];
    for (const [key,column] of [['sessionId','id'],['server','server'],['character','character']]) if (filter[key] && filter[key]!=='all') {clauses.push(`${alias}.${column}=?`);values.push(text(filter[key]));}
    return {sql:clauses.length?' WHERE '+clauses.join(' AND '):'',values};
  }
  summary(filter={}, now=Date.now()) {
    const w=this.where(filter), context=this.context();
    const listWhere=this.where({...filter,sessionId:null});
    const sessions=this.db.prepare(`SELECT s.* FROM sessions s${listWhere.sql} ORDER BY start DESC LIMIT 100`).all(...listWhere.values);
    const metrics=Object.fromEntries(this.db.prepare(`SELECT t.metric,SUM(t.value) AS value FROM totals t JOIN sessions s ON s.id=t.sid${w.sql} GROUP BY t.metric`).all(...w.values).map(r=>[r.metric,r.value]));
    const durations=this.db.prepare(`SELECT SUM(MAX(0,COALESCE(s.end,?)-s.start)) AS duration, COUNT(*) AS count FROM sessions s${w.sql}`).get(now,...w.values);
    const recentWhere=w.sql+(w.sql?' AND ':' WHERE ')+"r.at>=? AND r.at<=?";
    const rates=this.db.prepare(`SELECT SUM(r.damage) AS damage,SUM(r.heal) AS heal FROM local_combat r JOIN sessions s ON s.id=r.sid${recentWhere}`).get(...w.values,now-10000,now);
    const damage10=number(rates.damage),healing10=number(rates.heal);
    const durationSeconds=Math.max(0,number(durations.duration)/1000);
    const rows=this.db.prepare(`SELECT r.data FROM records r JOIN sessions s ON s.id=r.sid${w.sql} ORDER BY r.at DESC LIMIT 100`).all(...w.values).map(r=>JSON.parse(r.data));
    const timeline=this.db.prepare(`SELECT b.minute,SUM(CASE WHEN b.metric='Fame' THEN b.value ELSE 0 END) AS fame,SUM(CASE WHEN b.metric='localDamage' THEN b.value ELSE 0 END) AS damage FROM buckets b JOIN sessions s ON s.id=b.sid${w.sql} GROUP BY b.minute ORDER BY b.minute DESC LIMIT 240`).all(...w.values).reverse();
    const locations=this.db.prepare(`SELECT r.data FROM records r JOIN sessions s ON s.id=r.sid${w.sql+(w.sql?' AND ':' WHERE ')}r.kind='location' ORDER BY r.at DESC LIMIT 50`).all(...w.values).map(r=>JSON.parse(r.data));
    const identities=this.db.prepare('SELECT DISTINCT character,server FROM sessions ORDER BY character,server').all();
    return {version:this.version,context,filter,metrics,durationSeconds,sessionCount:durations.count,
      famePerHour:durationSeconds>=60?number(metrics.Fame)/durationSeconds*3600:null,
      silverPerHour:durationSeconds>=60?number(metrics.Silver)/durationSeconds*3600:null,
      dps10:damage10/10,hps10:healing10/10,sessions:sessions.map(({data,...s})=>s),identities,events:rows,timeline,locations,
      modules:this.db.prepare('SELECT module,server,COUNT(*) AS files,MAX(modified) AS modified FROM documents GROUP BY module,server ORDER BY module').all()};
  }
  document(relative,server,module,modified,data) {
    this.db.prepare('INSERT INTO documents(path,server,module,modified,data) VALUES(?,?,?,?,?) ON CONFLICT(path) DO UPDATE SET server=excluded.server,module=excluded.module,modified=excluded.modified,data=excluded.data').run(relative,server,module,modified,data);
    this.version++;
  }
  documents(module,server) {
    return this.db.prepare('SELECT path,server,module,modified,json_array_length(data) AS entries FROM documents WHERE module=? AND (?=\'\' OR server=?) ORDER BY modified DESC LIMIT 100').all(text(module),text(server),text(server));
  }
  readDocument(relative) { const row=this.db.prepare('SELECT data FROM documents WHERE path=?').get(text(relative)); return row?JSON.parse(row.data):null; }
  pruneRates(now=Date.now()){this.db.prepare('DELETE FROM local_combat WHERE at<?').run(now-300000);}
}
module.exports={SessionDatabase,contributions,serverName};
