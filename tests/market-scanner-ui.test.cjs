const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('scanned asks and bids feed the existing price resolver with server, quality, TTL and manual precedence',()=>{
 let change,manual=null;const node=()=>({style:{},querySelector(){return node();},append(){},showModal(){},close(){}});const book={get:()=>manual,resolve:()=>({price:9})};
 const window={PriceBook:book,DesktopApp:{marketScanner:{action:async()=>({quotes:[],orders:0}),onChanged:cb=>{change=cb;}}}};
 const document={createElement:node,body:{append(){}},querySelector:()=>node(),dispatchEvent(){}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../dist/market-scanner.js'),'utf8'),{window,document,Date,Event:class{},setInterval(){}});
 change({quotes:[{server:'europe',item:'T4_BAG',city:'Caerleon',quality:1,ask:250,bid:200,askTime:Date.now(),bidTime:Date.now()}],orders:2});
 assert.equal(book.resolve('europe','T4_BAG','Caerleon',1,'buy').price,250);assert.equal(book.resolve('europe','T4_BAG','Caerleon',1,'bid').price,200);assert.equal(book.resolve('east','T4_BAG','Caerleon',1,'buy').price,9);assert.equal(book.resolve('europe','T4_BAG','Caerleon',2,'buy').price,9);
 manual={source:'manual'};assert.equal(book.resolve('europe','T4_BAG','Caerleon',1,'buy').price,9);manual=null;
 change({quotes:[{server:'europe',item:'T4_BAG',city:'Caerleon',quality:1,ask:250,askTime:Date.now()-7200001}],orders:1});assert.equal(book.resolve('europe','T4_BAG','Caerleon',1,'buy').price,9);
});
