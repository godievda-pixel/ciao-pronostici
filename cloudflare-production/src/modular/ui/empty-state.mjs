function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
export function renderEmptyState(copy,{icon='⚽'}={}){return `<div class="ciao-empty-state"><span aria-hidden="true">${esc(icon)}</span><b>${esc(copy)}</b></div>`}
