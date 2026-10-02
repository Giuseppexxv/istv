import { StremioMetaPreview } from '../types/stremio';
import { filterReleasedItems } from '../utils/releaseFilter';

export interface GenreDefinition {
  id: string;
  name: string;
  cinemetaName: string;
  icon: string; // Icon identifier
  description: string;
  subcategories: SubcategoryDefinition[];
}

export interface SubcategoryDefinition {
  id: string;
  title: string;
  icon?: string;
  description?: string;
  filterFn: (item: StremioMetaPreview, index: number, allItems: StremioMetaPreview[]) => boolean;
}

const parseRating = (rating: any): number => {
  if (typeof rating === 'number') return rating;
  if (!rating) return 0;
  return parseFloat(String(rating)) || 0;
};

const parseYear = (item: StremioMetaPreview): number => {
  const raw = item.releaseInfo || item.year || '0';
  return parseInt(String(raw), 10) || 0;
};

/**
 * Robust matcher for superhero & comic book content across Marvel, DC, and Indie Comics.
 */
export const isSuperheroContent = (item: StremioMetaPreview): boolean => {
  const name = (item.name || '').toLowerCase();
  const desc = (item.description || '').toLowerCase();
  const genres = (item.genres || []).map((g) => g.toLowerCase()).join(' ');
  const combined = `${name} ${desc} ${genres}`;

  const SUPERHERO_REGEX = /(spider-?man|batman|superman|iron\s?man|thor|avenger|deadpool|wolverine|x-?men|captain\s?america|hulk|daredevil|punisher|loki|hawkeye|wandavision|moon\s?knight|aquaman|wonder\s?woman|flash|arrow|green\s?lantern|black\s?panther|doctor\s?strange|guardians\s?of\s?the\s?galaxy|guardiani\s?della\s?galassia|venom|ant-?man|shazam|justice\s?league|suicide\s?squad|peacemaker|fantastic\s?four|fantastici\s?4|ghost\s?rider|blade|hellboy|spawn|the\s?boys|invincible|watchmen|sandman|kick-?ass|doom\s?patrol|titans|gotham|umbrella\s?academy|jessica\s?jones|luke\s?cage|iron\s?fist|defenders|legion|s\.h\.i\.e\.l\.d|penguin|gen\s?v|harley\s?quinn|catwoman|joker|supergirl|batgirl|morbius|kraven|madame\s?web|superhero|superero|superpot|marvel|dc\s?comic|cinecomic|mutant|fumett|dark\s?knight|man\s?of\s?steel|infinity\s?war|endgame|civil\s?war|ragnarok|cavaliere\s?oscuro|lanterna\s?verde)/i;

  return SUPERHERO_REGEX.test(combined);
};

export const MOVIE_GENRE_DEFINITIONS: GenreDefinition[] = [
  {
    id: 'all',
    name: 'Tutti',
    cinemetaName: '',
    icon: 'Film',
    description: 'Tutto il catalogo cinema: novità, grandi successi e capolavori senza tempo',
    subcategories: [
      { id: 'trending', title: '🔥 Di Tendenza', filterFn: (_, i) => i < 20 },
      { id: 'top_rated', title: '🏆 I Più Votati', filterFn: (item) => parseRating(item.imdbRating) >= 7.8 },
      { id: 'recent', title: '🆕 Ultime Uscite', filterFn: (item) => parseYear(item) >= 2023 },
      { id: 'superheroes_all', title: '⚡ Supereroi & Cinecomic', filterFn: isSuperheroContent },
      { id: 'cult', title: '🌟 Grandi Successi di Sempre', filterFn: (item) => parseRating(item.imdbRating) >= 7.5 },
      { id: 'action_packed', title: '💥 Azione & Intrattenimento', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /action|adventure|comedy/i.test(x));
      }},
    ],
  },
  {
    id: 'commedia',
    name: 'Commedia',
    cinemetaName: 'Comedy',
    icon: 'Smile',
    description: 'Dalle commedie brillanti ai cult all\'italiana, satire e risate per tutti i gusti',
    subcategories: [
      { id: 'popular', title: '🌟 Grandi Successi & Più Popolari', filterFn: (_, i) => i < 15 },
      { id: 'recent', title: '🆕 Nuove Uscite da Ridere', filterFn: (item) => parseYear(item) >= 2022 },
      { id: 'top_rated', title: '🏆 Capolavori Comici & Più Votati', filterFn: (item) => parseRating(item.imdbRating) >= 7.4 },
      { id: 'romcom', title: '💘 Commedie Romantiche & Sentimentali', filterFn: (item) => {
        const g = item.genres || [];
        const desc = (item.description || '').toLowerCase();
        return g.some((x) => /romance|romant/i.test(x)) || /love|amore|coppia|innamorat/i.test(desc);
      }},
      { id: 'action_comedy', title: '💥 Commedie d\'Azione, Avventura & Satira', filterFn: (item) => {
        const g = item.genres || [];
        const desc = (item.description || '').toLowerCase();
        return g.some((x) => /action|adventure|avventura|azione/i.test(x)) || /polizi|rapina|agente|missione/i.test(desc);
      }},
      { id: 'family_comedy', title: '👨‍👩‍👧 Per Tutta la Famiglia & Ragazzi', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /family|famiglia|animation|animazione/i.test(x));
      }},
    ],
  },
  {
    id: 'azione',
    name: 'Azione',
    cinemetaName: 'Action',
    icon: 'Flame',
    description: 'Adrenalina pura, inseguimenti mozzafiato, supereroi e battaglie epiche',
    subcategories: [
      { id: 'superheroes_action', title: '⚡ Supereroi & Marvel / DC Comics', filterFn: isSuperheroContent },
      { id: 'blockbuster', title: '🔥 Blockbuster di Grande Successo', filterFn: (_, i) => i < 15 },
      { id: 'recent', title: '🆕 Nuove Uscite d\'Azione', filterFn: (item) => parseYear(item) >= 2022 },
      { id: 'top_rated', title: '🏆 Capolavori & I Più Votati', filterFn: (item) => parseRating(item.imdbRating) >= 7.4 },
      { id: 'scifi_action', title: '🚀 Azione, Fantascienza & Futuro', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /sci-fi|fantascienza|fantasy/i.test(x));
      }},
      { id: 'crime_thriller', title: '🕵️ Crimine, Spionaggio & Thriller', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /crime|crimine|thriller/i.test(x));
      }},
    ],
  },
  {
    id: 'fantascienza',
    name: 'Fantascienza',
    cinemetaName: 'Sci-Fi',
    icon: 'Rocket',
    description: 'Viaggi spaziali, intelligenza artificiale, futuri distopici e universi paralleli',
    subcategories: [
      { id: 'superheroes_scifi', title: '⚡ Supereroi, Multiverso & Poteri', filterFn: isSuperheroContent },
      { id: 'trending', title: '🌌 Viaggi Cosmici & Mondi Futuri', filterFn: (_, i) => i < 15 },
      { id: 'distopia', title: '🤖 IA, Robotica & Distopie', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        return /futuro|distop|robot|intelligenza|cyber|tecnolog|terra/i.test(desc);
      }},
      { id: 'top_rated', title: '🏆 Pietre Miliari della Fantascienza', filterFn: (item) => parseRating(item.imdbRating) >= 7.3 },
      { id: 'recent', title: '🆕 Ultime Uscite Sci-Fi', filterFn: (item) => parseYear(item) >= 2022 },
      { id: 'space', title: '👽 Alieni, Misteri & Spazio Profondo', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        return /spazio|pianeta|alien|astronav|galass/i.test(desc);
      }},
    ],
  },
  {
    id: 'horror',
    name: 'Horror',
    cinemetaName: 'Horror',
    icon: 'Ghost',
    description: 'Brividi, presenze soprannaturali, possessioni, creature e tensione psicologica',
    subcategories: [
      { id: 'popular', title: '🩸 I Più Terrificanti & Popolari', filterFn: (_, i) => i < 15 },
      { id: 'supernatural', title: '👻 Soprannaturale, Presenze & Demoni', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        const g = item.genres || [];
        return /demonio|fantasma|spirito|possessione|malediz|casa/i.test(desc) || g.some((x) => /mystery|mistero/i.test(x));
      }},
      { id: 'psychological', title: '🧠 Horror Psicologico & Thriller Oscuro', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /thriller|drama|dramma/i.test(x));
      }},
      { id: 'slasher', title: '🔪 Slasher, Creature & Sangue', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        return /killer|mostro|mostri|zombie|creatura|sopravvivenza|sangue/i.test(desc);
      }},
      { id: 'recent', title: '🆕 Nuove Uscite da Brivido', filterFn: (item) => parseYear(item) >= 2022 },
      { id: 'top_rated', title: '🏆 Grandi Classici dell\'Horror', filterFn: (item) => parseRating(item.imdbRating) >= 6.8 },
    ],
  },
  {
    id: 'animazione',
    name: 'Animazione',
    cinemetaName: 'Animation',
    icon: 'Sparkles',
    description: 'Grandi classici d\'animazione, anime leggendari, storie magiche e avventure per tutti',
    subcategories: [
      { id: 'family', title: '🏰 Grandi Studios & Per la Famiglia', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /family|famiglia|comedy/i.test(x));
      }},
      { id: 'anime', title: '⛩️ Anime Giapponesi & Cult Internazionali', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        const name = (item.name || '').toLowerCase();
        return /giappone|anime|manga|studio ghibli|miyazaki|dragon|naruto|one piece|jujutsu|demon/i.test(desc + ' ' + name);
      }},
      { id: 'action_anim', title: '🚀 Animazione d\'Azione, Fantasy & Supereroi', filterFn: (item) => {
        const g = item.genres || [];
        return isSuperheroContent(item) || g.some((x) => /action|adventure|fantasy|sci-fi/i.test(x));
      }},
      { id: 'top_rated', title: '🏆 Capolavori Pluripremiati', filterFn: (item) => parseRating(item.imdbRating) >= 7.6 },
      { id: 'recent', title: '🆕 Ultime Uscite d\'Animazione', filterFn: (item) => parseYear(item) >= 2022 },
      { id: 'comedy_anim', title: '🎈 Risate & Commedie Animate', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /comedy|commedia/i.test(x));
      }},
    ],
  },
  {
    id: 'thriller',
    name: 'Thriller',
    cinemetaName: 'Thriller',
    icon: 'ShieldAlert',
    description: 'Suspense costante, colpi di scena imprevedibili, misteri oscuri e giochi psicologici',
    subcategories: [
      { id: 'top_rated', title: '🏆 Cult & Capolavori di Suspense', filterFn: (item) => parseRating(item.imdbRating) >= 7.4 },
      { id: 'psychological', title: '🧠 Thriller Psicologici & Giochi Mentali', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /drama|dramma|mystery|mistero/i.test(x));
      }},
      { id: 'crime_thriller', title: '🚨 Polizieschi, Crimine & Noir', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /crime|crimine/i.test(x));
      }},
      { id: 'investigation', title: '🕵️ Indagini, Segreti & Mistero', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        return /segreto|indagine|omicidio|verità|scomparsa/i.test(desc);
      }},
      { id: 'recent', title: '🆕 Thriller Recenti', filterFn: (item) => parseYear(item) >= 2022 },
      { id: 'tension', title: '⚡ Suspense & Alta Tensione', filterFn: (_, i) => i < 15 },
    ],
  },
  {
    id: 'dramma',
    name: 'Dramma',
    cinemetaName: 'Drama',
    icon: 'Clapperboard',
    description: 'Storie profonde e toccanti, grandi interpretazioni, drammi storici e biografici',
    subcategories: [
      { id: 'top_rated', title: '🏆 Pietre Miliari del Cinema', filterFn: (item) => parseRating(item.imdbRating) >= 7.8 },
      { id: 'biopic_history', title: '🏛️ Storie Vere & Grandi Drammi Storici', filterFn: (item) => {
        const g = item.genres || [];
        const desc = (item.description || '').toLowerCase();
        return g.some((x) => /biography|biografico|history|storia|war|guerra/i.test(x)) || /storia vera|basato su|seconda guerra/i.test(desc);
      }},
      { id: 'romance_drama', title: '💔 Relazioni, Sentimenti & Drammi Intimi', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /romance|romantico/i.test(x));
      }},
      { id: 'crime_drama', title: '⚖️ Intrighi, Società & Potere', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /crime|crimine|mystery/i.test(x));
      }},
      { id: 'recent', title: '🆕 Nuovi Drammi Acclamati', filterFn: (item) => parseYear(item) >= 2022 },
      { id: 'auteur', title: '🎭 Drammi d\'Autore & Emozioni Forti', filterFn: (_, i) => i < 15 },
    ],
  },
  {
    id: 'crime',
    name: 'Crime',
    cinemetaName: 'Crime',
    icon: 'Search',
    description: 'Indagini intricate, bande criminali, rapine spettacolari e processi giudiziari',
    subcategories: [
      { id: 'investigation', title: '🕵️ Detective & Grandi Indagini', filterFn: (item) => {
        const g = item.genres || [];
        const desc = (item.description || '').toLowerCase();
        return g.some((x) => /mystery|mistero/i.test(x)) || /polizi|detective|omicidio|investig/i.test(desc);
      }},
      { id: 'gangster', title: '💼 Mafia, Gangster & Malavita', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        return /mafia|gang|boss|droga|cartello|criminal/i.test(desc);
      }},
      { id: 'top_rated', title: '🏆 I Monumenti del Cinema Crime', filterFn: (item) => parseRating(item.imdbRating) >= 7.6 },
      { id: 'thriller_crime', title: '🩸 Thriller Criminali & Noir', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /thriller|drama/i.test(x));
      }},
      { id: 'recent', title: '🆕 Uscite Crime Recenti', filterFn: (item) => parseYear(item) >= 2022 },
      { id: 'heist', title: '💰 Grandi Rapine & Cospirazioni', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        return /rapina|banca|furto|soldi|colpo|piano/i.test(desc);
      }},
    ],
  },
  {
    id: 'avventura',
    name: 'Avventura',
    cinemetaName: 'Adventure',
    icon: 'Compass',
    description: 'Spedizioni leggendarie, terre inesplorate, cacce al tesoro e scoperte straordinarie',
    subcategories: [
      { id: 'epic', title: '🧭 Grandi Esplorazioni & Terre Lontane', filterFn: (_, i) => i < 15 },
      { id: 'fantasy_adv', title: '⚔️ Fantasy Epico & Regni Magici', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /fantasy|sci-fi/i.test(x));
      }},
      { id: 'family_adv', title: '👨‍👩‍👧 Avventure per Tutta la Famiglia', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /family|famiglia|animation/i.test(x));
      }},
      { id: 'top_rated', title: '🏆 I Più Grandi Viaggi del Cinema', filterFn: (item) => parseRating(item.imdbRating) >= 7.4 },
      { id: 'recent', title: '🆕 Nuove Avventure & Uscite', filterFn: (item) => parseYear(item) >= 2022 },
      { id: 'nature_survival', title: '🌊 Natura Selvaggia & Sopravvivenza', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        return /giungla|isola|mare|natura|sopravvivere|tesoro/i.test(desc);
      }},
    ],
  },
  {
    id: 'romantico',
    name: 'Romantico',
    cinemetaName: 'Romance',
    icon: 'Heart',
    description: 'Grandi storie d\'amore, passioni travolgenti, incontri del destino e commedie romantiche',
    subcategories: [
      { id: 'romcom', title: '💘 Commedie Romantiche Brillanti', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /comedy|commedia/i.test(x));
      }},
      { id: 'passion', title: '✨ Drammi Sentimentali & Passione', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /drama|dramma/i.test(x));
      }},
      { id: 'top_rated', title: '🏆 Grandi Storie d\'Amore Senza Tempo', filterFn: (item) => parseRating(item.imdbRating) >= 7.2 },
      { id: 'recent', title: '🆕 Uscite Romantiche Recenti', filterFn: (item) => parseYear(item) >= 2022 },
      { id: 'destiny', title: '💌 Incontri del Destino & Emozioni', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        return /destino|segreto|passione|coppia|innamorat/i.test(desc);
      }},
      { id: 'young_love', title: '🌅 Amori Giovanili & Prime Emozioni', filterFn: (_, i) => i < 15 },
    ],
  },
  {
    id: 'documentario',
    name: 'Documentario',
    cinemetaName: 'Documentary',
    icon: 'FileText',
    description: 'Natura spettacolare, biografie, misteri storici, scienza e inchieste reali',
    subcategories: [
      { id: 'nature_science', title: '🌍 Natura Spettacolare & Pianeta Terra', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        return /natura|terra|spazio|scienza|anim|ocean|pianeta/i.test(desc);
      }},
      { id: 'true_crime', title: '🩸 Inchieste Reali & True Crime', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        return /omicidio|crimine|caso|processo|indagine|mistero/i.test(desc);
      }},
      { id: 'top_rated', title: '🏆 Documentari Pluripremiati', filterFn: (item) => parseRating(item.imdbRating) >= 7.5 },
      { id: 'science', title: '🚀 Scienza, Spazio & Tecnologia', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        return /scienza|spazio|tecnologia|universo|fisica|futuro/i.test(desc);
      }},
      { id: 'history', title: '🏛️ Grandi Biografie & Storia', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        return /storia|guerra|presidente|artista|musica|vita|biografia/i.test(desc);
      }},
      { id: 'recent', title: '🆕 Nuovi Documentari', filterFn: (item) => parseYear(item) >= 2022 },
    ],
  },
];

export const SERIES_GENRE_DEFINITIONS: GenreDefinition[] = [
  {
    id: 'all',
    name: 'Tutti',
    cinemetaName: '',
    icon: 'Tv',
    description: 'Tutte le stagioni, uscite recenti, serie fenomeno ed esclusive internazionali',
    subcategories: [
      { id: 'trending', title: '🔥 Serie del Momento', filterFn: (_, i) => i < 20 },
      { id: 'top_rated', title: '🏆 Pluripremiate Emmy / IMDb', filterFn: (item) => parseRating(item.imdbRating) >= 8.2 },
      { id: 'recent', title: '🆕 Nuove Stagioni & Uscite', filterFn: (item) => parseYear(item) >= 2023 },
      { id: 'superheroes_all', title: '⚡ Supereroi & Cinecomic TV', filterFn: isSuperheroContent },
      { id: 'drama_series', title: '🎭 Grandi Saghe Drammatiche', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /drama/i.test(x));
      }},
      { id: 'mystery_thrill', title: '🔍 Misteri & Thriller da Binge-Watching', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /mystery|crime|thriller/i.test(x));
      }},
    ],
  },
  {
    id: 'dramma',
    name: 'Dramma',
    cinemetaName: 'Drama',
    icon: 'Clapperboard',
    description: 'Serie ad alta tensione emotiva, intrighi politici, drammi familiari e produzioni di prestigio',
    subcategories: [
      { id: 'prestige', title: '🏆 Capolavori Pluripremiati', filterFn: (item) => parseRating(item.imdbRating) >= 8.3 },
      { id: 'crime_drama', title: '💼 Intrighi, Potere & Crimine', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /crime|crimine|thriller/i.test(x));
      }},
      { id: 'recent', title: '🆕 Nuove Stagioni Drammatiche', filterFn: (item) => parseYear(item) >= 2022 },
      { id: 'family_relations', title: '❤️ Relazioni, Segreti & Famiglia', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        return /famiglia|segreto|passato|amore|relazione|coppia/i.test(desc);
      }},
      { id: 'historical_drama', title: '🏛️ Grandi Saghe Storiche & Biografie', filterFn: (item) => {
        const g = item.genres || [];
        const desc = (item.description || '').toLowerCase();
        return g.some((x) => /history|biography|war/i.test(x)) || /regina|re|storia|epoca|guerra/i.test(desc);
      }},
      { id: 'popular', title: '🌟 I Drammi Più Visti del Momento', filterFn: (_, i) => i < 15 },
    ],
  },
  {
    id: 'commedia',
    name: 'Commedia',
    cinemetaName: 'Comedy',
    icon: 'Smile',
    description: 'Sitcom cult indimenticabili, dramedy intelligenti, commedie satiriche e animazione brillante',
    subcategories: [
      { id: 'sitcom', title: '🌟 Sitcom Cult & Più Amate', filterFn: (_, i) => i < 15 },
      { id: 'top_rated', title: '🏆 Le Serie Più Votate', filterFn: (item) => parseRating(item.imdbRating) >= 7.8 },
      { id: 'dramedy', title: '🎭 Dramedy & Commedie Brillanti', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /drama|dramma/i.test(x));
      }},
      { id: 'recent', title: '🆕 Nuove Uscite da Ridere', filterFn: (item) => parseYear(item) >= 2022 },
      { id: 'workplace', title: '💼 Ufficio, Amici & Vita Quotidiana', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        return /lavoro|ufficio|amici|gruppo|coinquilin|scuola/i.test(desc);
      }},
      { id: 'family_comedy', title: '👨‍👩‍👧 Commedie per Tutta la Famiglia', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /family|animation/i.test(x));
      }},
    ],
  },
  {
    id: 'crime',
    name: 'Crime',
    cinemetaName: 'Crime',
    icon: 'Search',
    description: 'Polizieschi serrati, detective geniali, grandi rapine e misteri da risolvere',
    subcategories: [
      { id: 'investigation', title: '🕵️ Indagini & Detective Geniali', filterFn: (item) => {
        const g = item.genres || [];
        const desc = (item.description || '').toLowerCase();
        return g.some((x) => /mystery|mistero/i.test(x)) || /polizi|detective|omicidio|fbi|indagin/i.test(desc);
      }},
      { id: 'gangster', title: '💼 Narcotraffico, Mafia & Potere', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        return /droga|cartello|mafia|gang|boss|rapina/i.test(desc);
      }},
      { id: 'top_rated', title: '🏆 I Monumenti del Crime TV', filterFn: (item) => parseRating(item.imdbRating) >= 8.2 },
      { id: 'recent', title: '🆕 Serie Crime del Momento', filterFn: (item) => parseYear(item) >= 2022 },
      { id: 'thriller_crime', title: '🩸 Serial Killer & Menti Criminali', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        return /serial killer|psicopatico|mente|profiler|delitto/i.test(desc);
      }},
      { id: 'popular', title: '🔥 Grandi Successi Crime', filterFn: (_, i) => i < 15 },
    ],
  },
  {
    id: 'scifi_fantasy',
    name: 'Fantascienza & Fantasy',
    cinemetaName: 'Sci-Fi',
    icon: 'Rocket',
    description: 'Regni fantastici, saghe cosmiche, viaggi nel tempo e creature mitologiche',
    subcategories: [
      { id: 'superheroes_scifi', title: '⚡ Supereroi & Fumetti Spettacolari', filterFn: isSuperheroContent },
      { id: 'fantasy_epic', title: '⚔️ Fantasy Epico & Regni Magici', filterFn: (item) => {
        const g = item.genres || [];
        const desc = (item.description || '').toLowerCase();
        return g.some((x) => /fantasy/i.test(x)) || /drago|magia|trono|regno|spada/i.test(desc);
      }},
      { id: 'space_future', title: '🌌 Spazio & Mondi Futuri', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        return /spazio|pianeta|futuro|astronave|alien|galass/i.test(desc);
      }},
      { id: 'top_rated', title: '🏆 I Giganti del Genere', filterFn: (item) => parseRating(item.imdbRating) >= 8.0 },
      { id: 'recent', title: '🆕 Novità & Nuove Stagioni', filterFn: (item) => parseYear(item) >= 2022 },
      { id: 'distopia', title: '🤖 Realtà Parallele & Distopie', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        return /tempo|viaggio|multiverso|parallelo|distopia|tecnologia/i.test(desc);
      }},
    ],
  },
  {
    id: 'action_adventure',
    name: 'Azione & Avventura',
    cinemetaName: 'Action',
    icon: 'Flame',
    description: 'Missioni segrete, supereroi, battaglie spettacolari e corse contro il tempo',
    subcategories: [
      { id: 'superheroes_tv', title: '⚡ Supereroi & Cinecomic (Marvel / DC / The Boys)', filterFn: isSuperheroContent },
      { id: 'thriller_action', title: '🚨 Spionaggio & Missioni Speciali', filterFn: (item) => {
        const g = item.genres || [];
        const desc = (item.description || '').toLowerCase();
        return g.some((x) => /thriller/i.test(x)) || /agente|missione|cia|terroris|militar/i.test(desc);
      }},
      { id: 'top_rated', title: '🏆 Le Migliori Serie d\'Azione', filterFn: (item) => parseRating(item.imdbRating) >= 7.8 },
      { id: 'recent', title: '🆕 Ultime Novità d\'Azione', filterFn: (item) => parseYear(item) >= 2022 },
      { id: 'adventure_survival', title: '🧭 Viaggi Epici & Sopravvivenza', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /adventure|avventura/i.test(x));
      }},
      { id: 'popular', title: '🔥 Serie Adrenaliniche di Tendenza', filterFn: (_, i) => i < 15 },
    ],
  },
  {
    id: 'animazione',
    name: 'Animazione',
    cinemetaName: 'Animation',
    icon: 'Sparkles',
    description: 'Anime di culto, serie animate per adulti, capolavori premiati e avventure per ragazzi',
    subcategories: [
      { id: 'anime', title: '⛩️ Anime Giapponesi di Tendenza', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        const name = (item.name || '').toLowerCase();
        return /anime|manga|giappone|ninja|titan|hero|jujutsu|demon|dragon|naruto|hunter/i.test(desc + ' ' + name);
      }},
      { id: 'adult_anim', title: '⚡ Animazione per Adulti & Satira', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /comedy|commedia|sci-fi/i.test(x));
      }},
      { id: 'superheroes_anim', title: '🦸 Supereroi Animati & Cinecomic', filterFn: isSuperheroContent },
      { id: 'top_rated', title: '🏆 Capolavori d\'Animazione', filterFn: (item) => parseRating(item.imdbRating) >= 8.0 },
      { id: 'recent', title: '🆕 Nuove Stagioni Animate', filterFn: (item) => parseYear(item) >= 2022 },
      { id: 'family_anim', title: '🎈 Animazione per Tutti & Ragazzi', filterFn: (_, i) => i < 15 },
    ],
  },
  {
    id: 'mistero',
    name: 'Mistero',
    cinemetaName: 'Mystery',
    icon: 'ShieldAlert',
    description: 'Enigmi inspiegabili, sparizioni, complotti segreti e suspense psicologica',
    subcategories: [
      { id: 'supernatural_mystery', title: '👁️ Misteri Soprannaturali', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /sci-fi|horror|fantasy/i.test(x));
      }},
      { id: 'detective_mystery', title: '🔍 Sparizioni & Giochi Mentali', filterFn: (item) => {
        const g = item.genres || [];
        return g.some((x) => /crime|drama|thriller/i.test(x));
      }},
      { id: 'top_rated', title: '🏆 Serie di Mistero Più Acclamate', filterFn: (item) => parseRating(item.imdbRating) >= 7.8 },
      { id: 'recent', title: '🆕 Nuovi Misteri da Risolvere', filterFn: (item) => parseYear(item) >= 2022 },
      { id: 'conspiracy', title: '🚨 Complotti & Verità Nascoste', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        return /complotto|segreto|governo|verità|cospirazione/i.test(desc);
      }},
      { id: 'popular', title: '🔥 I Più Grandi Enigmi TV', filterFn: (_, i) => i < 15 },
    ],
  },
  {
    id: 'documentario',
    name: 'Documentario',
    cinemetaName: 'Documentary',
    icon: 'FileText',
    description: 'Docuserie su crimini reali, natura mozzafiato, biografie storiche e inchieste',
    subcategories: [
      { id: 'true_crime_series', title: '🩸 Docuserie True Crime & Inchieste', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        return /crimine|omicidio|killer|caso|processo|setta|mistero/i.test(desc);
      }},
      { id: 'nature_space', title: '🌍 Natura, Pianeta & Scienza', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        return /pianeta|natura|terra|anim|spazio|universo/i.test(desc);
      }},
      { id: 'top_rated', title: '🏆 Docuserie Pluripremiate', filterFn: (item) => parseRating(item.imdbRating) >= 8.0 },
      { id: 'sports_bio', title: '🏅 Sport, Campioni & Biografie', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        return /sport|calcio|campione|atleta|corsa|storia vera/i.test(desc);
      }},
      { id: 'history_doc', title: '🏛️ Storia, Guerre & Misteri del Mondo', filterFn: (item) => {
        const desc = (item.description || '').toLowerCase();
        return /storia|guerra|antico|civiltà|roma|mondo/i.test(desc);
      }},
      { id: 'recent', title: '🆕 Nuove Docuserie Uscite', filterFn: (item) => parseYear(item) >= 2022 },
    ],
  },
];

/**
 * Organizes a flat list of items into rich, curated thematic rows for a selected genre.
 * Guarantees up to 6 subcategories per genre.
 */
export function buildSubcategoryRows(
  genreDef: GenreDefinition,
  allItems: StremioMetaPreview[]
): { id: string; title: string; items: StremioMetaPreview[] }[] {
  const cleanItems = filterReleasedItems(allItems);
  const rows: { id: string; title: string; items: StremioMetaPreview[] }[] = [];

  for (const sub of genreDef.subcategories) {
    if (sub.id === 'all') continue;
    const matching = cleanItems.filter((item, idx) => sub.filterFn(item, idx, cleanItems));
    
    // Ensure every carousel has at least 10 items
    const rowItems = [...matching];
    if (rowItems.length < 12 && cleanItems.length >= 10) {
      const seenIds = new Set(rowItems.map((i) => i.id));
      for (const item of cleanItems) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          rowItems.push(item);
          if (rowItems.length >= 16) break;
        }
      }
    }

    if (rowItems.length >= 5) {
      rows.push({
        id: sub.id,
        title: sub.title,
        items: rowItems,
      });
    }
  }

  // Ensure minimum rows if filtering was too strict
  if (rows.length < 3 && cleanItems.length > 0) {
    if (!rows.some((r) => r.id === 'popular')) {
      rows.unshift({
        id: 'popular',
        title: `🔥 I Più Popolari in ${genreDef.name}`,
        items: cleanItems.slice(0, 20),
      });
    }
    const highRated = cleanItems.filter((it) => parseRating(it.imdbRating) >= 7.0);
    if (!rows.some((r) => r.id === 'top_rated')) {
      rows.push({
        id: 'top_rated',
        title: `🏆 I Più Votati in ${genreDef.name}`,
        items: highRated.length >= 10 ? highRated.slice(0, 20) : cleanItems.slice(5, 25),
      });
    }
    if (!rows.some((r) => r.id === 'recent_picks')) {
      rows.push({
        id: 'recent_picks',
        title: `🆕 Novità e Scelti per Te`,
        items: cleanItems.slice(10, 30),
      });
    }
  }

  return rows;
}
