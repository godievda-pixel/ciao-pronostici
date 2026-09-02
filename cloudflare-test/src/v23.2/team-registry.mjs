function text(value) {
  return String(value ?? '').trim();
}

export function normalizeTeamAlias(value) {
  return text(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\b(fc|cf|calcio|football club|club de futbol|ssc|ss|ac|as|acf|us|uc|afc|rc|sc|fk|sk|nk|ks|vfb|vfl|sv|rb)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const RECORDS = Object.freeze([
  ['Интер', ['Internazionale', 'Inter', 'Inter Milan', 'FC Internazionale Milano']],
  ['Милан', ['AC Milan', 'Milan']],
  ['Наполи', ['SSC Napoli', 'Napoli']],
  ['Рома', ['AS Roma', 'Roma']],
  ['Ювентус', ['Juventus', 'Juventus Turin']],
  ['Фиорентина', ['ACF Fiorentina', 'Fiorentina']],
  ['Аталанта', ['Atalanta', 'Atalanta BC']],
  ['Лацио', ['SS Lazio', 'Lazio']],
  ['Болонья', ['Bologna', 'Bologna FC 1909']],
  ['Торино', ['Torino', 'Torino FC']],
  ['Дженоа', ['Genoa', 'Genoa CFC']],
  ['Комо', ['Como', 'Como 1907']],
  ['Удинезе', ['Udinese', 'Udinese Calcio']],
  ['Кальяри', ['Cagliari', 'Cagliari Calcio']],
  ['Парма', ['Parma', 'Parma Calcio 1913']],
  ['Лечче', ['Lecce', 'US Lecce']],
  ['Верона', ['Hellas Verona', 'Verona']],
  ['Сассуоло', ['Sassuolo', 'US Sassuolo Calcio']],
  ['Пиза', ['Pisa', 'Pisa SC']],
  ['Кремонезе', ['Cremonese', 'US Cremonese']],
  ['Монца', ['Monza', 'AC Monza']],
  ['Венеция', ['Venezia', 'Venezia FC']],
  ['Эмполи', ['Empoli', 'Empoli FC']],
  ['Сампдория', ['Sampdoria', 'UC Sampdoria']],
  ['Палермо', ['Palermo', 'Palermo FC']],
  ['Бари', ['Bari', 'SSC Bari']],
  ['Специя', ['Spezia', 'Spezia Calcio']],
  ['Фрозиноне', ['Frosinone', 'Frosinone Calcio']],
  ['Ареццо', ['Arezzo', 'SS Arezzo']],
  ['Асколи', ['Ascoli', 'Ascoli Calcio']],
  ['Беневенто', ['Benevento', 'Benevento Calcio']],
  ['Каррарезе', ['Carrarese', 'Carrarese Calcio']],
  ['Катания', ['Catania', 'Catania FC']],
  ['Катандзаро', ['Catanzaro', 'US Catanzaro']],
  ['Чезена', ['Cesena', 'Cesena FC']],
  ['Юве Стабия', ['Juve Stabia', 'SS Juve Stabia']],
  ['Виченца', ['L.R. Vicenza', 'LR Vicenza', 'Vicenza']],
  ['Мантова', ['Mantova', 'Mantova 1911']],
  ['Модена', ['Modena', 'Modena FC']],
  ['Падова', ['Padova', 'Calcio Padova']],
  ['Потенца', ['Potenza Calcio', 'Potenza']],
  ['Равенна', ['Ravenna', 'Ravenna FC']],
  ['Зюдтироль', ['Südtirol', 'Sudtirol', 'FC Südtirol', 'FC Sudtirol']],
  ['Брешиа', ['Union Brescia', 'Brescia']],
  ['Авеллино', ['US Avellino 1912', 'Avellino']],
  ['Виртус Энтелла', ['Virtus Entella', 'Entella']],
  ['Реал Мадрид', ['Real Madrid', 'Real Madrid CF']],
  ['Барселона', ['Barcelona', 'FC Barcelona']],
  ['Атлетико Мадрид', ['Atletico Madrid', 'Atlético Madrid', 'Club Atletico de Madrid']],
  ['Атлетик Бильбао', ['Athletic Club', 'Athletic Bilbao']],
  ['Вильярреал', ['Villarreal', 'Villarreal CF']],
  ['Севилья', ['Sevilla', 'Sevilla FC']],
  ['Реал Бетис', ['Real Betis', 'Real Betis Balompie', 'Real Betis Balompié']],
  ['Реал Сосьедад', ['Real Sociedad']],
  ['Сельта', ['Celta Vigo', 'Celta de Vigo']],
  ['Арсенал', ['Arsenal', 'Arsenal FC']],
  ['Манчестер Сити', ['Manchester City', 'Man City']],
  ['Манчестер Юнайтед', ['Manchester United', 'Man United']],
  ['Ливерпуль', ['Liverpool', 'Liverpool FC']],
  ['Челси', ['Chelsea', 'Chelsea FC']],
  ['Тоттенхэм', ['Tottenham Hotspur', 'Tottenham']],
  ['Ньюкасл', ['Newcastle United', 'Newcastle']],
  ['Астон Вилла', ['Aston Villa']],
  ['Борнмут', ['Bournemouth', 'AFC Bournemouth']],
  ['Сандерленд', ['Sunderland', 'Sunderland AFC']],
  ['Бавария', ['Bayern Munich', 'Bayern München', 'FC Bayern München', 'Bayern Munchen']],
  ['Боруссия Дортмунд', ['Borussia Dortmund', 'Dortmund']],
  ['Байер', ['Bayer Leverkusen', 'Bayer 04 Leverkusen']],
  ['РБ Лейпциг', ['RB Leipzig', 'RasenBallsport Leipzig']],
  ['Айнтрахт', ['Eintracht Frankfurt', 'Frankfurt']],
  ['Штутгарт', ['VfB Stuttgart', 'Stuttgart']],
  ['Пари Сен-Жермен', ['Paris Saint-Germain', 'Paris Saint Germain', 'PSG']],
  ['Марсель', ['Olympique Marseille', 'Olympique de Marseille', 'Marseille']],
  ['Монако', ['AS Monaco', 'Monaco']],
  ['Лилль', ['Lille', 'LOSC Lille']],
  ['Лион', ['Olympique Lyonnais', 'Lyon']],
  ['Ланс', ['RC Lens', 'Lens']],
  ['Ренн', ['Stade Rennais', 'Rennes', 'Stade Rennes']],
  ['Бенфика', ['Benfica', 'SL Benfica']],
  ['Спортинг', ['Sporting CP', 'Sporting Lisbon']],
  ['Порту', ['Porto', 'FC Porto']],
  ['ПСВ', ['PSV Eindhoven', 'PSV']],
  ['Аякс', ['Ajax', 'AFC Ajax']],
  ['Фейеноорд', ['Feyenoord', 'Feyenoord Rotterdam']],
  ['АЗ Алкмар', ['AZ Alkmaar', 'AZ']],
  ['НЕК Неймеген', ['NEC Nijmegen', 'NEC']],
  ['Фенербахче', ['Fenerbahçe', 'Fenerbahce', 'Fenerbahçe SK']],
  ['Галатасарай', ['Galatasaray', 'Galatasaray SK']],
  ['Бешикташ', ['Besiktas', 'Beşiktaş', 'Beşiktaş JK']],
  ['Ференцварош', ['Ferencváros TC', 'Ferencvaros TC', 'Ferencváros']],
  ['Селтик', ['Celtic', 'Celtic FC']],
  ['Рейнджерс', ['Rangers', 'Rangers FC']],
  ['Брюгге', ['Club Brugge', 'Club Brugge KV']],
  ['Андерлехт', ['Anderlecht', 'RSC Anderlecht']],
  ['Юнион Сент-Жиллуаз', ['Union Saint-Gilloise', 'Union SG']],
  ['Зальцбург', ['Red Bull Salzburg', 'RB Salzburg', 'FC Salzburg']],
  ['Штурм', ['Sturm Graz', 'SK Sturm Graz']],
  ['Црвена Звезда', ['Red Star Belgrade', 'Crvena zvezda', 'FK Crvena zvezda']],
  ['Партизан', ['Partizan', 'FK Partizan']],
  ['Динамо Загреб', ['Dinamo Zagreb', 'GNK Dinamo Zagreb']],
  ['Славия Прага', ['Slavia Prague', 'Slavia Praha', 'SK Slavia Praha']],
  ['Спарта Прага', ['Sparta Prague', 'Sparta Praha', 'AC Sparta Praha']],
  ['Слован Братислава', ['ŠK Slovan Bratislava', 'SK Slovan Bratislava', 'Slovan Bratislava']],
  ['Олимпиакос', ['Olympiacos', 'Olympiacos Piraeus']],
  ['Панатинаикос', ['Panathinaikos', 'Panathinaikos FC']],
  ['АЕК', ['AEK Athens', 'AEK']],
  ['Шахтёр', ['Shakhtar Donetsk', 'FC Shakhtar Donetsk']],
  ['Динамо Киев', ['Dynamo Kyiv', 'Dynamo Kiev', 'FC Dynamo Kyiv']],
  ['Карабах', ['Qarabag', 'Qarabağ', 'Qarabag FK']],
  ['Сабах', ['Sabah FK', 'Sabah']],
  ['Будё/Глимт', ['Bodo/Glimt', 'Bodø/Glimt', 'FK Bodo/Glimt']],
  ['Викинг', ['Viking FK', 'Viking']],
  ['Копенгаген', ['FC Copenhagen', 'Copenhagen', 'FC København']],
  ['Мидтьюлланд', ['Midtjylland', 'FC Midtjylland']],
  ['Мьельбю', ['Mjällby AIF', 'Mjallby AIF', 'Mjällby']],
  ['Базель', ['Basel', 'FC Basel']],
  ['Янг Бойз', ['Young Boys', 'BSC Young Boys']],
  ['Арарат-Армения', ['FC Ararat-Armenia', 'Ararat-Armenia']],
  ['Кайрат', ['FC Kairat Almaty', 'Kairat Almaty', 'Kairat']],
  ['Борац Баня-Лука', ['FK Borac Banja Luka', 'Borac Banja Luka']],
  ['Хапоэль Беэр-Шева', ["Hapoel Be'er Sheva", 'Hapoel Beer Sheva']],
  ['Хапоэль Тель-Авив', ['Hapoel Tel Aviv']],
  ['Левски', ['Levski Sofia', 'Levski']],
  ['Омония', ['Omonia Nicosia', 'Omonia']],
  ['Пафос', ['Pafos FC', 'Pafos']],
  ['Рига', ['Riga FC', 'Riga']],
]);

const ALIAS_TO_RU = new Map();
for (const [ru, aliases] of RECORDS) {
  ALIAS_TO_RU.set(normalizeTeamAlias(ru), ru);
  for (const alias of aliases) ALIAS_TO_RU.set(normalizeTeamAlias(alias), ru);
}

export function russianTeamName(rawName) {
  const raw = text(rawName);
  if (!raw) return raw;
  return ALIAS_TO_RU.get(normalizeTeamAlias(raw)) || raw;
}

export function isKnownTeamName(rawName) {
  const raw = text(rawName);
  return Boolean(raw && ALIAS_TO_RU.has(normalizeTeamAlias(raw)));
}

export function localizeTeam(team = {}) {
  const rawName = text(team?.rawName || team?.name);
  return Object.freeze({
    ...team,
    rawName,
    name: russianTeamName(rawName),
  });
}

export const TEAM_REGISTRY_RECORDS = RECORDS;
