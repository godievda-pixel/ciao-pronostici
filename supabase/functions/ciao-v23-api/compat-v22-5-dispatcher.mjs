import { legacyRouteFor } from './compat-v22-5.mjs';

const CORE_METHODS = Object.freeze({
  state:'state',
  serie_a_table:'serieATable',
  save_predictions:'savePredictions',
  toggle_reminders:'toggleReminders',
  set_favorite_team:'setFavoriteTeam',
  standings_scope:'standingsScope',
  public_predictor:'publicPredictor',
  set_notification_preferences:'setNotificationPreferences',
  prediction_rules:'predictionRules',
  client_event:'clientEvent',
});

function httpError(code,status=400){
  const error=new Error(code);
  error.status=status;
  return error;
}

export function createV22CompatDispatcher({core,specialized}={}){
  if(!core)throw new Error('compat_core_required');
  if(!specialized?.dispatch)throw new Error('compat_specialized_required');

  async function dispatch(slug,payload={},context={}){
    const route=legacyRouteFor(slug,payload);
    if(route.kind!=='core'){
      return await specialized.dispatch(route,payload,context);
    }

    const action=route.action;
    if(action==='set_round_bonus')throw httpError('bonus_removed',410);
    const methodName=CORE_METHODS[action];
    if(!methodName || typeof core[methodName]!=='function'){
      throw httpError(`unknown_legacy_action:${action || 'missing'}`,400);
    }
    return await core[methodName]({...payload,...context,action:undefined});
  }

  return Object.freeze({dispatch});
}
