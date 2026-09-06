import { profilePatchFromTelegram, resolveTelegramDisplayName, telegramUserId } from './telegram-profile.mjs';

export async function synchronizeTelegramProfile({
  telegramUser={},
  storedUser={},
  updateProfile=async()=>null,
  onLocalProfile=()=>{},
}={}){
  const userId=telegramUserId(telegramUser);
  if(!userId) throw new Error('telegram_user_id_required');
  const storedId=String(storedUser?.telegram_id ?? storedUser?.telegramUserId ?? '').trim();
  if(storedId && storedId!==userId) throw new Error('telegram_user_id_mismatch');

  const displayName=resolveTelegramDisplayName({ telegramUser, storedUser });
  const { patch, changed }=profilePatchFromTelegram({ telegramUser, storedUser });
  const localUser={ ...storedUser, ...patch, display_name:displayName };
  onLocalProfile(localUser);

  if(!changed){
    return { userId, displayName, synchronized:true, syncError:null, user:localUser };
  }

  try{
    const response=await updateProfile({ telegramUserId:userId, patch:{...patch} });
    const serverUser=response?.user && typeof response.user==='object' ? response.user : response;
    const user=serverUser && typeof serverUser==='object' ? { ...localUser, ...serverUser } : localUser;
    return { userId, displayName:user.display_name || displayName, synchronized:true, syncError:null, user };
  }catch(error){
    return { userId, displayName, synchronized:false, syncError:error instanceof Error?error:new Error(String(error)), user:localUser };
  }
}
