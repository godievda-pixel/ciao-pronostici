export function createEmojiAssetService({telegram,fetchImpl=fetch,botToken}={}){
  if(typeof telegram!=='function')throw new Error('telegram_required');
  if(typeof fetchImpl!=='function')throw new Error('fetch_required');
  const token=String(botToken??'');
  if(!token)throw new Error('bot_token_required');

  async function get(customEmojiId){
    const id=String(customEmojiId??'');
    if(!/^\d+$/.test(id))return new Response('Bad id',{status:400});

    const stickers=await telegram('getCustomEmojiStickers',{custom_emoji_ids:[id]});
    const fileId=stickers?.result?.[0]?.file_id;
    if(!stickers?.ok||!fileId)return new Response('Not found',{status:404});

    const file=await telegram('getFile',{file_id:fileId});
    const path=file?.result?.file_path;
    if(!file?.ok||!path)return new Response('Not found',{status:404});

    const upstream=await fetchImpl(`https://api.telegram.org/file/bot${token}/${path}`);
    if(!upstream?.ok)return new Response('Not found',{status:404});

    return new Response(upstream.body,{status:200,headers:{
      'content-type':upstream.headers.get('content-type')??'image/webp',
      'cache-control':'public, max-age=31536000, immutable',
    }});
  }

  return Object.freeze({get});
}
