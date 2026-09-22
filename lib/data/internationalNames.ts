import { REGEN_NAME_DATABASE, type RegenNamePool } from "@/lib/data/regenNames";

const EXTRA_NAMES: Record<string, { first: string[]; last: string[]; base?: string }> = {
  India: { base: "Associate", first: ["Abhishek", "Aditya", "Akash", "Aniket", "Arnav", "Atharv", "Ishaan", "Kunal", "Manav", "Pranav", "Rajat", "Rishabh"], last: ["Agarwal", "Bumrah", "Chahal", "Chauhan", "Desai", "Gaikwad", "Gill", "Jaiswal", "Kulkarni", "Nair", "Pawar", "Reddy"] },
  Pakistan: { base: "Associate", first: ["Abbas", "Abdullah", "Babar", "Fakhar", "Haider", "Haseeb", "Hasnain", "Iftikhar", "Mohsin", "Naseem", "Salman", "Shaheen"], last: ["Afridi", "Akram", "Azam", "Babar", "Butt", "Hafeez", "Masood", "Mir", "Rauf", "Rizwan", "Shadab", "Wasim"] },
  Scotland: { base: "England", first: ["Alasdair", "Angus", "Calum", "Craig", "Euan", "Finlay", "Fraser", "Gregor", "Hamish", "Iain", "Ross", "Stuart"], last: ["Baird", "Campbell", "Douglas", "Drummond", "Fraser", "Gordon", "Hamilton", "MacLeod", "McKay", "Munro", "Sinclair", "Stewart"] },
  Netherlands: { base: "England", first: ["Bas", "Daan", "Dirk", "Floris", "Jeroen", "Koen", "Lars", "Max", "Pieter", "Roelof", "Teun", "Wesley"], last: ["Bakker", "de Boer", "de Jong", "de Vries", "Klein", "Meijer", "Mulder", "van Beek", "van Dijk", "van Meekeren", "Visser", "Vos"] },
  Nepal: { base: "Associate", first: ["Aarif", "Aasif", "Bhim", "Dipendra", "Gyanendra", "Kamal", "Karan", "Kushal", "Lalit", "Pradeep", "Rohit", "Sompal"], last: ["Airee", "Bhandari", "Bhurtel", "Bohara", "Gurung", "Jha", "Karki", "Khadka", "Lama", "Malla", "Paudel", "Thapa"] },
  "United States": { base: "Associate", first: ["Aaron", "Ali", "Brandon", "Corey", "Gajanand", "Harmeet", "Juan", "Monank", "Nisarg", "Saurabh", "Steven", "Xavier"], last: ["Anderson", "Brown", "Hamilton", "Jones", "Kumar", "Marshall", "Patel", "Richards", "Singh", "Taylor", "Williams", "Young"] },
  Canada: { base: "Associate", first: ["Aaron", "Akhil", "Dillon", "Harsh", "Jeremy", "Junaid", "Kanwar", "Navneet", "Nicholas", "Pargat", "Rayyan", "Saad"], last: ["Dhaliwal", "Gordon", "Heyliger", "Johnson", "Kumar", "Patel", "Sandhu", "Singh", "Suri", "Thomas", "Wijeyeratne", "Zafar"] },
  Namibia: { base: "South Africa", first: ["Bernard", "Dawie", "Ewald", "Gerhard", "Jan", "Jan-Nicol", "Jonathan", "Karl", "Lo-handre", "Ruben", "Stefan", "Zane"], last: ["Baard", "Davids", "Erasmus", "Fouche", "Kotze", "Loftie-Eaton", "Louwrens", "Scholtz", "Smit", "Snyman", "van Lingen", "Viljoen"] },
  "United Arab Emirates": { base: "Associate", first: ["Alishan", "Aryansh", "Basil", "Junaid", "Karthik", "Muhammad", "Rahul", "Rameez", "Rohan", "Sanchit", "Tanish", "Vriitya"], last: ["Afzal", "Ahmed", "Ali", "Anwar", "Hameed", "Khan", "Mustafa", "Naseer", "Raja", "Shah", "Sharma", "Suri"] },
  Oman: { base: "Associate", first: ["Aamir", "Aqib", "Bilal", "Fayyaz", "Jatinder", "Kaleem", "Kashyap", "Mehran", "Nadeem", "Pratik", "Shoaib", "Zeeshan"], last: ["Ali", "Butt", "Khan", "Khawar", "Maqsood", "Mohammad", "Nadeem", "Nawaz", "Patel", "Praja", "Sulehri", "Wasim"] },
  "Papua New Guinea": { base: "Associate", first: ["Alei", "Assad", "Charles", "Chad", "Hiri", "Jack", "Kabua", "Kiplin", "Lega", "Norman", "Sese", "Tony"], last: ["Amini", "Ata", "Bau", "Gardner", "Hekure", "Kamea", "Kariko", "Morea", "Siaka", "Soper", "Ura", "Vala"] },
  Uganda: { base: "Associate", first: ["Alpesh", "Arnold", "Brian", "Cosmas", "Dinesh", "Frank", "Henry", "Juma", "Kenneth", "Riazat", "Roger", "Simon"], last: ["Alegge", "Kyewuta", "Masaba", "Miya", "Mukasa", "Nsubuga", "Obuya", "Oloka", "Ramjani", "Riazat", "Sesazi", "Waiswa"] },
  Kenya: { base: "Associate", first: ["Aman", "Collins", "Dhiren", "Elijah", "Francis", "Irfan", "Lucas", "Nelson", "Rakep", "Sachin", "Shem", "Vraj"], last: ["Karim", "Luseno", "Ngoche", "Obanda", "Odhiambo", "Odoyo", "Ouma", "Patel", "Singh", "Tikolo", "Wachira", "Wangila"] },
  "Hong Kong": { base: "Associate", first: ["Aizaz", "Anshuman", "Ayush", "Babar", "Ehsan", "Haroon", "Kinchit", "Martin", "Nizakat", "Raag", "Scott", "Zeeshan"], last: ["Ahmed", "Arshad", "Dar", "Hayat", "Khan", "McKechnie", "Murtaza", "Rath", "Shah", "Singh", "Trivedi", "Waheed"] },
  Malaysia: { base: "Associate", first: ["Ahmad", "Ainool", "Amir", "Anwar", "Fitri", "Khizar", "Muhammad", "Pavandeep", "Sharvin", "Syazrul", "Vijay", "Virandeep"], last: ["Aziz", "Faiz", "Hamzah", "Khan", "Malik", "Munusamy", "Rahim", "Sandhu", "Sharif", "Singh", "Syed", "Zulkifle"] },
  Italy: { base: "England", first: ["Alessandro", "Andrea", "Davide", "Francesco", "Gianluca", "Giovanni", "Lorenzo", "Luca", "Marco", "Matteo", "Niccolo", "Stefano"], last: ["Bianchi", "Colombo", "Conti", "De Luca", "Esposito", "Ferrari", "Gallo", "Mancini", "Marino", "Ricci", "Romano", "Rossi"] },
  Jersey: { base: "England", first: ["Asa", "Ben", "Charlie", "Corey", "Dominic", "Elliot", "Harrison", "Jonty", "Luke", "Patrick", "Rhys", "Zak"], last: ["Britton", "Carlyon", "Dunford", "Gough", "Greenwood", "Hawkins", "Higgins", "Morris", "Perchard", "Rhodes", "Tribe", "Wyatt"] },
};

function unique(values: readonly string[]): string[] { return Array.from(new Set(values.filter(Boolean))); }
function expand(values: string[], fallbacks: readonly string[]): string[] {
  const result = unique([...values, ...fallbacks]);
  let index = 0;
  while (result.length < 60) {
    const root = fallbacks[index % fallbacks.length] ?? `Name${index + 1}`;
    const candidate = index % 2 === 0 ? `${root}${String.fromCharCode(65 + Math.floor(index / fallbacks.length) % 26)}` : `${root}-${Math.floor(index / fallbacks.length) + 2}`;
    if (!result.includes(candidate)) result.push(candidate);
    index += 1;
  }
  return result.slice(0, 60);
}

export function internationalNamePool(country: string): RegenNamePool {
  const extra = EXTRA_NAMES[country];
  const existing = REGEN_NAME_DATABASE[country];
  const base = existing ?? REGEN_NAME_DATABASE[extra?.base ?? "Associate"] ?? REGEN_NAME_DATABASE.Associate;
  return {
    firstNames: expand(extra?.first ?? [], base.firstNames),
    lastNames: expand(extra?.last ?? [], base.lastNames),
  };
}

export function generateInternationalName(country: string, random: () => number): string {
  const pool = internationalNamePool(country);
  return `${pool.firstNames[Math.floor(random() * pool.firstNames.length)]} ${pool.lastNames[Math.floor(random() * pool.lastNames.length)]}`;
}
