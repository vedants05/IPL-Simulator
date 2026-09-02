import { INDIAN_STATE_REGEN_NAME_POOLS } from "./indianStateRegenNames";

/**
 * Common-name pools for generated players.  These intentionally contain
 * broadly familiar given names and surnames rather than real-player records,
 * so a long save produces believable new players without copying a database
 * of current cricketers. Every supported country has 50+ options per field.
 */
export type RegenNamePool = {
  firstNames: readonly string[];
  lastNames: readonly string[];
};

const INDIAN_FIRST_NAMES = Array.from(new Set(
  Object.values(INDIAN_STATE_REGEN_NAME_POOLS).flatMap((pool) => pool.firstNames),
));
const INDIAN_LAST_NAMES = Array.from(new Set(
  Object.values(INDIAN_STATE_REGEN_NAME_POOLS).flatMap((pool) => pool.lastNames),
));

export const REGEN_NAME_DATABASE: Record<string, RegenNamePool> = {
  India: {
    firstNames: INDIAN_FIRST_NAMES,
    lastNames: INDIAN_LAST_NAMES,
  },
  Australia: {
    firstNames: ["Aaron", "Adam", "Alex", "Andrew", "Anthony", "Ben", "Blake", "Brad", "Brendan", "Callum", "Cameron", "Chris", "Connor", "Daniel", "David", "Dylan", "Ethan", "Grant", "Hayden", "Jack", "Jacob", "Jake", "James", "Jason", "Josh", "Lachlan", "Liam", "Luke", "Marcus", "Mark", "Matthew", "Max", "Mitchell", "Nathan", "Nick", "Oliver", "Patrick", "Peter", "Rhys", "Ryan", "Sam", "Scott", "Sean", "Simon", "Tim", "Tom", "Travis", "Tyler", "William", "Zach", "Jordan"],
    lastNames: ["Adams", "Anderson", "Bailey", "Baker", "Bell", "Brown", "Campbell", "Carter", "Clarke", "Collins", "Cook", "Cooper", "Cox", "Davis", "Edwards", "Evans", "Fisher", "Foster", "Green", "Hall", "Harris", "Hill", "Howard", "Hughes", "Jackson", "Johnson", "King", "Lee", "Lewis", "Martin", "Mitchell", "Morgan", "Morris", "Murphy", "Nelson", "Parker", "Phillips", "Reid", "Richardson", "Roberts", "Robinson", "Scott", "Smith", "Stewart", "Taylor", "Thompson", "Turner", "Walker", "White", "Wilson", "Wright"],
  },
  England: {
    firstNames: ["Alfie", "Andrew", "Anthony", "Ashley", "Ben", "Callum", "Charlie", "Connor", "Craig", "Daniel", "Dominic", "Edward", "Elliot", "George", "Graham", "Harry", "Henry", "James", "Jamie", "Joe", "Jonathan", "Jordan", "Kieran", "Lewis", "Liam", "Luke", "Martin", "Matthew", "Michael", "Nathan", "Nicholas", "Oliver", "Paul", "Peter", "Richard", "Rob", "Robert", "Ross", "Ryan", "Sam", "Scott", "Sean", "Stephen", "Thomas", "Tom", "Will", "William", "Zac", "Harrison", "Miles", "Theo"],
    lastNames: ["Bailey", "Barker", "Bennett", "Black", "Brooks", "Brown", "Butler", "Carter", "Chapman", "Clarke", "Cole", "Collins", "Cooper", "Davies", "Dawson", "Edwards", "Ellis", "Evans", "Foster", "Fox", "Green", "Griffiths", "Hall", "Harrison", "Harvey", "Hughes", "Jackson", "James", "Johnson", "Jones", "King", "Lewis", "Martin", "Mason", "Mitchell", "Moore", "Morgan", "Morris", "Parker", "Phillips", "Price", "Reed", "Roberts", "Robinson", "Scott", "Smith", "Taylor", "Thomas", "Walker", "Watson", "Williams"],
  },
  "South Africa": {
    firstNames: ["Aiden", "Andile", "Brandon", "Brett", "Cameron", "Chris", "Craig", "Dale", "Darren", "David", "Dean", "Dylan", "Ethan", "Francois", "Gavin", "Grant", "Heinrich", "Jaco", "Jacques", "Jason", "Jean", "Johan", "Kagiso", "Keegan", "Kyle", "Liam", "Lutho", "Mandla", "Marco", "Matthew", "Morné", "Musa", "Neil", "Nhlanhla", "Paul", "Pieter", "Quinton", "Rassie", "Reeza", "Ruan", "Ryan", "Sibonelo", "Siyabonga", "Temba", "Theunis", "Thabo", "Vernon", "Wayne", "Yaseen", "Zubayr", "Lungi"],
    lastNames: ["Adams", "Botha", "Boucher", "Burger", "Coetzee", "Cronje", "Daniels", "de Klerk", "de Villiers", "du Plessis", "Dube", "du Toit", "Erasmus", "Fourie", "Hendricks", "Jacobs", "Jansen", "Jonker", "Klaasen", "Kok", "Kriel", "Kruger", "Louw", "Maharaj", "Makgoba", "Malan", "Mokoena", "Moore", "Morris", "Mthembu", "Naidoo", "Nel", "Ngcobo", "Nkosi", "Petersen", "Pienaar", "Pretorius", "Rabie", "Rossouw", "Smit", "Smith", "Steyn", "Swart", "van der Merwe", "van Wyk", "Viljoen", "Williams", "Xitsonga", "Zondo", "Zulu", "Le Roux"],
  },
  "West Indies": {
    firstNames: ["Aaron", "Adrian", "Andre", "Anthony", "Brandon", "Carlos", "Chad", "Chris", "Darren", "Dwayne", "Fabian", "Franklin", "Gavin", "Hayden", "Jamal", "Jason", "Jermaine", "Jerome", "Joel", "John", "Jonathan", "Joshua", "Kemar", "Kevin", "Kieron", "Kirk", "Kyle", "Leon", "Liam", "Marlon", "Nicholas", "Odean", "Oshane", "Raymond", "Roston", "Rovman", "Ryan", "Samuel", "Shai", "Shamar", "Sheldon", "Sherfane", "Sunil", "Tino", "Travis", "Wayne", "Akeal", "Alzarri", "Obed", "Ramon", "Keacy"],
    lastNames: ["Allen", "Baptiste", "Barnes", "Best", "Blackwood", "Bonner", "Brathwaite", "Bravo", "Brooks", "Brown", "Campbell", "Carter", "Charles", "Chase", "Cottrell", "Cox", "Davis", "Edwards", "Forde", "Gabriel", "Goodman", "Grant", "Greaves", "Griffith", "Harris", "Haynes", "Hosein", "Holder", "Hope", "Hunte", "James", "Joseph", "King", "Lewis", "Mayes", "McCoy", "Mayers", "McKenzie", "Motie", "Nurse", "Pope", "Powell", "Reifer", "Richards", "Rutherford", "Samuels", "Seales", "Smith", "Thomas", "Walsh", "Williams"],
  },
  "New Zealand": {
    firstNames: ["Adam", "Alex", "Andrew", "Ben", "Blair", "Bradley", "Brendon", "Caleb", "Callum", "Cameron", "Chris", "Corey", "Dane", "Daniel", "Daryl", "Dylan", "Finn", "Hamish", "Henry", "Isaac", "Jacob", "James", "Jamie", "Kane", "Logan", "Luke", "Matt", "Michael", "Mitchell", "Nathan", "Neil", "Nick", "Ollie", "Paul", "Peter", "Rachin", "Robbie", "Ross", "Ryan", "Sam", "Scott", "Sean", "Simon", "Tim", "Tom", "Trent", "Will", "Zak", "George", "Hunter", "Toby"],
    lastNames: ["Anderson", "Bennett", "Blair", "Boulton", "Brown", "Campbell", "Clark", "Clarke", "Cooper", "Craig", "Davis", "Dixon", "Elliott", "Ferguson", "Fisher", "Fletcher", "Green", "Hall", "Harris", "Henderson", "Henry", "Hughes", "Jackson", "Johnson", "Jones", "Kelly", "Kennedy", "King", "Lee", "MacDonald", "Marshall", "Martin", "McKenzie", "Miller", "Mitchell", "Moore", "Murray", "O'Connor", "Parker", "Patel", "Reid", "Roberts", "Robinson", "Scott", "Smith", "Taylor", "Thompson", "Walker", "White", "Wilson", "Young"],
  },
  "Sri Lanka": {
    firstNames: ["Akila", "Angelo", "Asela", "Avishka", "Bhanuka", "Charith", "Chamika", "Chamindu", "Chandimal", "Dhananjaya", "Dasun", "Dhanushka", "Dilshan", "Dimuth", "Dinesh", "Dushmantha", "Isuru", "Jeffrey", "Kamil", "Kusal", "Lahiru", "Lasith", "Maheesh", "Niroshan", "Nuwan", "Pathum", "Prabath", "Pramod", "Ramesh", "Sadeera", "Sahan", "Sahan", "Shehan", "Tharindu", "Thisara", "Upul", "Vishwa", "Wanindu", "Kasun", "Ashen", "Janith", "Lakshan", "Madushanka", "Nimesh", "Oshada", "Pavan", "Ravindu", "Sachindu", "Thikshana", "Vikum", "Yasiru"],
    lastNames: ["Bandara", "Chandimal", "Dananjaya", "de Silva", "Dickwella", "Dilshan", "Fernando", "Gunaratne", "Gunasekara", "Herath", "Jayasinghe", "Jayawardene", "Karunaratne", "Kumara", "Kusal", "Lakmal", "Mendis", "Perera", "Pradeep", "Rajapaksa", "Ranatunga", "Ratnayake", "Samarakoon", "Sandakan", "Shanaka", "Silva", "Tharanga", "Theekshana", "Udana", "Vithanage", "Wellalage", "Wijesinghe", "Wijeratne", "Yapa", "Abeysekera", "Balasuriya", "Chameera", "Dias", "Ekanayake", "Gamage", "Hapugoda", "Illangakoon", "Jayasuriya", "Kanchana", "Madushanka", "Nanayakkara", "Pathirana", "Peiris", "Rambukwella", "Senanayake", "Warnapura"],
  },
  Afghanistan: {
    firstNames: ["Ahmad", "Akbar", "Aman", "Amin", "Asghar", "Aziz", "Bilal", "Faisal", "Farid", "Fazal", "Hamid", "Hassan", "Ibrahim", "Imran", "Ismail", "Jamal", "Karim", "Khalid", "Mujeeb", "Mohammad", "Nabi", "Najib", "Nasir", "Noor", "Omar", "Qais", "Rahim", "Rahman", "Rashid", "Sami", "Shafiqullah", "Shahid", "Sharafuddin", "Shoaib", "Sultan", "Tariq", "Usman", "Wahid", "Yamin", "Yasir", "Zahir", "Zia", "Aimal", "Bashir", "Daud", "Ehsan", "Habib", "Latif", "Sadiq", "Wali", "Zubair"],
    lastNames: ["Ahmadi", "Akbari", "Alizai", "Amiri", "Azizi", "Bashir", "Fazli", "Hakimi", "Hamidi", "Hussaini", "Ibrahimi", "Jamal", "Khan", "Kohistani", "Ludin", "Mangal", "Mohammadi", "Nabi", "Nazari", "Noori", "Omari", "Paktin", "Rahimi", "Rasooli", "Safi", "Said", "Sediqi", "Shinwari", "Sultani", "Tanvir", "Tareen", "Wali", "Wardak", "Yousufi", "Zadran", "Zahid", "Zazai", "Amini", "Barakzai", "Daudzai", "Ferozi", "Ghafoori", "Jafari", "Kakar", "Khalili", "Mahmoodi", "Mansoori", "Naimi", "Qadri", "Sahar", "Waseem"],
  },
  Bangladesh: {
    firstNames: ["Abdullah", "Afif", "Akbar", "Anamul", "Ariful", "Asif", "Ebadot", "Fahim", "Faisal", "Hasan", "Imrul", "Irfan", "Jaker", "Khaled", "Litton", "Mahadi", "Mahmud", "Mehidy", "Mominul", "Mosaddek", "Mustafizur", "Najmul", "Nasir", "Nazmul", "Nayeem", "Nurul", "Rakibul", "Rishad", "Rubel", "Saif", "Sakib", "Shadman", "Shahadat", "Shakib", "Shamim", "Shanto", "Sharif", "Soumya", "Tanzid", "Tanvir", "Taskin", "Towhid", "Yasir", "Yasin", "Zakir", "Arafat", "Biplob", "Farhad", "Habib", "Rony", "Sabbir"],
    lastNames: ["Ahmed", "Alam", "Ali", "Anik", "Chowdhury", "Das", "Dey", "Haque", "Hasan", "Hossain", "Islam", "Khan", "Mahmud", "Mia", "Miah", "Mollah", "Mondal", "Momin", "Rahman", "Rana", "Roy", "Sarkar", "Siddique", "Sikdar", "Talukdar", "Uddin", "Akter", "Amin", "Babu", "Biswas", "Bhuiyan", "Faruq", "Gazi", "Hassan", "Hridoy", "Jewel", "Kabir", "Kamal", "Karim", "Kazi", "Mazumder", "Miraz", "Mushfiq", "Nabi", "Nayem", "Noman", "Parvez", "Rafi", "Saha", "Shuvo", "Zaman"],
  },
  Zimbabwe: {
    firstNames: ["Ashley", "Blessing", "Brandon", "Brian", "Brendon", "Carl", "Charles", "Clive", "Craig", "Daniel", "David", "Dion", "Donald", "Elton", "Ervine", "Faraz", "Garry", "Hamilton", "Innocent", "Javon", "John", "Joylord", "Keith", "Kevin", "Kyle", "Lawrence", "Luke", "Malcolm", "Marumani", "Milton", "Murray", "Nathan", "Nigel", "Nyasha", "Peter", "Prince", "Regis", "Richard", "Ricky", "Ryan", "Sean", "Sikandar", "Solomon", "Stuart", "Tafadzwa", "Tanaka", "Tendai", "Tinashe", "Tony", "Victor", "Wesley"],
    lastNames: ["Bennett", "Burl", "Chatara", "Chibhabha", "Chigumbura", "Chinouya", "Chisoro", "Chivanga", "Chowdhury", "Cremer", "Ervine", "Gumbie", "Jongwe", "Kaia", "Kamunhukamwe", "Kasuza", "Kaitano", "Madande", "Marumani", "Masakadza", "Masvaure", "Matigimu", "Mavuta", "Mbofana", "Mire", "Mpofu", "Mufudza", "Mujeyi", "Mumba", "Musekiwa", "Musakanda", "Muzarabani", "Mutumbami", "Myers", "Ngarava", "Ngoma", "Nyangani", "Raza", "Sibanda", "Shumba", "Taylor", "Tiripano", "Tshuma", "Utseya", "Williams", "Waller", "Welch", "Zhuwao", "Zimunya", "Madziva", "Chakabva"],
  },
  Ireland: {
    firstNames: ["Aidan", "Alan", "Barry", "Brian", "Callum", "Cathal", "Ciaran", "Colin", "Conor", "Darragh", "David", "Declan", "Dylan", "Eamon", "Fergal", "Gareth", "Gavin", "George", "Harry", "Ian", "Jack", "James", "Jamie", "Kevin", "Lorcan", "Mark", "Martin", "Matthew", "Michael", "Neil", "Niall", "Oisin", "Paddy", "Patrick", "Paul", "Peter", "Rory", "Ryan", "Sean", "Shane", "Stephen", "Tom", "Tony", "William", "Adam", "Ben", "Cian", "Donal", "Eoin", "Finn", "Kieran"],
    lastNames: ["Byrne", "Brennan", "Burke", "Campbell", "Carroll", "Clarke", "Collins", "Connelly", "Conroy", "Cullen", "Daly", "Doherty", "Donnelly", "Doyle", "Duffy", "Dunne", "Farrell", "Fitzgerald", "Flanagan", "Gallagher", "Gibbons", "Gilmartin", "Griffin", "Harris", "Healy", "Hogan", "Kavanagh", "Kelly", "Kennedy", "Lynch", "McCarthy", "McCann", "McDonnell", "McGrath", "McKenna", "Moore", "Moran", "Murphy", "Murray", "Nolan", "O'Brien", "O'Connor", "O'Donnell", "O'Neill", "Quinn", "Reilly", "Ryan", "Sullivan", "Walsh", "White", "Whelan"],
  },
  Associate: {
    firstNames: ["Aarav", "Adam", "Adil", "Aiden", "Amaan", "Arjun", "Ben", "Bilal", "Chris", "Daniel", "David", "Ethan", "Faisal", "Hamza", "Haris", "Ibrahim", "Imran", "Isaac", "Jack", "James", "Jay", "Karan", "Liam", "Luke", "Milan", "Mohammad", "Muhammad", "Nathan", "Neil", "Noah", "Omar", "Rohan", "Ryan", "Saad", "Sam", "Sandeep", "Shiv", "Tariq", "Usman", "Vikram", "Will", "Yash", "Zain", "Ayaan", "Dev", "Farhan", "Kashif", "Naveed", "Ravi", "Rizwan", "Zubair"],
    lastNames: ["Ahmed", "Ali", "Anderson", "Bhandari", "Brown", "Chand", "Clarke", "Dawson", "Edwards", "Fletcher", "Gurung", "Hassan", "Iqbal", "Javed", "Khan", "Kumar", "Lama", "Malik", "Mehta", "Mohammad", "Nawaz", "Patel", "Rai", "Rahman", "Rana", "Saeed", "Shah", "Sharma", "Singh", "Smith", "Thapa", "Uddin", "Wilson", "Yadav", "Zaman", "Akhtar", "Bashir", "Chaudhry", "Dar", "Farooq", "Haque", "Jain", "Karki", "Maharjan", "Nabi", "Qureshi", "Rashid", "Siddiqui", "Tamang", "Verma", "Yusuf"],
  },
};

function poolForCountry(country: string): RegenNamePool {
  return REGEN_NAME_DATABASE[country] ?? REGEN_NAME_DATABASE.Associate;
}

/** Pick a deterministic full name from the correct national pool. */
export function generateRegenName(country: string, random: () => number): string {
  const pool = poolForCountry(country);
  const firstName = pool.firstNames[Math.floor(random() * pool.firstNames.length)] ?? pool.firstNames[0];
  const lastName = pool.lastNames[Math.floor(random() * pool.lastNames.length)] ?? pool.lastNames[0];
  return `${firstName} ${lastName}`;
}
