const fs = require('fs');

const seedsContent = fs.readFileSync('lib/data/personDynamicsSeeds.ts', 'utf8');
const existingPairs = new Set();
for (const m of seedsContent.matchAll(/(?:playerPair|playerStaff|staffPair)\("([^"]+)",\s*"([^"]+)",\s*"([^"]+)"/g)) {
  const [p1, p2] = [m[1], m[2]].sort();
  existingPairs.add(p1 + '|' + p2 + '|' + m[3]);
}

const newBonds = [
  // Emerging Youngster <-> Senior Teammate (developing bond, starting low to grow)
  { cat: 'player_player', p1: 'Angkrish Raghuvanshi', p2: 'Rinku Singh', type: 'franchise_teammates', rating: 46, reason: 'Emerging youngster sharing the Kolkata Knight Riders dugout and batting group with senior finisher Rinku.', url: 'https://www.iplt20.com/teams/kolkata-knight-riders' },
  { cat: 'player_player', p1: 'Angkrish Raghuvanshi', p2: 'Venkatesh Iyer', type: 'franchise_teammates', rating: 50, reason: 'Young top-order batter learning middle-order tempo from senior KKR compatriot Venkatesh Iyer.', url: 'https://www.iplt20.com/teams/kolkata-knight-riders' },
  { cat: 'player_player', p1: 'Ramandeep Singh', p2: 'Rinku Singh', type: 'franchise_teammates', rating: 52, reason: 'Developing camaraderie in Kolkata Knight Riders lower-order finishing unit.', url: 'https://www.iplt20.com/teams/kolkata-knight-riders' },
  { cat: 'player_player', p1: 'Vaibhav Arora', p2: 'Harshit Rana', type: 'pace_tandem', rating: 55, reason: 'Young pace partnership sharing new ball and middle overs duties at Kolkata Knight Riders.', url: 'https://www.iplt20.com/teams/kolkata-knight-riders' },
  { cat: 'player_player', p1: 'Suyash Sharma', p2: 'Sunil Narine', type: 'spin_twins', rating: 54, reason: 'Young mystery spinner observing and learning craft from senior maestro Narine at KKR.', url: 'https://www.iplt20.com/teams/kolkata-knight-riders' },

  // CSK emerging bonds
  { cat: 'player_player', p1: 'Sameer Rizvi', p2: 'Ruturaj Gaikwad', type: 'mentor_protege', rating: 45, reason: 'Young big-hitting recruit guided by captain Gaikwad in Chennai Super Kings setup.', url: 'https://www.iplt20.com/teams/chennai-super-kings' },
  { cat: 'player_player', p1: 'Sameer Rizvi', p2: 'Shivam Dube', type: 'franchise_teammates', rating: 48, reason: 'Emerging spin-hitter learning middle-overs boundary striking alongside Dube at CSK.', url: 'https://www.iplt20.com/teams/chennai-super-kings' },
  { cat: 'player_player', p1: 'Mukesh Choudhary', p2: 'Deepak Chahar', type: 'pace_tandem', rating: 52, reason: 'Fellow left-and-right new-ball swing partners competing and learning within CSK pace unit.', url: 'https://www.iplt20.com/teams/chennai-super-kings' },
  { cat: 'player_player', p1: 'Tushar Deshpande', p2: 'Deepak Chahar', type: 'pace_tandem', rating: 58, reason: 'Indian seam combination operating together across multiple CSK campaigns.', url: 'https://www.iplt20.com/teams/chennai-super-kings' },

  // MI emerging bonds
  { cat: 'player_player', p1: 'Naman Dhir', p2: 'Suryakumar Yadav', type: 'mentor_protege', rating: 48, reason: 'Emerging top-order batter learning 360-degree shot-making from senior mentor Suryakumar at MI.', url: 'https://www.mumbaiindians.com/' },
  { cat: 'player_player', p1: 'Naman Dhir', p2: 'Tilak Varma', type: 'franchise_teammates', rating: 54, reason: 'Next-generation young Indian batting core sharing the Mumbai Indians top order.', url: 'https://www.mumbaiindians.com/' },
  { cat: 'player_player', p1: 'Anshul Kamboj', p2: 'Jasprit Bumrah', type: 'mentor_protege', rating: 45, reason: 'Young domestic seam sensation learning elite execution alongside Bumrah at Mumbai Indians.', url: 'https://www.mumbaiindians.com/' },
  { cat: 'player_player', p1: 'Dewald Brevis', p2: 'Suryakumar Yadav', type: 'mentor_protege', rating: 52, reason: 'Young overseas power-hitter absorbing batting intent and practice routines from Suryakumar at MI.', url: 'https://www.mumbaiindians.com/' },
  { cat: 'player_player', p1: 'Nehal Wadhera', p2: 'Tilak Varma', type: 'franchise_teammates', rating: 58, reason: 'Young middle-order pair frequently batting together in high-pressure chases for Mumbai Indians.', url: 'https://www.mumbaiindians.com/' },

  // RR emerging bonds
  { cat: 'player_player', p1: 'Dhruv Jurel', p2: 'Sanju Samson', type: 'mentor_protege', rating: 58, reason: 'Young wicketkeeper-batter learning leadership and pressure absorption from captain Samson at RR.', url: 'https://www.rajasthanroyals.com/' },
  { cat: 'player_player', p1: 'Kuldeep Sen', p2: 'Sandeep Sharma', type: 'pace_tandem', rating: 46, reason: 'Young express bowler learning seam control and variations from veteran Sandeep Sharma at RR.', url: 'https://www.rajasthanroyals.com/' },
  { cat: 'player_player', p1: 'Yashasvi Jaiswal', p2: 'Riyan Parag', type: 'franchise_teammates', rating: 62, reason: 'Longstanding age-group peers sharing Rajasthan Royals top-and-middle order development.', url: 'https://www.rajasthanroyals.com/' },

  // LSG emerging bonds
  { cat: 'player_player', p1: 'Ayush Badoni', p2: 'KL Rahul', type: 'mentor_protege', rating: 55, reason: 'Young finisher learning match-building awareness and temperament from captain KL Rahul at LSG.', url: 'https://www.lucknowsupergiants.in/' },
  { cat: 'player_player', p1: 'Mayank Yadav', p2: 'Mohsin Khan', type: 'pace_tandem', rating: 50, reason: 'Young Indian pace battery sharing rehab and opening attack responsibilities at Lucknow Super Giants.', url: 'https://www.lucknowsupergiants.in/' },
  { cat: 'player_player', p1: 'Ayush Badoni', p2: 'Ravi Bishnoi', type: 'franchise_teammates', rating: 56, reason: 'Young domestic peers who arrived at LSG in the inaugural season and bonded closely.', url: 'https://www.lucknowsupergiants.in/' },

  // RCB emerging bonds
  { cat: 'player_player', p1: 'Anuj Rawat', p2: 'Rajat Patidar', type: 'franchise_teammates', rating: 52, reason: 'Young Indian domestic batting teammates developing together in RCB middle order.', url: 'https://www.royalchallengers.com/' },
  { cat: 'player_player', p1: 'Mahipal Lomror', p2: 'Rajat Patidar', type: 'franchise_teammates', rating: 54, reason: 'Complementary left-and-right middle-overs batting partners for Royal Challengers Bengaluru.', url: 'https://www.royalchallengers.com/' },
  { cat: 'player_player', p1: 'Vijaykumar Vyshak', p2: 'Mohammed Siraj', type: 'pace_tandem', rating: 50, reason: 'Local Karnataka pacer learning international intensity from pace spearhead Siraj at RCB.', url: 'https://www.royalchallengers.com/' },

  // SRH emerging bonds
  { cat: 'player_player', p1: 'Nitish Kumar Reddy', p2: 'Abhishek Sharma', type: 'franchise_teammates', rating: 58, reason: 'Young domestic all-round stars spearheading Sunrisers Hyderabad dynamic new era.', url: 'https://www.sunrisershyderabad.in/' },
  { cat: 'player_player', p1: 'Abdul Samad', p2: 'Abhishek Sharma', type: 'franchise_teammates', rating: 55, reason: 'Longtime Sunrisers Hyderabad young batting group peers who rose through the ranks together.', url: 'https://www.sunrisershyderabad.in/' },
  { cat: 'player_player', p1: 'Umran Malik', p2: 'Bhuvneshwar Kumar', type: 'mentor_protege', rating: 52, reason: 'Raw express pacer mentored on discipline and seam presentation by veteran Bhuvneshwar at SRH.', url: 'https://www.sunrisershyderabad.in/' },

  // GT emerging bonds
  { cat: 'player_player', p1: 'Sai Sudharsan', p2: 'Rahul Tewatia', type: 'franchise_teammates', rating: 52, reason: 'Top-order anchor and lower-order finisher sharing pressure situations for Gujarat Titans.', url: 'https://www.gujarattitansipl.com/' },
  { cat: 'player_player', p1: 'R. Sai Kishore', p2: 'Sai Sudharsan', type: 'franchise_teammates', rating: 58, reason: 'Tamil Nadu domestic teammates sharing state dressing rooms and Gujarat Titans dugout.', url: 'https://www.gujarattitansipl.com/' },
  { cat: 'player_player', p1: 'Shahrukh Khan', p2: 'Rahul Tewatia', type: 'franchise_teammates', rating: 54, reason: 'Twin power-hitting middle order partners combining for death-overs onslaughts at GT.', url: 'https://www.gujarattitansipl.com/' },

  // DC emerging bonds
  { cat: 'player_player', p1: 'Abishek Porel', p2: 'Rishabh Pant', type: 'mentor_protege', rating: 54, reason: 'Young wicketkeeper-batter mentored and backed by senior keeper-captain Pant at Delhi Capitals.', url: 'https://www.delhicapitals.in/' },
  { cat: 'player_player', p1: 'Abishek Porel', p2: 'Axar Patel', type: 'franchise_teammates', rating: 50, reason: 'Young dynamic batter combining with senior all-rounder Axar in high-pressure chases at DC.', url: 'https://www.delhicapitals.in/' },
  { cat: 'player_player', p1: 'Rasikh Salam', p2: 'Khaleel Ahmed', type: 'pace_tandem', rating: 48, reason: 'Emerging seam talent combining with senior left-armer Khaleel in Delhi Capitals pace attack.', url: 'https://www.delhicapitals.in/' },
  { cat: 'player_player', p1: 'Kumar Kushagra', p2: 'Rishabh Pant', type: 'mentor_protege', rating: 44, reason: 'Young keeper-batter recruit observing Pant closely in the Delhi Capitals squad.', url: 'https://www.delhicapitals.in/' },

  // PBKS emerging bonds
  { cat: 'player_player', p1: 'Prabhsimran Singh', p2: 'Jitesh Sharma', type: 'franchise_teammates', rating: 52, reason: 'Attacking wicketkeeper-batters sharing Punjab Kings top-order and middle-order roles.', url: 'https://www.punjabkingsipl.in/' },
  { cat: 'player_player', p1: 'Harpreet Brar', p2: 'Arshdeep Singh', type: 'franchise_teammates', rating: 58, reason: 'Punjab domestic teammates and close franchise bowling unit partners for PBKS.', url: 'https://www.punjabkingsipl.in/' },
  { cat: 'player_player', p1: 'Ashutosh Sharma', p2: 'Jitesh Sharma', type: 'franchise_teammates', rating: 50, reason: 'Railways / domestic circuit power hitters connecting in Punjab Kings dugout.', url: 'https://www.punjabkingsipl.in/' },

  // Emerging Player <-> Staff Developing Bonds (40-60 range)
  { cat: 'player_staff', p1: 'Angkrish Raghuvanshi', p2: 'chandrakant-pandit', type: 'coached', rating: 48, reason: 'Young batter adapting to senior head coach Pandit tactical discipline and demands at KKR.', url: 'https://www.iplt20.com/teams/kolkata-knight-riders' },
  { cat: 'player_staff', p1: 'Ramandeep Singh', p2: 'abhishek-nayar', type: 'specialist_tutelage', rating: 55, reason: 'Power-hitting recruit benefiting from Nayar technical guidance at the KKR high performance setup.', url: 'https://www.iplt20.com/teams/kolkata-knight-riders' },
  { cat: 'player_staff', p1: 'Sameer Rizvi', p2: 'michael-hussey', type: 'specialist_tutelage', rating: 50, reason: 'Young power-hitter receiving initial batting coaching and shot selection guidance from Hussey at CSK.', url: 'https://www.iplt20.com/teams/chennai-super-kings' },
  { cat: 'player_staff', p1: 'Naman Dhir', p2: 'kieron-pollard', type: 'specialist_tutelage', rating: 52, reason: 'Young batter working with Pollard on power hitting and mental resilience at Mumbai Indians.', url: 'https://www.mumbaiindians.com/' },
  { cat: 'player_staff', p1: 'Nehal Wadhera', p2: 'mahela-jayawardene', type: 'coached', rating: 54, reason: 'Middle-order batter receiving tactical positioning and game situation coaching from Jayawardene.', url: 'https://www.mumbaiindians.com/' },
  { cat: 'player_staff', p1: 'Nitish Kumar Reddy', p2: 'daniel-vettori', type: 'coached', rating: 58, reason: 'Emerging all-rounder given expanded responsibility under head coach Vettori at Sunrisers Hyderabad.', url: 'https://www.sunrisershyderabad.in/' },
  { cat: 'player_staff', p1: 'Abishek Porel', p2: 'sourav-ganguly', type: 'talent_champion', rating: 55, reason: 'Young Bengal wicketkeeper backed by Director of Cricket Ganguly into the Delhi Capitals squad.', url: 'https://www.delhicapitals.in/' },
  { cat: 'player_staff', p1: 'Rasikh Salam', p2: 'pravin-amre', type: 'coached', rating: 46, reason: 'Young seamer receiving support and team integration within the Delhi Capitals coaching group.', url: 'https://www.delhicapitals.in/' }
];

let duplicates = 0;
for (const b of newBonds) {
  const [p1, p2] = [b.p1, b.p2].sort();
  const k = p1 + '|' + p2 + '|' + b.type;
  if (existingPairs.has(k)) {
    console.log('Duplicate:', k);
    duplicates++;
  }
}
console.log('Duplicates found:', duplicates);
console.log('Total new bonds to add:', newBonds.length);
fs.writeFileSync('new_emerging_bonds.json', JSON.stringify(newBonds, null, 2));
