function text(value){ return String(value ?? '').trim(); }

export function telegramUserId(user={}){
  const raw=text(user?.id);
  if(!/^\d+$/.test(raw) || raw==='0') return '';
  return raw;
}

export function resolveTelegramDisplayName({ telegramUser={}, storedUser={} }={}){
  const fullName=[text(telegramUser?.first_name),text(telegramUser?.last_name)].filter(Boolean).join(' ').trim();
  return fullName
    || text(telegramUser?.username).replace(/^@/,'')
    || text(storedUser?.display_name)
    || 'Игрок Ciao, Web!';
}

export function profilePatchFromTelegram({ telegramUser={}, storedUser={} }={}){
  const userId=telegramUserId(telegramUser);
  if(!userId) return { telegramUserId:'', patch:{}, changed:false };
  const displayName=resolveTelegramDisplayName({ telegramUser, storedUser });
  const username=text(telegramUser?.username).replace(/^@/,'') || null;
  const patch={};
  if((storedUser?.username ?? null)!==username) patch.username=username;
  if(text(storedUser?.display_name)!==displayName) patch.display_name=displayName;
  return { telegramUserId:userId, patch, changed:Object.keys(patch).length>0 };
}
