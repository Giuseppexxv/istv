import { StremioMetaPreview } from '../types/stremio';
import { stremioService } from './stremioService';
import { filterReleasedItems, isJunkOrObscure } from '../utils/releaseFilter';

export interface DiscoverCategoryRow {
  id: string;
  title: string;
  items: StremioMetaPreview[];
}

export type CatalogTargetType = 'all' | 'movie' | 'series';

// In-memory cache per target type
const categoriesCache: Record<CatalogTargetType, { data: DiscoverCategoryRow[]; time: number } | null> = {
  all: null,
  movie: null,
  series: null,
};
const CACHE_TTL = 1000 * 60 * 60 * 3; // 3 hours persistent cache

// Shared raw data cache to eliminate duplicate network calls across tabs
let sharedRawCatalogs: any = null;
let sharedRawBenchmarks: any = null;
let sharedDataTimestamp = 0;
let sharedRawPromise: Promise<any> | null = null;

/**
 * Curated benchmark IDs verified against Cinemeta official metadata.
 * 100% accurate title-to-poster and episode pairings.
 */
const CURATED_BENCHMARKS = {
  // 1. Aggiunti di Recente (2023–2026)
  recent: {
    movies: [
      'tt6263850',  // Deadpool & Wolverine (2024)
      'tt15239678', // Dune: Part Two (2024)
      'tt22022452', // Inside Out 2 (2024)
      'tt9218128',  // Gladiator II (2024)
      'tt18412256', // Alien: Romulus (2024)
      'tt17526714', // The Substance (2024)
      'tt1517268',  // Barbie (2023)
      'tt15398776', // Oppenheimer (2023)
      'tt10366206', // John Wick: Chapter 4 (2023)
      'tt9603212',  // Mission: Impossible - Dead Reckoning (2023)
      'tt1745960',  // Top Gun: Maverick (2022)
      'tt5537002',  // Killers of the Flower Moon (2023)
    ],
    series: [
      'tt2788316',  // Shogun (2024)
      'tt15435876', // The Penguin (2024)
      'tt12637874', // Fallout (2024)
      'tt13649112', // Baby Reindeer (2024)
      'tt13016388', // 3 Body Problem (2024)
      'tt17677860', // Presumed Innocent (2024)
      'tt14452776', // The Bear (2024)
      'tt11280740', // Severance (2024)
      'tt4574334',  // Stranger Things (2022)
      'tt3581920',  // The Last of Us (2023)
      'tt11198330', // House of the Dragon (2024)
      'tt9140554',  // Loki (2023)
    ],
  },

  // 2. I Migliori di Sempre (Top Rated IMDb 8.5+)
  top_rated: {
    movies: [
      'tt0111161', // The Shawshank Redemption (Le ali della libertà)
      'tt0068646', // The Godfather (Il Padrino)
      'tt0071562', // The Godfather: Part II (Il Padrino - Parte II)
      'tt0468569', // The Dark Knight (Il cavaliere oscuro)
      'tt0110912', // Pulp Fiction
      'tt0109830', // Forrest Gump
      'tt0137523', // Fight Club
      'tt0167260', // The Lord of the Rings: The Return of the King
      'tt0133093', // The Matrix
      'tt0102926', // The Silence of the Lambs
      'tt0120689', // The Green Mile
      'tt0114702', // The Usual Suspects
      'tt0108052', // Schindler's List
    ],
    series: [
      'tt0903747', // Breaking Bad
      'tt7366338', // Chernobyl
      'tt0141842', // The Sopranos
      'tt0944947', // Game of Thrones
      'tt3032476', // Better Call Saul
      'tt0185906', // Band of Brothers
      'tt0306414', // The Wire
      'tt2356777', // True Detective
      'tt2802850', // Fargo
      'tt1475582', // Sherlock
      'tt5753856', // Dark
      'tt7660850', // Succession
    ],
  },

  // 3. Cinefili e d’Autore
  auteur: {
    movies: [
      'tt15398776', // Oppenheimer
      'tt6751668',  // Parasite
      'tt5537002',  // Killers of the Flower Moon
      'tt0075314',  // Taxi Driver
      'tt2582802',  // Whiplash
      'tt0477348',  // No Country for Old Men
      'tt0338013',  // Eternal Sunshine of the Spotless Mind
      'tt1375666',  // Inception
      'tt0118715',  // The Big Lebowski
      'tt1856101',  // Blade Runner 2049
    ],
    series: [
      'tt14452776', // The Bear
      'tt11280740', // Severance
      'tt5687612',  // Fleabag
      'tt7660850',  // Succession
      'tt5290382',  // Mindhunter
      'tt4288182',  // Atlanta
      'tt2085059',  // Black Mirror
      'tt5875444',  // Slow Horses
      'tt11016042', // Ripley
      'tt2356777',  // True Detective
      'tt13649112', // Baby Reindeer
    ],
  },

  // 4. Drammatico
  drama: {
    movies: [
      'tt0120689', // The Green Mile (Il miglio verde)
      'tt0086250', // Scarface
      'tt0169547', // American Beauty
      'tt0114702', // The Usual Suspects (I soliti sospetti)
      'tt0110413', // Léon: The Professional
      'tt0109830', // Forrest Gump
      'tt0111161', // The Shawshank Redemption
      'tt0137523', // Fight Club
      'tt0120338', // Titanic
      'tt0407887', // The Departed
      'tt0108052', // Schindler's List
    ],
    series: [
      'tt0306414', // The Wire
      'tt2356777', // True Detective
      'tt2802850', // Fargo
      'tt1839578', // Person of Interest
      'tt0436992', // Doctor Who
      'tt0141842', // The Sopranos
      'tt0903747', // Breaking Bad
      'tt7660850', // Succession
      'tt2788316', // Shogun
      'tt14452776', // The Bear
      'tt3006802', // Outlander
    ],
  },

  // 5. Crime & Poliziesco
  crime: {
    movies: [
      'tt0099685', // GoodFellas (Quei bravi ragazzi)
      'tt0407887', // The Departed
      'tt0114369', // Se7en (Seven)
      'tt0110912', // Pulp Fiction
      'tt0068646', // The Godfather
      'tt0086250', // Scarface
      'tt0114702', // The Usual Suspects
      'tt10366206', // John Wick: Chapter 4
      'tt0113277', // Heat
      'tt0105236', // Reservoir Dogs (Le iene)
      'tt0071562', // The Godfather: Part II
    ],
    series: [
      'tt0903747', // Breaking Bad
      'tt3032476', // Better Call Saul
      'tt0141842', // The Sopranos
      'tt0306414', // The Wire
      'tt2356777', // True Detective
      'tt2802850', // Fargo
      'tt15435876', // The Penguin
      'tt5290382', // Mindhunter
      'tt2707408', // Narcos
      'tt2442560', // Peaky Blinders
      'tt1475582', // Sherlock
    ],
  },

  // 6. Commedia
  comedy: {
    movies: [
      'tt0118715', // The Big Lebowski (Il grande Lebowski)
      'tt1119646', // The Hangover (Una notte da leoni)
      'tt0942385', // Tropic Thunder
      'tt0357413', // Anchorman
      'tt1517268',  // Barbie
      'tt0443453', // Borat
      'tt0829482', // Superbad
      'tt0107048', // Groundhog Day (Ricomincio da capo)
      'tt0332379', // School of Rock
      'tt0120382', // The Truman Show
      'tt22022452', // Inside Out 2
    ],
    series: [
      'tt0386676', // The Office (US) - Exactly tt0386676
      'tt0108778', // Friends
      'tt2467372', // Brooklyn Nine-Nine
      'tt1442437', // Modern Family
      'tt10986410', // Ted Lasso
      'tt0460649', // How I Met Your Mother
      'tt0238784', // Gilmore Girls (Una mamma per amica)
      'tt5687612', // Fleabag
      'tt2861424', // Rick and Morty
      'tt14452776', // The Bear
      'tt0411008', // Lost (in adventure / drama)
    ],
  },

  // 7. Azione
  action: {
    movies: [
      'tt1392190', // Mad Max: Fury Road
      'tt10366206', // John Wick: Chapter 4
      'tt1745960', // Top Gun: Maverick
      'tt0848228', // The Avengers
      'tt0468569', // The Dark Knight
      'tt0133093', // The Matrix
      'tt0110413', // Léon: The Professional
      'tt0095016', // Die Hard (Trappola di cristallo)
      'tt0103064', // Terminator 2: Judgment Day
      'tt0113277', // Heat
      'tt6263850', // Deadpool & Wolverine
    ],
    series: [
      'tt2442560', // Peaky Blinders
      'tt3322312', // Daredevil
      'tt9140554', // Loki
      'tt1190634', // The Boys
      'tt12637874', // Fallout
      'tt2375692', // Black Sails
      'tt6741278', // Invincible
      'tt2788316', // Shogun
      'tt3581920', // The Last of Us
      'tt1839578', // Person of Interest
      'tt5675620', // The Punisher
    ],
  },

  // 8. Documentari
  documentary: {
    movies: [
      'tt5491994', // Planet Earth II
      'tt4044364', // Citizenfour
      'tt1155592', // Man on Wire
      'tt1424432', // Senna
      'tt7775622', // Free Solo
      'tt2375605', // The Act of Killing
      'tt1645089', // Inside Job
      'tt0428803', // March of the Penguins (La marcia dei pinguini)
      'tt1772925', // Jiro Dreams of Sushi
      'tt0497116', // An Inconvenient Truth
    ],
    series: [
      'tt8289930',  // Formula 1: Drive to Survive
      'tt8420184',  // The Last Dance
      'tt5491994',  // Planet Earth II
      'tt14524712', // Beckham
      'tt0795176',  // Planet Earth
      'tt9253866',  // Our Planet
      'tt9735318',  // The Beatles: Get Back
      'tt5189670',  // Making a Murderer
      'tt11823076', // Tiger King
    ],
  },

  // 9. Horror
  horror: {
    movies: [
      'tt1457767', // The Conjuring
      'tt5052448', // Get Out
      'tt0081505', // The Shining
      'tt18412256', // Alien: Romulus
      'tt17526714', // The Substance
      'tt0078748', // Alien (1979)
      'tt0084787', // The Thing (La cosa)
      'tt6644200', // A Quiet Place
      'tt1396484', // It (2017)
    ],
    series: [
      'tt6763664',  // The Haunting of Hill House
      'tt1844624',  // American Horror Story
      'tt1520211',  // The Walking Dead
      'tt13443470', // Wednesday
      'tt4574334',  // Stranger Things
      'tt5753856',  // Dark
      'tt2628232',  // Penny Dreadful
      'tt2188671',  // Bates Motel
      'tt10574558', // Midnight Mass
      'tt15567174', // The Fall of the House of Usher
    ],
  },

  // 10. Thriller & Suspense
  thriller: {
    movies: [
      'tt1130884', // Shutter Island
      'tt2267998', // Gone Girl (L'amore bugiardo)
      'tt0102926', // The Silence of the Lambs
      'tt0209144', // Memento
      'tt0114369', // Se7en
      'tt0482571', // The Prestige
      'tt0137523', // Fight Club
      'tt0468569', // The Dark Knight
      'tt0114702', // The Usual Suspects
      'tt0407887', // The Departed
    ],
    series: [
      'tt5753856',  // Dark
      'tt2085059',  // Black Mirror
      'tt5875444',  // Slow Horses
      'tt11016042', // Ripley
      'tt11280740', // Severance
      'tt5290382',  // Mindhunter
      'tt2356777',  // True Detective
      'tt1475582',  // Sherlock
      'tt1839578',  // Person of Interest
      'tt17677860', // Presumed Innocent
    ],
  },

  // 11. Romantico
  romance: {
    movies: [
      'tt0120338', // Titanic
      'tt0332280', // The Notebook (Le pagine della nostra vita)
      'tt0112471', // Before Sunrise (Prima dell'alba)
      'tt0338013', // Eternal Sunshine of the Spotless Mind
      'tt0109830', // Forrest Gump
      'tt0414387', // Pride & Prejudice (Orgoglio e pregiudizio)
      'tt0117509', // Romeo + Juliet
      'tt0125439', // Notting Hill
      'tt0100405', // Pretty Woman
    ],
    series: [
      'tt8740790',  // Bridgerton
      'tt0238784',  // Gilmore Girls (Una mamma per amica)
      'tt10638036', // Heartstopper
      'tt0460649',  // How I Met Your Mother
      'tt9059760',  // Normal People
      'tt3006802',  // Outlander
      'tt0108778',  // Friends
      'tt1442437',  // Modern Family
      'tt5687612',  // Fleabag
      'tt13649112', // Baby Reindeer
    ],
  },

  // 12. Animazione
  animated: {
    movies: [
      'tt0114709', // Toy Story
      'tt0245429', // Spirited Away (La città incantata)
      'tt4633694', // Spider-Man: Into the Spider-Verse
      'tt0435761', // Toy Story 3
      'tt22022452', // Inside Out 2
      'tt0910970', // WALL-E
      'tt1049413', // Up
      'tt2380307', // Coco
      'tt0266543', // Finding Nemo (Alla ricerca di Nemo)
      'tt0110357', // The Lion King (Il Re Leone 1994)
    ],
    series: [
      'tt11126994', // Arcane
      'tt2861424',  // Rick and Morty
      'tt0417299',  // Avatar: The Last Airbender
      'tt6741278',  // Invincible
      'tt0096697',  // The Simpsons
      'tt0149460',  // Futurama
      'tt0121955',  // South Park
      'tt2560140',  // Attack on Titan (L'attacco dei giganti)
      'tt0388629',  // One Piece
      'tt0877057',  // Death Note
    ],
  },

  // 13. Avventura
  adventure: {
    movies: [
      'tt1630029', // Avatar: The Way of Water
      'tt0120737', // The Lord of the Rings: The Fellowship of the Ring
      'tt0107290', // Jurassic Park
      'tt0325980', // Pirates of the Caribbean: The Curse of the Black Pearl
      'tt0167261', // The Lord of the Rings: The Two Towers
      'tt0167260', // The Lord of the Rings: The Return of the King
      'tt0082971', // Raiders of the Lost Ark (I predatori dell'arca perduta)
      'tt0816692', // Interstellar
      'tt1375666', // Inception
      'tt1745960', // Top Gun: Maverick
    ],
    series: [
      'tt3581920', // The Last of Us
      'tt11198330', // House of the Dragon
      'tt4574334', // Stranger Things
      'tt2375692', // Black Sails
      'tt0944947', // Game of Thrones
      'tt2788316', // Shogun
      'tt12637874', // Fallout
      'tt0436992', // Doctor Who
      'tt5180504', // The Witcher
      'tt0417299', // Avatar: The Last Airbender
      'tt0411008', // Lost
    ],
  },

  // 14. Fantasy
  fantasy: {
    movies: [
      'tt0167260', // The Lord of the Rings: The Return of the King
      'tt0241527', // Harry Potter and the Sorcerer's Stone
      'tt0363771', // The Chronicles of Narnia: The Lion, the Witch and the Wardrobe
      'tt0167261', // The Lord of the Rings: The Two Towers
      'tt0120737', // The Lord of the Rings: The Fellowship of the Ring
      'tt0295297', // Harry Potter and the Chamber of Secrets
      'tt0304141', // Harry Potter and the Prisoner of Azkaban
      'tt0457430', // Pan's Labyrinth (Il labirinto del fauno)
      'tt0245429', // Spirited Away
      'tt1630029', // Avatar: The Way of Water
    ],
    series: [
      'tt5180504',  // The Witcher
      'tt7631058',  // The Lord of the Rings: The Rings of Power
      'tt2403776',  // Shadow and Bone
      'tt7462410',  // The Wheel of Time
      'tt0944947',  // Game of Thrones
      'tt11198330', // House of the Dragon
      'tt13443470', // Wednesday
      'tt4574334',  // Stranger Things
      'tt3006802',  // Outlander
      'tt9140554',  // Loki
    ],
  },

  // 15. Supereroi
  superhero: {
    movies: [
      'tt0848228',  // The Avengers
      'tt4154796',  // Avengers: Endgame
      'tt10872600', // Spider-Man: No Way Home
      'tt0372784',  // Batman Begins
      'tt0468569',  // The Dark Knight
      'tt1877830',  // The Batman (2022)
      'tt4633694',  // Spider-Man: Into the Spider-Verse
      'tt6263850',  // Deadpool & Wolverine
      'tt0133093',  // The Matrix
    ],
    series: [
      'tt9140554',  // Loki
      'tt0279600',  // Smallville
      'tt3322312',  // Daredevil
      'tt1190634',  // The Boys
      'tt6741278',  // Invincible
      'tt15435876', // The Penguin
      'tt13146488', // Peacemaker
      'tt11126994', // Arcane
      'tt5675620',  // The Punisher
    ],
  },

  // 16. Fantascienza
  scifi: {
    movies: [
      'tt0816692',  // Interstellar
      'tt1375666',  // Inception
      'tt0133093',  // The Matrix
      'tt1856101',  // Blade Runner 2049
      'tt15239678', // Dune: Part Two
      'tt0078748',  // Alien
      'tt0103064',  // Terminator 2: Judgment Day
      'tt0062622',  // 2001: A Space Odyssey
      'tt0084787',  // The Thing
      'tt0107290',  // Jurassic Park
    ],
    series: [
      'tt0475784',  // Westworld
      'tt14688458', // Silo
      'tt0804484',  // Foundation
      'tt13016388', // 3 Body Problem
      'tt11280740', // Severance
      'tt12637874', // Fallout
      'tt2085059',  // Black Mirror
      'tt5753856',  // Dark
      'tt4574334',  // Stranger Things
      'tt0436992',  // Doctor Who
    ],
  },

  // 17. Western
  western: {
    movies: [
      'tt0060196', // The Good, the Bad and the Ugly (Il buono, il brutto, il cattivo)
      'tt1853728', // Django Unchained
      'tt0477348', // No Country for Old Men
      'tt0105695', // Unforgiven (Gli spietati)
      'tt0064116', // Once Upon a Time in the West (C'era una volta il West)
      'tt0063032', // The Great Silence (Il grande silenzio)
      'tt0058461', // A Fistful of Dollars (Per un pugno di dollari)
      'tt0059578', // For a Few Dollars More (Per qualche dollaro in più)
      'tt1403865', // True Grit (Il grinta)
      'tt3460252', // The Hateful Eight
    ],
    series: [
      'tt4236770',  // Yellowstone
      'tt13991232', // 1883
      'tt18335752', // 1923
      'tt0348914',  // Deadwood
      'tt1489428',  // Justified
      'tt0475784',  // Westworld
      'tt2375692',  // Black Sails
      'tt2000386',  // Hatfields and McCoys
      'tt5516154',  // Godless
      'tt2802850',  // Fargo
    ],
  },

  // 18. Guerra
  war: {
    movies: [
      'tt0120815', // Saving Private Ryan (Salvate il soldato Ryan)
      'tt0078788', // Apocalypse Now
      'tt0361748', // Inglourious Basterds (Bastardi senza gloria)
      'tt1016150', // All Quiet on the Western Front
      'tt5013056', // Dunkirk
      'tt0093058', // Full Metal Jacket
      'tt0108052', // Schindler's List
      'tt0091763', // Platoon
      'tt0120863', // The Thin Red Line
      'tt0109830', // Forrest Gump
    ],
    series: [
      'tt0185906', // Band of Brothers
      'tt0374463', // The Pacific
      'tt0995832', // Generation Kill
      'tt5056196', // Catch-22
      'tt2640044', // Masters of the Air
      'tt7366338', // Chernobyl
      'tt5830254', // Das Boot
      'tt3577058', // Gallipoli
      'tt8001092', // World on Fire
      'tt2788316', // Shogun
    ],
  },
};

/**
 * Extracts a release timestamp (ms) to sort truly recent items from newest to oldest.
 */
function getReleaseTimestamp(item: StremioMetaPreview): number {
  if (!item) return 0;
  const rawDate = (item as any).released || (item as any).releaseDate;
  if (rawDate) {
    const time = new Date(rawDate).getTime();
    if (!isNaN(time)) return time;
  }
  const rel = String(item.releaseInfo || (item as any).year || '');
  const match = rel.match(/\b(202[4-6])\b/);
  if (match) {
    return new Date(`${match[1]}-01-01`).getTime();
  }
  return 0;
}

/**
 * Checks whether an item was released recently (2023–2026).
 */
export function isRecentRelease(item: StremioMetaPreview): boolean {
  if (!item) return false;
  if (!filterReleasedItems([item]).length) return false;
  const time = getReleaseTimestamp(item);
  const now = Date.now();
  if (time <= 0 || time > now) return false;
  return time >= new Date('2023-01-01').getTime();
}

/**
 * Pristine metadata dictionary pairing exact IMDb IDs to canonical Italian titles, years, ratings and genres.
 */
const BENCHMARK_METADATA: Record<string, { name: string; year: string; rating: number; genres?: string[] }> = {
  // Recent Movies
  'tt6263850': { name: 'Deadpool & Wolverine', year: '2024', rating: 7.7, genres: ['Azione', 'Commedia'] },
  'tt15239678': { name: 'Dune - Parte Due', year: '2024', rating: 8.5, genres: ['Fantascienza', 'Avventura'] },
  'tt22022452': { name: 'Inside Out 2', year: '2024', rating: 7.6, genres: ['Animazione', 'Commedia'] },
  'tt9218128': { name: 'Il Gladiatore II', year: '2024', rating: 6.8, genres: ['Azione', 'Dramma'] },
  'tt18412256': { name: 'Alien: Romulus', year: '2024', rating: 7.2, genres: ['Horror', 'Fantascienza'] },
  'tt17526714': { name: 'The Substance', year: '2024', rating: 7.4, genres: ['Horror', 'Dramma'] },
  'tt1517268': { name: 'Barbie', year: '2023', rating: 6.8, genres: ['Commedia', 'Avventura'] },
  'tt15398776': { name: 'Oppenheimer', year: '2023', rating: 8.9, genres: ['Dramma', 'Storia'] },
  'tt10366206': { name: 'John Wick 4', year: '2023', rating: 7.7, genres: ['Azione', 'Thriller'] },
  'tt9603212': { name: 'Mission: Impossible - Dead Reckoning', year: '2023', rating: 7.7, genres: ['Azione', 'Avventura'] },
  'tt1745960': { name: 'Top Gun: Maverick', year: '2022', rating: 8.3, genres: ['Azione', 'Dramma'] },
  'tt5537002': { name: 'Killers of the Flower Moon', year: '2023', rating: 7.6, genres: ['Crime', 'Dramma'] },

  // Recent Series
  'tt2788316': { name: 'Shōgun', year: '2024', rating: 8.7, genres: ['Dramma', 'Avventura'] },
  'tt15435876': { name: 'The Penguin', year: '2024', rating: 8.8, genres: ['Crime', 'Dramma'] },
  'tt12637874': { name: 'Fallout', year: '2024', rating: 8.4, genres: ['Fantascienza', 'Azione'] },
  'tt13649112': { name: 'Baby Reindeer', year: '2024', rating: 7.8, genres: ['Dramma', 'Commedia'] },
  'tt13016388': { name: 'Il problema dei 3 corpi', year: '2024', rating: 7.5, genres: ['Fantascienza', 'Dramma'] },
  'tt17677860': { name: 'Presunto Innocente', year: '2024', rating: 7.6, genres: ['Crime', 'Mistero'] },
  'tt14452776': { name: 'The Bear', year: '2024', rating: 8.6, genres: ['Dramma', 'Commedia'] },
  'tt11280740': { name: 'Severance - Scissione', year: '2024', rating: 8.7, genres: ['Fantascienza', 'Thriller'] },
  'tt4574334': { name: 'Stranger Things', year: '2022', rating: 8.7, genres: ['Fantascienza', 'Horror'] },
  'tt3581920': { name: 'The Last of Us', year: '2023', rating: 8.8, genres: ['Dramma', 'Avventura'] },
  'tt11198330': { name: 'House of the Dragon', year: '2024', rating: 8.4, genres: ['Azione', 'Avventura'] },
  'tt9140554': { name: 'Loki', year: '2023', rating: 8.2, genres: ['Azione', 'Avventura'] },

  // Top Rated & Classics
  'tt0111161': { name: 'Le ali della libertà', year: '1994', rating: 9.3, genres: ['Dramma'] },
  'tt0068646': { name: 'Il Padrino', year: '1972', rating: 9.2, genres: ['Crime', 'Dramma'] },
  'tt0071562': { name: 'Il Padrino - Parte II', year: '1974', rating: 9.0, genres: ['Crime', 'Dramma'] },
  'tt0468569': { name: 'Il cavaliere oscuro', year: '2008', rating: 9.0, genres: ['Azione', 'Crime'] },
  'tt0110912': { name: 'Pulp Fiction', year: '1994', rating: 8.9, genres: ['Crime', 'Dramma'] },
  'tt0109830': { name: 'Forrest Gump', year: '1994', rating: 8.8, genres: ['Dramma', 'Romantico'] },
  'tt0137523': { name: 'Fight Club', year: '1999', rating: 8.8, genres: ['Dramma'] },
  'tt0167260': { name: 'Il Signore degli Anelli - Il ritorno del re', year: '2003', rating: 9.0, genres: ['Azione', 'Avventura'] },
  'tt0167261': { name: 'Il Signore degli Anelli - Le due torri', year: '2002', rating: 8.8, genres: ['Azione', 'Avventura'] },
  'tt0120737': { name: 'Il Signore degli Anelli - La Compagnia dell\'Anello', year: '2001', rating: 8.9, genres: ['Azione', 'Avventura'] },
  'tt0133093': { name: 'Matrix', year: '1999', rating: 8.7, genres: ['Azione', 'Fantascienza'] },
  'tt0102926': { name: 'Il silenzio degli innocenti', year: '1991', rating: 8.6, genres: ['Crime', 'Thriller'] },
  'tt0120689': { name: 'Il miglio verde', year: '1999', rating: 8.6, genres: ['Dramma', 'Crime'] },
  'tt0114702': { name: 'I soliti sospetti', year: '1995', rating: 8.5, genres: ['Crime', 'Mistero'] },
  'tt0108052': { name: 'Schindler\'s List', year: '1993', rating: 9.0, genres: ['Dramma', 'Storia'] },

  // Series Classics
  'tt0386676': { name: 'The Office (US)', year: '2005', rating: 9.0, genres: ['Commedia'] },
  'tt0411008': { name: 'Lost', year: '2004', rating: 8.3, genres: ['Avventura', 'Dramma'] },
  'tt0108778': { name: 'Friends', year: '1994', rating: 8.9, genres: ['Commedia', 'Romantico'] },
  'tt2467372': { name: 'Brooklyn Nine-Nine', year: '2013', rating: 8.4, genres: ['Commedia', 'Crime'] },
  'tt1442437': { name: 'Modern Family', year: '2009', rating: 8.5, genres: ['Commedia'] },
  'tt10986410': { name: 'Ted Lasso', year: '2020', rating: 8.8, genres: ['Commedia', 'Sport'] },
  'tt0460649': { name: 'E alla fine arriva mamma!', year: '2005', rating: 8.3, genres: ['Commedia', 'Romantico'] },
  'tt0238784': { name: 'Una mamma per amica', year: '2000', rating: 7.8, genres: ['Commedia', 'Dramma'] },
  'tt5687612': { name: 'Fleabag', year: '2016', rating: 8.7, genres: ['Commedia', 'Dramma'] },
  'tt2861424': { name: 'Rick and Morty', year: '2013', rating: 9.1, genres: ['Animazione', 'Commedia'] },
  'tt0903747': { name: 'Breaking Bad', year: '2008', rating: 9.5, genres: ['Crime', 'Dramma'] },
  'tt7366338': { name: 'Chernobyl', year: '2019', rating: 9.4, genres: ['Dramma', 'Storia'] },
  'tt0141842': { name: 'I Soprano', year: '1999', rating: 9.2, genres: ['Crime', 'Dramma'] },
  'tt0944947': { name: 'Il Trono di Spade', year: '2011', rating: 9.2, genres: ['Fantasy', 'Dramma'] },
  'tt3032476': { name: 'Better Call Saul', year: '2015', rating: 9.0, genres: ['Crime', 'Dramma'] },
  'tt0185906': { name: 'Band of Brothers', year: '2001', rating: 9.4, genres: ['Guerra', 'Dramma'] },
  'tt0306414': { name: 'The Wire', year: '2002', rating: 9.3, genres: ['Crime', 'Dramma'] },
  'tt2356777': { name: 'True Detective', year: '2014', rating: 8.9, genres: ['Crime', 'Dramma'] },
  'tt2802850': { name: 'Fargo', year: '2014', rating: 8.9, genres: ['Crime', 'Dramma'] },
  'tt1475582': { name: 'Sherlock', year: '2010', rating: 9.1, genres: ['Crime', 'Mistero'] },
  'tt5753856': { name: 'Dark', year: '2017', rating: 8.7, genres: ['Fantascienza', 'Thriller'] },
  'tt7660850': { name: 'Succession', year: '2018', rating: 8.9, genres: ['Dramma'] },
  'tt3322312': { name: 'Daredevil', year: '2015', rating: 8.6, genres: ['Azione', 'Crime'] },
  'tt5675620': { name: 'The Punisher', year: '2017', rating: 8.5, genres: ['Azione', 'Crime'] },
  'tt0279600': { name: 'Smallville', year: '2001', rating: 7.5, genres: ['Avventura', 'Dramma'] },
  'tt1190634': { name: 'The Boys', year: '2019', rating: 8.7, genres: ['Azione', 'Commedia'] },
  'tt6741278': { name: 'Invincible', year: '2021', rating: 8.7, genres: ['Animazione', 'Azione'] },
  'tt13146488': { name: 'Peacemaker', year: '2022', rating: 8.3, genres: ['Azione', 'Commedia'] },
  'tt11126994': { name: 'Arcane', year: '2021', rating: 9.0, genres: ['Animazione', 'Azione'] },

  // Auteur & Crime & Drama Movies
  'tt6751668': { name: 'Parasite', year: '2019', rating: 8.5, genres: ['Dramma', 'Thriller'] },
  'tt0075314': { name: 'Taxi Driver', year: '1976', rating: 8.2, genres: ['Crime', 'Dramma'] },
  'tt2582802': { name: 'Whiplash', year: '2014', rating: 8.5, genres: ['Dramma', 'Musica'] },
  'tt0477348': { name: 'Non è un paese per vecchi', year: '2007', rating: 8.2, genres: ['Crime', 'Dramma'] },
  'tt0338013': { name: 'Se mi lasci ti cancello', year: '2004', rating: 8.3, genres: ['Dramma', 'Romantico'] },
  'tt1375666': { name: 'Inception', year: '2010', rating: 8.8, genres: ['Azione', 'Avventura'] },
  'tt0086250': { name: 'Scarface', year: '1983', rating: 8.3, genres: ['Crime', 'Dramma'] },
  'tt0169547': { name: 'American Beauty', year: '1999', rating: 8.3, genres: ['Dramma'] },
  'tt0110413': { name: 'Léon', year: '1994', rating: 8.5, genres: ['Azione', 'Dramma'] },
  'tt0120338': { name: 'Titanic', year: '1997', rating: 7.9, genres: ['Dramma', 'Romantico'] },
  'tt0407887': { name: 'The Departed - Il bene e il male', year: '2006', rating: 8.5, genres: ['Crime', 'Dramma'] },
  'tt0099685': { name: 'Quei bravi ragazzi', year: '1990', rating: 8.7, genres: ['Crime', 'Dramma'] },
  'tt0114369': { name: 'Seven (Se7en)', year: '1995', rating: 8.6, genres: ['Crime', 'Mistero'] },
  'tt0113277': { name: 'Heat - La sfida', year: '1995', rating: 8.3, genres: ['Azione', 'Crime'] },
  'tt0105236': { name: 'Le iene (Reservoir Dogs)', year: '1992', rating: 8.3, genres: ['Crime', 'Thriller'] },
  'tt0942385': { name: 'Tropic Thunder', year: '2008', rating: 7.1, genres: ['Commedia', 'Azione'] },
  'tt0443453': { name: 'Borat', year: '2006', rating: 7.4, genres: ['Commedia'] },
  'tt0829482': { name: 'Superbad', year: '2007', rating: 7.6, genres: ['Commedia'] },
  'tt0107048': { name: 'Ricomincio da capo', year: '1993', rating: 8.0, genres: ['Commedia', 'Fantasy'] },
  'tt0332379': { name: 'School of Rock', year: '2003', rating: 7.2, genres: ['Commedia', 'Musica'] },
  'tt0120382': { name: 'The Truman Show', year: '1998', rating: 8.2, genres: ['Commedia', 'Dramma'] },
  'tt1392190': { name: 'Mad Max: Fury Road', year: '2015', rating: 8.1, genres: ['Azione', 'Avventura'] },
  'tt0848228': { name: 'The Avengers', year: '2012', rating: 8.0, genres: ['Azione', 'Fantascienza'] },
  'tt4154796': { name: 'Avengers: Endgame', year: '2019', rating: 8.4, genres: ['Azione', 'Avventura'] },
  'tt10872600': { name: 'Spider-Man: No Way Home', year: '2021', rating: 8.2, genres: ['Azione', 'Avventura'] },
  'tt0372784': { name: 'Batman Begins', year: '2005', rating: 8.2, genres: ['Azione', 'Crime'] },
  'tt1877830': { name: 'The Batman', year: '2022', rating: 7.8, genres: ['Azione', 'Crime'] },
  'tt0095016': { name: 'Trappola di cristallo (Die Hard)', year: '1988', rating: 8.2, genres: ['Azione', 'Thriller'] },
  'tt0103064': { name: 'Terminator 2 - Il giorno del giudizio', year: '1991', rating: 8.6, genres: ['Azione', 'Fantascienza'] },

  // Docs
  'tt5491994': { name: 'Planet Earth II', year: '2016', rating: 9.5, genres: ['Documentario'] },
  'tt4044364': { name: 'Citizenfour', year: '2014', rating: 8.0, genres: ['Documentario'] },
  'tt1155592': { name: 'Man on Wire', year: '2008', rating: 7.7, genres: ['Documentario'] },
  'tt1424432': { name: 'Senna', year: '2010', rating: 8.5, genres: ['Documentario', 'Sport'] },
  'tt7775622': { name: 'Free Solo', year: '2018', rating: 8.1, genres: ['Documentario', 'Sport'] },
  'tt2375605': { name: 'The Act of Killing', year: '2012', rating: 8.2, genres: ['Documentario'] },
  'tt1645089': { name: 'Inside Job', year: '2010', rating: 8.2, genres: ['Documentario'] },
  'tt0428803': { name: 'La marcia dei pinguini', year: '2005', rating: 7.5, genres: ['Documentario'] },
  'tt1772925': { name: 'Jiro e l\'arte del sushi', year: '2011', rating: 7.9, genres: ['Documentario'] },
  'tt0497116': { name: 'Una scomoda verità', year: '2006', rating: 7.4, genres: ['Documentario'] },
  'tt8289930': { name: 'Formula 1: Drive to Survive', year: '2019', rating: 8.5, genres: ['Documentario', 'Sport'] },
  'tt8420184': { name: 'The Last Dance', year: '2020', rating: 9.1, genres: ['Documentario', 'Sport'] },
  'tt14524712': { name: 'Beckham', year: '2023', rating: 8.1, genres: ['Documentario', 'Sport'] },
  'tt0795176': { name: 'Planet Earth', year: '2006', rating: 9.4, genres: ['Documentario'] },
  'tt9253866': { name: 'Il nostro pianeta', year: '2019', rating: 9.3, genres: ['Documentario'] },
  'tt9735318': { name: 'The Beatles: Get Back', year: '2021', rating: 9.0, genres: ['Documentario', 'Musica'] },
  'tt5189670': { name: 'Making a Murderer', year: '2015', rating: 8.6, genres: ['Documentario', 'Crime'] },
  'tt11823076': { name: 'Tiger King', year: '2020', rating: 7.5, genres: ['Documentario', 'Crime'] },

  // Horror & Thriller
  'tt1457767': { name: 'The Conjuring - L\'evocazione', year: '2013', rating: 7.5, genres: ['Horror', 'Mistero'] },
  'tt5052448': { name: 'Scappa - Get Out', year: '2017', rating: 7.8, genres: ['Horror', 'Mistero'] },
  'tt0081505': { name: 'Shining', year: '1980', rating: 8.4, genres: ['Horror', 'Dramma'] },
  'tt0078748': { name: 'Alien', year: '1979', rating: 8.5, genres: ['Horror', 'Fantascienza'] },
  'tt0084787': { name: 'La cosa (The Thing)', year: '1982', rating: 8.2, genres: ['Horror', 'Fantascienza'] },
  'tt6644200': { name: 'A Quiet Place - Un posto tranquillo', year: '2018', rating: 7.5, genres: ['Horror', 'Fantascienza'] },
  'tt1396484': { name: 'It', year: '2017', rating: 7.3, genres: ['Horror'] },
  'tt6763664': { name: 'The Haunting of Hill House', year: '2018', rating: 8.6, genres: ['Horror', 'Dramma'] },
  'tt1844624': { name: 'American Horror Story', year: '2011', rating: 8.0, genres: ['Horror', 'Dramma'] },
  'tt1520211': { name: 'The Walking Dead', year: '2010', rating: 8.1, genres: ['Horror', 'Dramma'] },
  'tt13443470': { name: 'Mercoledì (Wednesday)', year: '2022', rating: 8.1, genres: ['Commedia', 'Fantasy'] },
  'tt2628232': { name: 'Penny Dreadful', year: '2014', rating: 8.2, genres: ['Horror', 'Dramma'] },
  'tt2188671': { name: 'Bates Motel', year: '2013', rating: 8.1, genres: ['Horror', 'Mistero'] },
  'tt10574558': { name: 'Midnight Mass', year: '2021', rating: 7.7, genres: ['Horror', 'Dramma'] },
  'tt15567174': { name: 'La caduta della casa degli Usher', year: '2023', rating: 7.9, genres: ['Horror', 'Dramma'] },
  'tt1130884': { name: 'Shutter Island', year: '2010', rating: 8.2, genres: ['Mistero', 'Thriller'] },
  'tt2267998': { name: 'L\'amore bugiardo - Gone Girl', year: '2014', rating: 8.1, genres: ['Dramma', 'Mistero'] },
  'tt0209144': { name: 'Memento', year: '2000', rating: 8.4, genres: ['Mistero', 'Thriller'] },
  'tt0482571': { name: 'The Prestige', year: '2006', rating: 8.5, genres: ['Dramma', 'Mistero'] },

  // Romance
  'tt0332280': { name: 'Le pagine della nostra vita', year: '2004', rating: 7.8, genres: ['Dramma', 'Romantico'] },
  'tt0112471': { name: 'Prima dell\'alba', year: '1995', rating: 8.1, genres: ['Dramma', 'Romantico'] },
  'tt0414387': { name: 'Orgoglio e pregiudizio', year: '2005', rating: 7.8, genres: ['Dramma', 'Romantico'] },
  'tt0117509': { name: 'Romeo + Giulietta', year: '1996', rating: 6.7, genres: ['Dramma', 'Romantico'] },
  'tt0125439': { name: 'Notting Hill', year: '1999', rating: 7.2, genres: ['Commedia', 'Romantico'] },
  'tt0100405': { name: 'Pretty Woman', year: '1990', rating: 7.1, genres: ['Commedia', 'Romantico'] },
  'tt8740790': { name: 'Bridgerton', year: '2020', rating: 7.4, genres: ['Dramma', 'Romantico'] },
  'tt10638036': { name: 'Heartstopper', year: '2022', rating: 8.6, genres: ['Dramma', 'Romantico'] },
  'tt9059760': { name: 'Normal People', year: '2020', rating: 8.4, genres: ['Dramma', 'Romantico'] },
  'tt3006802': { name: 'Outlander', year: '2014', rating: 8.4, genres: ['Dramma', 'Fantasy'] },

  // Animation
  'tt0114709': { name: 'Toy Story', year: '1995', rating: 8.3, genres: ['Animazione', 'Avventura'] },
  'tt0245429': { name: 'La città incantata', year: '2001', rating: 8.6, genres: ['Animazione', 'Avventura'] },
  'tt4633694': { name: 'Spider-Man: Un nuovo universo', year: '2018', rating: 8.4, genres: ['Animazione', 'Azione'] },
  'tt0435761': { name: 'Toy Story 3', year: '2010', rating: 8.3, genres: ['Animazione', 'Avventura'] },
  'tt0910970': { name: 'WALL-E', year: '2008', rating: 8.4, genres: ['Animazione', 'Avventura'] },
  'tt1049413': { name: 'Up', year: '2009', rating: 8.3, genres: ['Animazione', 'Avventura'] },
  'tt2380307': { name: 'Coco', year: '2017', rating: 8.4, genres: ['Animazione', 'Avventura'] },
  'tt0266543': { name: 'Alla ricerca di Nemo', year: '2003', rating: 8.2, genres: ['Animazione', 'Avventura'] },
  'tt0110357': { name: 'Il Re Leone', year: '1994', rating: 8.5, genres: ['Animazione', 'Avventura'] },
  'tt0417299': { name: 'Avatar - La leggenda di Aang', year: '2005', rating: 9.3, genres: ['Animazione', 'Azione'] },
  'tt0096697': { name: 'I Simpson', year: '1989', rating: 8.7, genres: ['Animazione', 'Commedia'] },
  'tt0149460': { name: 'Futurama', year: '1999', rating: 8.5, genres: ['Animazione', 'Commedia'] },
  'tt0121955': { name: 'South Park', year: '1997', rating: 8.7, genres: ['Animazione', 'Commedia'] },
  'tt2560140': { name: 'L\'attacco dei giganti (Attack on Titan)', year: '2013', rating: 9.1, genres: ['Animazione', 'Azione'] },
  'tt0388629': { name: 'One Piece (Anime)', year: '1999', rating: 9.0, genres: ['Animazione', 'Avventura'] },
  'tt0877057': { name: 'Death Note', year: '2006', rating: 8.9, genres: ['Animazione', 'Crime'] },

  // Adventure & Fantasy & SciFi
  'tt1630029': { name: 'Avatar - La via dell\'acqua', year: '2022', rating: 7.6, genres: ['Azione', 'Avventura'] },
  'tt0107290': { name: 'Jurassic Park', year: '1993', rating: 8.2, genres: ['Azione', 'Avventura'] },
  'tt0325980': { name: 'Pirati dei Caraibi - La maledizione della prima luna', year: '2003', rating: 8.1, genres: ['Azione', 'Avventura'] },
  'tt0082971': { name: 'I predatori dell\'arca perduta', year: '1981', rating: 8.4, genres: ['Azione', 'Avventura'] },
  'tt0241527': { name: 'Harry Potter e la pietra filosofale', year: '2001', rating: 7.6, genres: ['Avventura', 'Famiglia'] },
  'tt0295297': { name: 'Harry Potter e la camera dei segreti', year: '2002', rating: 7.4, genres: ['Avventura', 'Famiglia'] },
  'tt0304141': { name: 'Harry Potter e il prigioniero di Azkaban', year: '2004', rating: 7.9, genres: ['Avventura', 'Famiglia'] },
  'tt0363771': { name: 'Le cronache di Narnia', year: '2005', rating: 6.9, genres: ['Avventura', 'Famiglia'] },
  'tt0457430': { name: 'Il labirinto del fauno', year: '2006', rating: 8.2, genres: ['Dramma', 'Fantasy'] },
  'tt5180504': { name: 'The Witcher', year: '2019', rating: 8.0, genres: ['Azione', 'Avventura'] },
  'tt7631058': { name: 'Gli Anelli del Potere', year: '2022', rating: 7.0, genres: ['Azione', 'Avventura'] },
  'tt2403776': { name: 'Tenebre e ossa', year: '2021', rating: 7.5, genres: ['Azione', 'Dramma'] },
  'tt7462410': { name: 'La Ruota del Tempo', year: '2021', rating: 7.2, genres: ['Azione', 'Avventura'] },
  'tt0816692': { name: 'Interstellar', year: '2014', rating: 8.7, genres: ['Avventura', 'Dramma'] },
  'tt1856101': { name: 'Blade Runner 2049', year: '2017', rating: 8.0, genres: ['Azione', 'Dramma'] },
  'tt0062622': { name: '2001: Odissea nello spazio', year: '1968', rating: 8.3, genres: ['Fantascienza'] },
  'tt0475784': { name: 'Westworld', year: '2016', rating: 8.5, genres: ['Dramma', 'Mistero'] },
  'tt14688458': { name: 'Silo', year: '2023', rating: 8.1, genres: ['Dramma', 'Fantascienza'] },
  'tt0804484': { name: 'Foundation', year: '2021', rating: 7.6, genres: ['Dramma', 'Fantascienza'] },

  // Western & War
  'tt0060196': { name: 'Il buono, il brutto, il cattivo', year: '1966', rating: 8.8, genres: ['Western'] },
  'tt1853728': { name: 'Django Unchained', year: '2012', rating: 8.5, genres: ['Dramma', 'Western'] },
  'tt0105695': { name: 'Gli spietati (Unforgiven)', year: '1992', rating: 8.2, genres: ['Dramma', 'Western'] },
  'tt0064116': { name: 'C\'era una volta il West', year: '1968', rating: 8.5, genres: ['Western'] },
  'tt0063032': { name: 'Il grande silenzio', year: '1968', rating: 7.7, genres: ['Western'] },
  'tt0058461': { name: 'Per un pugno di dollari', year: '1964', rating: 7.9, genres: ['Western'] },
  'tt0059578': { name: 'Per qualche dollaro in più', year: '1965', rating: 8.2, genres: ['Western'] },
  'tt1403865': { name: 'Il grinta (True Grit)', year: '2010', rating: 7.6, genres: ['Dramma', 'Western'] },
  'tt3460252': { name: 'The Hateful Eight', year: '2015', rating: 7.8, genres: ['Crime', 'Western'] },
  'tt4236770': { name: 'Yellowstone', year: '2018', rating: 8.7, genres: ['Dramma', 'Western'] },
  'tt13991232': { name: '1883', year: '2021', rating: 8.7, genres: ['Dramma', 'Western'] },
  'tt18335752': { name: '1923', year: '2022', rating: 8.3, genres: ['Dramma', 'Western'] },
  'tt0348914': { name: 'Deadwood', year: '2004', rating: 8.6, genres: ['Crime', 'Dramma'] },
  'tt1489428': { name: 'Justified', year: '2010', rating: 8.6, genres: ['Crime', 'Dramma'] },
  'tt2000386': { name: 'Hatfields & McCoys', year: '2012', rating: 7.9, genres: ['Dramma', 'Western'] },
  'tt5516154': { name: 'Godless', year: '2017', rating: 8.2, genres: ['Dramma', 'Western'] },
  'tt2375692': { name: 'Black Sails', year: '2014', rating: 8.2, genres: ['Avventura', 'Dramma'] },
  'tt0120815': { name: 'Salvate il soldato Ryan', year: '1998', rating: 8.6, genres: ['Dramma', 'Guerra'] },
  'tt0078788': { name: 'Apocalypse Now', year: '1979', rating: 8.4, genres: ['Dramma', 'Mistero'] },
  'tt0361748': { name: 'Bastardi senza gloria', year: '2009', rating: 8.4, genres: ['Avventura', 'Dramma'] },
  'tt1016150': { name: 'Niente di nuovo sul fronte occidentale', year: '2022', rating: 7.8, genres: ['Azione', 'Dramma'] },
  'tt5013056': { name: 'Dunkirk', year: '2017', rating: 7.8, genres: ['Azione', 'Dramma'] },
  'tt0093058': { name: 'Full Metal Jacket', year: '1987', rating: 8.3, genres: ['Dramma', 'Guerra'] },
  'tt0091763': { name: 'Platoon', year: '1986', rating: 8.1, genres: ['Dramma', 'Guerra'] },
  'tt0120863': { name: 'La sottile linea rossa', year: '1998', rating: 7.6, genres: ['Dramma', 'Guerra'] },
  'tt0374463': { name: 'The Pacific', year: '2010', rating: 8.3, genres: ['Azione', 'Avventura'] },
  'tt0995832': { name: 'Generation Kill', year: '2008', rating: 8.5, genres: ['Dramma', 'Guerra'] },
  'tt5056196': { name: 'Catch-22', year: '2019', rating: 7.7, genres: ['Commedia', 'Dramma'] },
  'tt2640044': { name: 'Masters of the Air', year: '2024', rating: 7.8, genres: ['Azione', 'Dramma'] },
  'tt5830254': { name: 'Das Boot', year: '2018', rating: 7.4, genres: ['Dramma', 'Guerra'] },
  'tt3577058': { name: 'Gallipoli', year: '2015', rating: 7.6, genres: ['Dramma', 'Guerra'] },
  'tt8001092': { name: 'World on Fire', year: '2019', rating: 7.2, genres: ['Dramma', 'Guerra'] },
};

/**
 * Instantaneous, 0ms benchmark resolver using pre-compiled metadata and Metahub HD CDN
 */
function fetchItems(type: 'movie' | 'series', ids: string[]): StremioMetaPreview[] {
  return ids.map((id) => {
    const meta = BENCHMARK_METADATA[id];
    return {
      id,
      type,
      name: meta?.name || id,
      poster: `https://images.metahub.space/poster/medium/${id}/img`,
      releaseInfo: meta?.year || '2024',
      imdbRating: meta?.rating ? meta.rating.toFixed(1) : '8.0',
      genres: meta?.genres || (type === 'movie' ? ['Cinema'] : ['Serie TV']),
    } as StremioMetaPreview;
  });
}

/**
 * Builds row items with guaranteed minimum 10 to 20 items per carousel.
 */
function buildRowItems(
  movies: StremioMetaPreview[],
  series: StremioMetaPreview[],
  curatedMovies: StremioMetaPreview[],
  curatedSeries: StremioMetaPreview[],
  globalSeen: Set<string>,
  targetType: CatalogTargetType,
  maxCount = 20,
  requireRecent = false
): StremioMetaPreview[] {
  const sortedMovies =
    targetType === 'series'
      ? []
      : [...curatedMovies, ...movies].filter((m) => {
          if (!m || !m.id || isJunkOrObscure(m)) return false;
          if (requireRecent && !isRecentRelease(m)) return false;
          return true;
        });

  const sortedSeries =
    targetType === 'movie'
      ? []
      : [...curatedSeries, ...series].filter((s) => {
          if (!s || !s.id || isJunkOrObscure(s)) return false;
          if (requireRecent && !isRecentRelease(s)) return false;
          return true;
        });

  if (requireRecent) {
    sortedMovies.sort((a, b) => getReleaseTimestamp(b) - getReleaseTimestamp(a));
    sortedSeries.sort((a, b) => getReleaseTimestamp(b) - getReleaseTimestamp(a));
  }

  const rowItems: StremioMetaPreview[] = [];
  const localSeen = new Set<string>();

  if (targetType === 'movie') {
    for (const m of sortedMovies) {
      if (!localSeen.has(m.id)) {
        localSeen.add(m.id);
        globalSeen.add(m.id);
        rowItems.push({
          ...m,
          type: 'movie',
          poster: m.poster || `https://images.metahub.space/poster/medium/${m.id}/img`,
        });
        if (rowItems.length >= maxCount) break;
      }
    }
  } else if (targetType === 'series') {
    for (const s of sortedSeries) {
      if (!localSeen.has(s.id)) {
        localSeen.add(s.id);
        globalSeen.add(s.id);
        rowItems.push({
          ...s,
          type: 'series',
          poster: s.poster || `https://images.metahub.space/poster/medium/${s.id}/img`,
        });
        if (rowItems.length >= maxCount) break;
      }
    }
  } else {
    // 50% movies and 50% series alternating
    const maxPairs = Math.max(sortedMovies.length, sortedSeries.length);
    for (let i = 0; i < maxPairs; i++) {
      if (i < sortedMovies.length && !localSeen.has(sortedMovies[i].id)) {
        localSeen.add(sortedMovies[i].id);
        globalSeen.add(sortedMovies[i].id);
        rowItems.push({
          ...sortedMovies[i],
          type: 'movie',
          poster: sortedMovies[i].poster || `https://images.metahub.space/poster/medium/${sortedMovies[i].id}/img`,
        });
        if (rowItems.length >= maxCount) break;
      }
      if (i < sortedSeries.length && !localSeen.has(sortedSeries[i].id)) {
        localSeen.add(sortedSeries[i].id);
        globalSeen.add(sortedSeries[i].id);
        rowItems.push({
          ...sortedSeries[i],
          type: 'series',
          poster: sortedSeries[i].poster || `https://images.metahub.space/poster/medium/${sortedSeries[i].id}/img`,
        });
        if (rowItems.length >= maxCount) break;
      }
    }
  }

  // Guarantee minimum 10 items if row has fewer than 10 by appending remaining curated benchmarks
  if (rowItems.length < 10) {
    const fallbackList = targetType === 'series' ? curatedSeries : targetType === 'movie' ? curatedMovies : [...curatedMovies, ...curatedSeries];
    for (const fb of fallbackList) {
      if (!localSeen.has(fb.id)) {
        localSeen.add(fb.id);
        rowItems.push(fb);
        if (rowItems.length >= 10) break;
      }
    }
  }

  return filterReleasedItems(rowItems, maxCount);
}

/**
 * Returns formatted title appropriate for targetType
 */
function getCategoryTitle(genreKey: string, targetType: CatalogTargetType): string {
  const titles: Record<string, { all: string; movie: string; series: string }> = {
    recent: {
      all: 'Aggiunti di Recente',
      movie: 'Film Aggiunti di Recente',
      series: 'Serie TV Aggiunte di Recente',
    },
    top_rated: {
      all: 'I Migliori di Sempre',
      movie: 'I Migliori di Sempre',
      series: 'I Migliori di Sempre',
    },
    auteur: {
      all: 'Cinefili e d’Autore',
      movie: 'Cinema d’Autore & Cinefili',
      series: 'Serie TV d’Autore & Regia Ricercata',
    },
    drama: {
      all: 'Drammatico',
      movie: 'Film Drammatici',
      series: 'Serie TV Drammatiche',
    },
    crime: {
      all: 'Crime & Poliziesco',
      movie: 'Film Crime & Polizieschi',
      series: 'Crime, Mafia & Polizieschi',
    },
    comedy: {
      all: 'Commedia',
      movie: 'Commedie',
      series: 'Sitcom & Commedie',
    },
    action: {
      all: 'Azione',
      movie: 'Film d\'Azione',
      series: 'Serie TV d\'Azione & Adrenalina',
    },
    documentary: {
      all: 'Documentari',
      movie: 'Documentari',
      series: 'Docuserie & Sport',
    },
    horror: {
      all: 'Horror',
      movie: 'Film Horror',
      series: 'Serie TV Horror & Oscurità',
    },
    thriller: {
      all: 'Thriller & Suspense',
      movie: 'Thriller & Suspense',
      series: 'Thriller & Colpi di Scena',
    },
    romance: {
      all: 'Romantico',
      movie: 'Film Romantici',
      series: 'Serie TV Romantiche & Intrighi',
    },
    animated: {
      all: 'Animazione',
      movie: 'Film d\'Animazione',
      series: 'Serie TV d\'Animazione & Anime',
    },
    adventure: {
      all: 'Avventura',
      movie: 'Film d\'Avventura',
      series: 'Serie TV d\'Avventura & Viaggi',
    },
    fantasy: {
      all: 'Fantasy',
      movie: 'Film Fantasy',
      series: 'Serie TV Fantasy & Magia',
    },
    superhero: {
      all: 'Supereroi',
      movie: 'Film di Supereroi',
      series: 'Serie di Supereroi & Fumetti',
    },
    scifi: {
      all: 'Fantascienza',
      movie: 'Fantascienza',
      series: 'Sci-Fi & Distopie',
    },
    western: {
      all: 'Western',
      movie: 'Film Western',
      series: 'Serie TV Western',
    },
    war: {
      all: 'Guerra',
      movie: 'Film di Guerra',
      series: 'Serie TV di Guerra & Storiche',
    },
  };

  return titles[genreKey]?.[targetType] || genreKey;
}

/**
 * Fetches and caches raw catalog and benchmark data once for all tabs
 */
async function loadSharedRawData() {
  if (sharedRawCatalogs && sharedRawBenchmarks && Date.now() - sharedDataTimestamp < CACHE_TTL) {
    return { catalogs: sharedRawCatalogs, benchmarks: sharedRawBenchmarks };
  }

  if (sharedRawPromise) {
    return sharedRawPromise;
  }

  sharedRawPromise = (async () => {
    try {
      // 1. Fetch core high-priority genre catalogs
      const [
        recentMoviesRaw,
        recentSeriesRaw,
        topMoviesRaw,
        topSeriesRaw,
        dramaMoviesRaw,
        dramaSeriesRaw,
        crimeMoviesRaw,
        crimeSeriesRaw,
        comedyMoviesRaw,
        comedySeriesRaw,
        actionMoviesRaw,
        actionSeriesRaw,
      ] = await Promise.all([
        stremioService.fetchCatalog('official.catalog', 'movie', 'year').catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'series', 'year').catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'movie', 'imdbRating').catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'series', 'imdbRating').catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'movie', 'top', { genre: 'Drama' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'series', 'top', { genre: 'Drama' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'movie', 'top', { genre: 'Crime' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'series', 'top', { genre: 'Crime' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'movie', 'top', { genre: 'Comedy' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'series', 'top', { genre: 'Comedy' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'movie', 'top', { genre: 'Action' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'series', 'top', { genre: 'Action' }).catch(() => []),
      ]);

      // 2. Fetch secondary genres
      const [
        docMoviesRaw,
        docSeriesRaw,
        horrorMoviesRaw,
        horrorSeriesRaw,
        thrillerMoviesRaw,
        thrillerSeriesRaw,
        romanceMoviesRaw,
        romanceSeriesRaw,
        animMoviesRaw,
        animSeriesRaw,
        advMoviesRaw,
        advSeriesRaw,
        fantasyMoviesRaw,
        fantasySeriesRaw,
        scifiMoviesRaw,
        scifiSeriesRaw,
        westernMoviesRaw,
        westernSeriesRaw,
        warMoviesRaw,
        warSeriesRaw,
      ] = await Promise.all([
        stremioService.fetchCatalog('official.catalog', 'movie', 'top', { genre: 'Documentary' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'series', 'top', { genre: 'Documentary' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'movie', 'top', { genre: 'Horror' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'series', 'top', { genre: 'Horror' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'movie', 'top', { genre: 'Thriller' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'series', 'top', { genre: 'Thriller' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'movie', 'top', { genre: 'Romance' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'series', 'top', { genre: 'Romance' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'movie', 'top', { genre: 'Animation' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'series', 'top', { genre: 'Animation' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'movie', 'top', { genre: 'Adventure' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'series', 'top', { genre: 'Adventure' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'movie', 'top', { genre: 'Fantasy' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'series', 'top', { genre: 'Fantasy' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'movie', 'top', { genre: 'Sci-Fi' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'series', 'top', { genre: 'Sci-Fi' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'movie', 'top', { genre: 'Western' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'series', 'top', { genre: 'Western' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'movie', 'top', { genre: 'War' }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', 'series', 'top', { genre: 'War' }).catch(() => []),
      ]);

      // Resolve iconic benchmarks in 0ms
      const curRecentM = fetchItems('movie', CURATED_BENCHMARKS.recent.movies);
      const curRecentS = fetchItems('series', CURATED_BENCHMARKS.recent.series);
      const curTopM = fetchItems('movie', CURATED_BENCHMARKS.top_rated.movies);
      const curTopS = fetchItems('series', CURATED_BENCHMARKS.top_rated.series);
      const curAutM = fetchItems('movie', CURATED_BENCHMARKS.auteur.movies);
      const curAutS = fetchItems('series', CURATED_BENCHMARKS.auteur.series);
      const curDraM = fetchItems('movie', CURATED_BENCHMARKS.drama.movies);
      const curDraS = fetchItems('series', CURATED_BENCHMARKS.drama.series);
      const curCriM = fetchItems('movie', CURATED_BENCHMARKS.crime.movies);
      const curCriS = fetchItems('series', CURATED_BENCHMARKS.crime.series);
      const curComM = fetchItems('movie', CURATED_BENCHMARKS.comedy.movies);
      const curComS = fetchItems('series', CURATED_BENCHMARKS.comedy.series);
      const curActM = fetchItems('movie', CURATED_BENCHMARKS.action.movies);
      const curActS = fetchItems('series', CURATED_BENCHMARKS.action.series);
      const curDocM = fetchItems('movie', CURATED_BENCHMARKS.documentary.movies);
      const curDocS = fetchItems('series', CURATED_BENCHMARKS.documentary.series);
      const curHorM = fetchItems('movie', CURATED_BENCHMARKS.horror.movies);
      const curHorS = fetchItems('series', CURATED_BENCHMARKS.horror.series);
      const curThrM = fetchItems('movie', CURATED_BENCHMARKS.thriller.movies);
      const curThrS = fetchItems('series', CURATED_BENCHMARKS.thriller.series);
      const curRomM = fetchItems('movie', CURATED_BENCHMARKS.romance.movies);
      const curRomS = fetchItems('series', CURATED_BENCHMARKS.romance.series);
      const curAniM = fetchItems('movie', CURATED_BENCHMARKS.animated.movies);
      const curAniS = fetchItems('series', CURATED_BENCHMARKS.animated.series);
      const curAdvM = fetchItems('movie', CURATED_BENCHMARKS.adventure.movies);
      const curAdvS = fetchItems('series', CURATED_BENCHMARKS.adventure.series);
      const curFanM = fetchItems('movie', CURATED_BENCHMARKS.fantasy.movies);
      const curFanS = fetchItems('series', CURATED_BENCHMARKS.fantasy.series);
      const curSupM = fetchItems('movie', CURATED_BENCHMARKS.superhero.movies);
      const curSupS = fetchItems('series', CURATED_BENCHMARKS.superhero.series);
      const curSciM = fetchItems('movie', CURATED_BENCHMARKS.scifi.movies);
      const curSciS = fetchItems('series', CURATED_BENCHMARKS.scifi.series);
      const curWesM = fetchItems('movie', CURATED_BENCHMARKS.western.movies);
      const curWesS = fetchItems('series', CURATED_BENCHMARKS.western.series);
      const curWarM = fetchItems('movie', CURATED_BENCHMARKS.war.movies);
      const curWarS = fetchItems('series', CURATED_BENCHMARKS.war.series);

      sharedRawCatalogs = {
        recent: { movies: recentMoviesRaw, series: recentSeriesRaw },
        top_rated: { movies: topMoviesRaw, series: topSeriesRaw },
        drama: { movies: dramaMoviesRaw, series: dramaSeriesRaw },
        crime: { movies: crimeMoviesRaw, series: crimeSeriesRaw },
        comedy: { movies: comedyMoviesRaw, series: comedySeriesRaw },
        action: { movies: actionMoviesRaw, series: actionSeriesRaw },
        documentary: { movies: docMoviesRaw, series: docSeriesRaw },
        horror: { movies: horrorMoviesRaw, series: horrorSeriesRaw },
        thriller: { movies: thrillerMoviesRaw, series: thrillerSeriesRaw },
        romance: { movies: romanceMoviesRaw, series: romanceSeriesRaw },
        animated: { movies: animMoviesRaw, series: animSeriesRaw },
        adventure: { movies: advMoviesRaw, series: advSeriesRaw },
        fantasy: { movies: fantasyMoviesRaw, series: fantasySeriesRaw },
        scifi: { movies: scifiMoviesRaw, series: scifiSeriesRaw },
        western: { movies: westernMoviesRaw, series: westernSeriesRaw },
        war: { movies: warMoviesRaw, series: warSeriesRaw },
      };

      sharedRawBenchmarks = {
        recent: { movies: curRecentM, series: curRecentS },
        top_rated: { movies: curTopM, series: curTopS },
        auteur: { movies: curAutM, series: curAutS },
        drama: { movies: curDraM, series: curDraS },
        crime: { movies: curCriM, series: curCriS },
        comedy: { movies: curComM, series: curComS },
        action: { movies: curActM, series: curActS },
        documentary: { movies: curDocM, series: curDocS },
        horror: { movies: curHorM, series: curHorS },
        thriller: { movies: curThrM, series: curThrS },
        romance: { movies: curRomM, series: curRomS },
        animated: { movies: curAniM, series: curAniS },
        adventure: { movies: curAdvM, series: curAdvS },
        fantasy: { movies: curFanM, series: curFanS },
        superhero: { movies: curSupM, series: curSupS },
        scifi: { movies: curSciM, series: curSciS },
        western: { movies: curWesM, series: curWesS },
        war: { movies: curWarM, series: curWarS },
      };

      sharedDataTimestamp = Date.now();
      return { catalogs: sharedRawCatalogs, benchmarks: sharedRawBenchmarks };
    } finally {
      sharedRawPromise = null;
    }
  })();

  return sharedRawPromise;
}

/**
 * Builds baseline categories with guaranteed 10+ items per row
 */
function buildBaselineCategories(targetType: CatalogTargetType): DiscoverCategoryRow[] {
  const globalSeen = new Set<string>();

  return [
    {
      id: `category_${targetType}_recent`,
      title: getCategoryTitle('recent', targetType),
      items: buildRowItems([], [], fetchItems('movie', CURATED_BENCHMARKS.recent.movies), fetchItems('series', CURATED_BENCHMARKS.recent.series), globalSeen, targetType, 20, true),
    },
    {
      id: `category_${targetType}_top_rated`,
      title: getCategoryTitle('top_rated', targetType),
      items: buildRowItems([], [], fetchItems('movie', CURATED_BENCHMARKS.top_rated.movies), fetchItems('series', CURATED_BENCHMARKS.top_rated.series), globalSeen, targetType, 20),
    },
    {
      id: `category_${targetType}_auteur`,
      title: getCategoryTitle('auteur', targetType),
      items: buildRowItems([], [], fetchItems('movie', CURATED_BENCHMARKS.auteur.movies), fetchItems('series', CURATED_BENCHMARKS.auteur.series), globalSeen, targetType, 20),
    },
    {
      id: `category_${targetType}_drama`,
      title: getCategoryTitle('drama', targetType),
      items: buildRowItems([], [], fetchItems('movie', CURATED_BENCHMARKS.drama.movies), fetchItems('series', CURATED_BENCHMARKS.drama.series), globalSeen, targetType, 20),
    },
    {
      id: `category_${targetType}_crime`,
      title: getCategoryTitle('crime', targetType),
      items: buildRowItems([], [], fetchItems('movie', CURATED_BENCHMARKS.crime.movies), fetchItems('series', CURATED_BENCHMARKS.crime.series), globalSeen, targetType, 20),
    },
    {
      id: `category_${targetType}_comedy`,
      title: getCategoryTitle('comedy', targetType),
      items: buildRowItems([], [], fetchItems('movie', CURATED_BENCHMARKS.comedy.movies), fetchItems('series', CURATED_BENCHMARKS.comedy.series), globalSeen, targetType, 20),
    },
    {
      id: `category_${targetType}_action`,
      title: getCategoryTitle('action', targetType),
      items: buildRowItems([], [], fetchItems('movie', CURATED_BENCHMARKS.action.movies), fetchItems('series', CURATED_BENCHMARKS.action.series), globalSeen, targetType, 20),
    },
    {
      id: `category_${targetType}_documentary`,
      title: getCategoryTitle('documentary', targetType),
      items: buildRowItems([], [], fetchItems('movie', CURATED_BENCHMARKS.documentary.movies), fetchItems('series', CURATED_BENCHMARKS.documentary.series), globalSeen, targetType, 20),
    },
    {
      id: `category_${targetType}_horror`,
      title: getCategoryTitle('horror', targetType),
      items: buildRowItems([], [], fetchItems('movie', CURATED_BENCHMARKS.horror.movies), fetchItems('series', CURATED_BENCHMARKS.horror.series), globalSeen, targetType, 20),
    },
    {
      id: `category_${targetType}_thriller`,
      title: getCategoryTitle('thriller', targetType),
      items: buildRowItems([], [], fetchItems('movie', CURATED_BENCHMARKS.thriller.movies), fetchItems('series', CURATED_BENCHMARKS.thriller.series), globalSeen, targetType, 20),
    },
    {
      id: `category_${targetType}_romance`,
      title: getCategoryTitle('romance', targetType),
      items: buildRowItems([], [], fetchItems('movie', CURATED_BENCHMARKS.romance.movies), fetchItems('series', CURATED_BENCHMARKS.romance.series), globalSeen, targetType, 20),
    },
    {
      id: `category_${targetType}_animated`,
      title: getCategoryTitle('animated', targetType),
      items: buildRowItems([], [], fetchItems('movie', CURATED_BENCHMARKS.animated.movies), fetchItems('series', CURATED_BENCHMARKS.animated.series), globalSeen, targetType, 20),
    },
    {
      id: `category_${targetType}_adventure`,
      title: getCategoryTitle('adventure', targetType),
      items: buildRowItems([], [], fetchItems('movie', CURATED_BENCHMARKS.adventure.movies), fetchItems('series', CURATED_BENCHMARKS.adventure.series), globalSeen, targetType, 20),
    },
    {
      id: `category_${targetType}_fantasy`,
      title: getCategoryTitle('fantasy', targetType),
      items: buildRowItems([], [], fetchItems('movie', CURATED_BENCHMARKS.fantasy.movies), fetchItems('series', CURATED_BENCHMARKS.fantasy.series), globalSeen, targetType, 20),
    },
    {
      id: `category_${targetType}_superhero`,
      title: getCategoryTitle('superhero', targetType),
      items: buildRowItems([], [], fetchItems('movie', CURATED_BENCHMARKS.superhero.movies), fetchItems('series', CURATED_BENCHMARKS.superhero.series), globalSeen, targetType, 20),
    },
    {
      id: `category_${targetType}_scifi`,
      title: getCategoryTitle('scifi', targetType),
      items: buildRowItems([], [], fetchItems('movie', CURATED_BENCHMARKS.scifi.movies), fetchItems('series', CURATED_BENCHMARKS.scifi.series), globalSeen, targetType, 20),
    },
    {
      id: `category_${targetType}_western`,
      title: getCategoryTitle('western', targetType),
      items: buildRowItems([], [], fetchItems('movie', CURATED_BENCHMARKS.western.movies), fetchItems('series', CURATED_BENCHMARKS.western.series), globalSeen, targetType, 20),
    },
    {
      id: `category_${targetType}_war`,
      title: getCategoryTitle('war', targetType),
      items: buildRowItems([], [], fetchItems('movie', CURATED_BENCHMARKS.war.movies), fetchItems('series', CURATED_BENCHMARKS.war.series), globalSeen, targetType, 20),
    },
  ];
}

/**
 * Fetches curated categories for all tabs with minimum 10 items per carousel.
 */
export async function fetchCuratedCategories(targetType: CatalogTargetType): Promise<DiscoverCategoryRow[]> {
  // 1. In-memory check
  const cached = categoriesCache[targetType];
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }

  // 2. Persistent storage check: returns in 0.001ms on refresh/revisit
  try {
    const stored = localStorage.getItem(`istream_cat_${targetType}_v7`);
    const storedTime = Number(localStorage.getItem(`istream_cat_${targetType}_v7_ts`) || 0);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        categoriesCache[targetType] = { data: parsed, time: storedTime || Date.now() };
        if (Date.now() - storedTime >= CACHE_TTL) {
          setTimeout(() => {
            loadSharedRawData().catch(() => {});
          }, 8000);
        }
        return parsed;
      }
    }
  } catch {}

  // 3. Instant baseline generation (0ms)
  const baseline = buildBaselineCategories(targetType);
  categoriesCache[targetType] = { data: baseline, time: Date.now() };

  // Trigger background enrichment and save to cache
  setTimeout(async () => {
    try {
      const { catalogs, benchmarks } = await loadSharedRawData();
      const globalSeen = new Set<string>();
      const enrichedCategories: DiscoverCategoryRow[] = [
        {
          id: `category_${targetType}_recent`,
          title: getCategoryTitle('recent', targetType),
          items: buildRowItems(
            catalogs.recent.movies.filter(isRecentRelease),
            catalogs.recent.series.filter(isRecentRelease),
            benchmarks.recent.movies,
            benchmarks.recent.series,
            globalSeen,
            targetType,
            20,
            true
          ),
        },
        {
          id: `category_${targetType}_top_rated`,
          title: getCategoryTitle('top_rated', targetType),
          items: buildRowItems(catalogs.top_rated.movies, catalogs.top_rated.series, benchmarks.top_rated.movies, benchmarks.top_rated.series, globalSeen, targetType, 20),
        },
        {
          id: `category_${targetType}_auteur`,
          title: getCategoryTitle('auteur', targetType),
          items: buildRowItems(catalogs.auteur?.movies || [], catalogs.auteur?.series || [], benchmarks.auteur.movies, benchmarks.auteur.series, globalSeen, targetType, 20),
        },
        {
          id: `category_${targetType}_drama`,
          title: getCategoryTitle('drama', targetType),
          items: buildRowItems(catalogs.drama.movies, catalogs.drama.series, benchmarks.drama.movies, benchmarks.drama.series, globalSeen, targetType, 20),
        },
        {
          id: `category_${targetType}_crime`,
          title: getCategoryTitle('crime', targetType),
          items: buildRowItems(catalogs.crime.movies, catalogs.crime.series, benchmarks.crime.movies, benchmarks.crime.series, globalSeen, targetType, 20),
        },
        {
          id: `category_${targetType}_comedy`,
          title: getCategoryTitle('comedy', targetType),
          items: buildRowItems(catalogs.comedy.movies, catalogs.comedy.series, benchmarks.comedy.movies, benchmarks.comedy.series, globalSeen, targetType, 20),
        },
        {
          id: `category_${targetType}_action`,
          title: getCategoryTitle('action', targetType),
          items: buildRowItems(catalogs.action.movies, catalogs.action.series, benchmarks.action.movies, benchmarks.action.series, globalSeen, targetType, 20),
        },
        {
          id: `category_${targetType}_documentary`,
          title: getCategoryTitle('documentary', targetType),
          items: buildRowItems(catalogs.documentary.movies, catalogs.documentary.series, benchmarks.documentary.movies, benchmarks.documentary.series, globalSeen, targetType, 20),
        },
        {
          id: `category_${targetType}_horror`,
          title: getCategoryTitle('horror', targetType),
          items: buildRowItems(catalogs.horror.movies, catalogs.horror.series, benchmarks.horror.movies, benchmarks.horror.series, globalSeen, targetType, 20),
        },
        {
          id: `category_${targetType}_thriller`,
          title: getCategoryTitle('thriller', targetType),
          items: buildRowItems(catalogs.thriller.movies, catalogs.thriller.series, benchmarks.thriller.movies, benchmarks.thriller.series, globalSeen, targetType, 20),
        },
        {
          id: `category_${targetType}_romance`,
          title: getCategoryTitle('romance', targetType),
          items: buildRowItems(catalogs.romance.movies, catalogs.romance.series, benchmarks.romance.movies, benchmarks.romance.series, globalSeen, targetType, 20),
        },
        {
          id: `category_${targetType}_animated`,
          title: getCategoryTitle('animated', targetType),
          items: buildRowItems(catalogs.animated.movies, catalogs.animated.series, benchmarks.animated.movies, benchmarks.animated.series, globalSeen, targetType, 20),
        },
        {
          id: `category_${targetType}_adventure`,
          title: getCategoryTitle('adventure', targetType),
          items: buildRowItems(catalogs.adventure.movies, catalogs.adventure.series, benchmarks.adventure.movies, benchmarks.adventure.series, globalSeen, targetType, 20),
        },
        {
          id: `category_${targetType}_fantasy`,
          title: getCategoryTitle('fantasy', targetType),
          items: buildRowItems(catalogs.fantasy.movies, catalogs.fantasy.series, benchmarks.fantasy.movies, benchmarks.fantasy.series, globalSeen, targetType, 20),
        },
        {
          id: `category_${targetType}_superhero`,
          title: getCategoryTitle('superhero', targetType),
          items: buildRowItems(catalogs.superhero?.movies || [], catalogs.superhero?.series || [], benchmarks.superhero.movies, benchmarks.superhero.series, globalSeen, targetType, 20),
        },
        {
          id: `category_${targetType}_scifi`,
          title: getCategoryTitle('scifi', targetType),
          items: buildRowItems(catalogs.scifi.movies, catalogs.scifi.series, benchmarks.scifi.movies, benchmarks.scifi.series, globalSeen, targetType, 20),
        },
        {
          id: `category_${targetType}_western`,
          title: getCategoryTitle('western', targetType),
          items: buildRowItems(catalogs.western.movies, catalogs.western.series, benchmarks.western.movies, benchmarks.western.series, globalSeen, targetType, 20),
        },
        {
          id: `category_${targetType}_war`,
          title: getCategoryTitle('war', targetType),
          items: buildRowItems(catalogs.war.movies, catalogs.war.series, benchmarks.war.movies, benchmarks.war.series, globalSeen, targetType, 20),
        },
      ];

      categoriesCache[targetType] = { data: enrichedCategories, time: Date.now() };
      try {
        localStorage.setItem(`istream_cat_${targetType}_v7`, JSON.stringify(enrichedCategories));
        localStorage.setItem(`istream_cat_${targetType}_v7_ts`, String(Date.now()));
      } catch {}
    } catch {}
  }, 100);

  return baseline;
}

export const fetchDiscoverCategories = () => fetchCuratedCategories('all');
export const fetchMovieCategories = () => fetchCuratedCategories('movie');
export const fetchSeriesCategories = () => fetchCuratedCategories('series');
