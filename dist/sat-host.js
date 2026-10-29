window.StatisticsHost?.onState(state=>{
 document.getElementById('sat-progress').textContent=state.message;
 document.body.classList.toggle('ready',state.ready);
});
