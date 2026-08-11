import type { RegenNamePool } from "@/lib/data/regenNames";

/**
 * State-keyed naming pools used only for domestic scouting discoveries.
 * Each state has at least 30 given names and 30 family names. Neighbouring
 * states intentionally retain some cultural overlap, while every selection is
 * made from the chosen state's own pool rather than the generic India pool.
 */
export const INDIAN_STATE_REGEN_NAME_POOLS: Record<string, RegenNamePool> = {
  "jammu-kashmir": {
    firstNames: ["Aabid", "Aadil", "Aamir", "Aaqib", "Adil", "Adnan", "Ahsan", "Aijaz", "Amaan", "Arif", "Danish", "Faisal", "Farhan", "Furqan", "Haroon", "Irfan", "Junaid", "Kamran", "Mansoor", "Mehraan", "Mubashir", "Nadeem", "Owais", "Parvez", "Rayees", "Sahil", "Shahid", "Shakir", "Tariq", "Yawar"],
    lastNames: ["Ahanger", "Bhat", "Dar", "Ganai", "Ganie", "Gul", "Handwara", "Jan", "Kachroo", "Kaul", "Khan", "Khanday", "Lone", "Malik", "Mantoo", "Mir", "Naqash", "Pandit", "Parray", "Qadri", "Raina", "Rather", "Reshi", "Ronga", "Shah", "Sheikh", "Sofi", "Wani", "Yatoo", "Zargar"],
  },
  "himachal-pradesh": {
    firstNames: ["Abhay", "Abhinav", "Adarsh", "Akhil", "Anirudh", "Anmol", "Ayush", "Chirag", "Devansh", "Dikshant", "Gaurav", "Harshit", "Himanshu", "Kartik", "Keshav", "Lakshay", "Manav", "Mohit", "Naman", "Naveen", "Nikhil", "Pankaj", "Paras", "Pranav", "Raghav", "Rajat", "Rohit", "Saksham", "Shivansh", "Vishal"],
    lastNames: ["Awasthi", "Banyal", "Bhardwaj", "Chandel", "Chauhan", "Dogra", "Guleria", "Jaswal", "Katoch", "Kaushal", "Koundal", "Kumar", "Lakhanpal", "Mahajan", "Mankotia", "Mehta", "Minhas", "Negi", "Pal", "Parmar", "Pathania", "Rana", "Rathore", "Saini", "Sankhyan", "Sharma", "Sood", "Thakur", "Verma", "Vinta"],
  },
  punjab: {
    firstNames: ["Amandeep", "Amritpal", "Arshdeep", "Balraj", "Dalbir", "Dilpreet", "Gagandeep", "Gurbaaz", "Gurdeep", "Gurjot", "Gurkirat", "Gurman", "Gurpreet", "Hardeep", "Harjot", "Harman", "Harnoor", "Jaskaran", "Jaspreet", "Karanbir", "Lovepreet", "Manan", "Mandeep", "Navdeep", "Prabhjot", "Ramandeep", "Simarjeet", "Sukhdeep", "Tejinder", "Yuvraj"],
    lastNames: ["Aulakh", "Bains", "Bajwa", "Bal", "Bhatti", "Brar", "Chahal", "Cheema", "Deol", "Dhaliwal", "Dhillon", "Ghuman", "Gill", "Grewal", "Hundal", "Kahlon", "Khaira", "Maan", "Mangat", "Pannu", "Randhawa", "Sandhu", "Sekhon", "Sidhu", "Singh", "Sohal", "Toor", "Virk", "Waraich", "Wattal"],
  },
  haryana: {
    firstNames: ["Aakash", "Amit", "Ankit", "Anshul", "Ashish", "Deepak", "Devender", "Dinesh", "Gaurav", "Harish", "Himanshu", "Jatin", "Kapil", "Kartik", "Kuldeep", "Lakshay", "Manish", "Mohit", "Naveen", "Neeraj", "Nitin", "Parveen", "Puneet", "Rahul", "Rakesh", "Sachin", "Sandeep", "Sumit", "Vikas", "Yogesh"],
    lastNames: ["Ahlawat", "Antil", "Beniwal", "Bishnoi", "Chahar", "Dahiya", "Dalal", "Deswal", "Dhanda", "Duhan", "Gulia", "Hooda", "Jakhar", "Kadian", "Kharb", "Khatri", "Lamba", "Malik", "Nandal", "Narwal", "Phogat", "Poonia", "Rathi", "Sangwan", "Sheoran", "Siwach", "Tanwar", "Tewatia", "Yadav", "Yatri"],
  },
  delhi: {
    firstNames: ["Aarav", "Abhinav", "Aditya", "Akshay", "Aman", "Anirudh", "Arjun", "Aryan", "Ayush", "Dhruv", "Harsh", "Ishaan", "Kabir", "Karan", "Kunal", "Laksh", "Manav", "Mayank", "Naman", "Nikhil", "Pranav", "Raghav", "Rajat", "Rishabh", "Rohan", "Samar", "Shaurya", "Shivam", "Varun", "Yash"],
    lastNames: ["Anand", "Arora", "Batra", "Bedi", "Chawla", "Chopra", "Dua", "Gambhir", "Grover", "Gupta", "Handa", "Jain", "Kapoor", "Khanna", "Kohli", "Lamba", "Malhotra", "Mehra", "Miglani", "Narang", "Pahwa", "Rajput", "Sahni", "Saluja", "Sethi", "Sharma", "Suri", "Tandon", "Vashisht", "Wadhwa"],
  },
  uttarakhand: {
    firstNames: ["Abhishek", "Aditya", "Akhil", "Aniket", "Ankit", "Anshuman", "Ayush", "Bhuvan", "Deepak", "Devendra", "Gaurav", "Harish", "Hemant", "Himanshu", "Kamal", "Karan", "Kartik", "Manish", "Mayank", "Mohit", "Mukesh", "Naveen", "Pankaj", "Pradeep", "Rahul", "Rakesh", "Rohit", "Saurabh", "Shubham", "Vivek"],
    lastNames: ["Aswal", "Bahuguna", "Bartwal", "Bisht", "Bohra", "Chamoli", "Chauhan", "Dhasmana", "Dobhal", "Gairola", "Gusain", "Joshi", "Kandari", "Kandpal", "Kathait", "Kothari", "Kukreti", "Mehra", "Nautiyal", "Negi", "Panwar", "Pathak", "Pundir", "Rawat", "Rautela", "Semwal", "Tiwari", "Uniyal", "Upreti", "Waldiya"],
  },
  rajasthan: {
    firstNames: ["Abhimanyu", "Aditya", "Ajay", "Akshat", "Anirudh", "Arvind", "Bhanwar", "Chirag", "Devendra", "Digvijay", "Gajendra", "Hanumant", "Harshvardhan", "Hemant", "Jitendra", "Kailash", "Karan", "Lokendra", "Mahendra", "Manvendra", "Narendra", "Nikhil", "Pratap", "Raghav", "Rajveer", "Ranjeet", "Sawai", "Shakti", "Uday", "Vikram"],
    lastNames: ["Bhati", "Choudhary", "Charan", "Chundawat", "Deora", "Gahlot", "Godara", "Jangid", "Kachhwaha", "Khinchi", "Mertia", "Paliwal", "Parihar", "Poonia", "Rajpurohit", "Rathore", "Rawal", "Sankhla", "Saran", "Shekhawat", "Sihag", "Sisodia", "Solanki", "Soni", "Tanwar", "Udawat", "Vyas", "Yadav", "Zala", "Jhala"],
  },
  "uttar-pradesh": {
    firstNames: ["Abhishek", "Adarsh", "Akash", "Aman", "Ankit", "Ansh", "Ayush", "Deependra", "Gaurav", "Harsh", "Kartik", "Krishna", "Kunal", "Madhav", "Mayank", "Mohit", "Naman", "Naveen", "Nikhil", "Prakhar", "Pranav", "Rahul", "Rajat", "Rishabh", "Ritesh", "Rohit", "Shashank", "Shivam", "Utkarsh", "Yash"],
    lastNames: ["Awasthi", "Bajpai", "Chaturvedi", "Chauhan", "Dikshit", "Dubey", "Dwivedi", "Gautam", "Jaiswal", "Katiyar", "Khare", "Mishra", "Nigam", "Ojha", "Pandey", "Pathak", "Rai", "Saxena", "Shukla", "Singh", "Srivastava", "Tandon", "Tiwari", "Tripathi", "Upadhyay", "Varshney", "Verma", "Yadav", "Zaidi", "Rizvi"],
  },
  bihar: {
    firstNames: ["Abhinav", "Aditya", "Akash", "Aman", "Amarjeet", "Anand", "Ankit", "Anurag", "Avinash", "Chandan", "Deepak", "Gaurav", "Kundan", "Manish", "Mukesh", "Nishant", "Pankaj", "Prabhat", "Prashant", "Raushan", "Ravi", "Ritesh", "Rohit", "Sanjeev", "Saurabh", "Shashank", "Shubham", "Sonu", "Vikash", "Vivek"],
    lastNames: ["Choudhary", "Jha", "Karn", "Kashyap", "Kumar", "Mandal", "Mishra", "Ojha", "Paswan", "Prasad", "Rai", "Raj", "Ranjan", "Roy", "Sah", "Sahay", "Sinha", "Singh", "Thakur", "Tiwari", "Verma", "Yadav", "Bharti", "Chaurasia", "Das", "Kushwaha", "Mahto", "Narayan", "Pandey", "Srivastava"],
  },
  sikkim: {
    firstNames: ["Aayush", "Anish", "Bikash", "Bishal", "Dawa", "Deepen", "Gyalpo", "Karma", "Kunga", "Lakpa", "Milan", "Nima", "Niraj", "Pema", "Phurba", "Prabin", "Prakash", "Prashant", "Rinchen", "Roshan", "Sangay", "Sanjay", "Sonam", "Tashi", "Tenzing", "Tshering", "Ugen", "Wangchuk", "Yogen", "Zangpo"],
    lastNames: ["Bhutia", "Chettri", "Dahal", "Gurung", "Karki", "Kharel", "Lama", "Lepcha", "Limbu", "Manger", "Moktan", "Newar", "Pradhan", "Rai", "Rana", "Rasaily", "Sherpa", "Subba", "Tamang", "Thapa", "Bhandari", "Basnet", "Gautam", "Ghale", "Ghimire", "Khadka", "Poudyal", "Sharma", "Sunwar", "Yonzone"],
  },
  "arunachal-pradesh": {
    firstNames: ["Abo", "Aching", "Ajum", "Akar", "Amit", "Bamang", "Bengia", "Chow", "Duyu", "Gollo", "Gyamar", "Kaling", "Karbak", "Kenjum", "Likha", "Lobsang", "Mamang", "Nabam", "Nyato", "Ojing", "Pakke", "Phassang", "Rinchin", "Taba", "Tadar", "Tage", "Takam", "Tana", "Tashi", "Techi"],
    lastNames: ["Ado", "Apang", "Bagra", "Bamang", "Bengia", "Chada", "Chakma", "Dui", "Ete", "Gadi", "Gollo", "Gyadi", "Karbak", "Karga", "Kena", "Kri", "Lollen", "Lowang", "Mize", "Nabam", "Ngoba", "Nyori", "Pertin", "Riba", "Sangcho", "Sora", "Taba", "Tadar", "Takam", "Tana"],
  },
  assam: {
    firstNames: ["Abhijit", "Anirban", "Ankur", "Arindam", "Arnab", "Bhaskar", "Bikram", "Bishal", "Debajit", "Deepjyoti", "Dhrubajyoti", "Diganta", "Gaurav", "Himangshu", "Hrishikesh", "Jitul", "Kaushik", "Manas", "Mridul", "Nayan", "Nilotpal", "Pallav", "Parag", "Pranjal", "Raktim", "Rituraj", "Sanjib", "Saurav", "Tridib", "Utpal"],
    lastNames: ["Baruah", "Bora", "Bordoloi", "Borthakur", "Chaliha", "Choudhury", "Deka", "Gogoi", "Goswami", "Hazarika", "Kalita", "Kakati", "Mahanta", "Medhi", "Nath", "Neog", "Phukan", "Rajbongshi", "Saikia", "Sarma", "Sonowal", "Talukdar", "Tamuli", "Thakuria", "Barman", "Bhuyan", "Dutta", "Lahon", "Pathak", "Sengupta"],
  },
  meghalaya: {
    firstNames: ["Aiban", "Aibok", "Alvin", "Badon", "Banlum", "Bantei", "Batskhem", "Benedict", "Dapbor", "Donkupar", "Eban", "Eugene", "Franklin", "Gary", "Kyrshan", "Lambok", "Lamphrang", "Marbhalang", "Nangtei", "Pynshai", "Pynskhem", "Ribok", "Ricky", "Sanbor", "Shiningstar", "Teibor", "Wanbok", "Wanlambok", "Wanshan", "Wellington"],
    lastNames: ["Blah", "Dkhar", "Hynniewta", "Jyrwa", "Kharbuli", "Kharkamni", "Kharshiing", "Kharsohnoh", "Khongjee", "Khonglah", "Khongwir", "Laloo", "Lyngdoh", "Mawlong", "Mawphlang", "Mawrie", "Mukhim", "Nongbet", "Nongkhlaw", "Nongkynrih", "Nongrum", "Pala", "Passah", "Rani", "Shangpliang", "Syiem", "Thangkhiew", "Warjri", "Wanniang", "Wankhar"],
  },
  nagaland: {
    firstNames: ["Akato", "Akum", "Along", "Amen", "Aren", "Ato", "Bendang", "Chuba", "Imkong", "Imli", "Khrienuo", "Kivikhu", "Lipok", "Longri", "Meren", "Mhonbemo", "Moalong", "Nungsang", "Panger", "Roko", "Sakutem", "Senti", "Temjen", "Tia", "Toshi", "Vekuto", "Vihoto", "Visato", "Wati", "Zubenthung"],
    lastNames: ["Aier", "Ao", "Chang", "Chishi", "Chophy", "Ezung", "Jamir", "Jungio", "Kikon", "Kire", "Konyak", "Krose", "Lemtur", "Longchar", "Lotha", "Murry", "Ngullie", "Pongen", "Rio", "Sangtam", "Sema", "Shikhu", "Shohe", "Sumi", "Swu", "Tetseo", "Thong", "Yepthomi", "Yimchunger", "Zhimomi"],
  },
  manipur: {
    firstNames: ["Abung", "Arambam", "Bikram", "Bishorjit", "Dinesh", "Herojit", "Ibomcha", "Joykumar", "Kennedy", "Kishan", "Lalboi", "Linthoi", "Meiraba", "Naoba", "Ningthou", "Premjit", "Rajkumar", "Rakesh", "Ranjit", "Roshan", "Sanatomba", "Somorjit", "Surchandra", "Thangjam", "Thoiba", "Tomba", "Yaiphaba", "Yumnam", "Zimik", "Zothan"],
    lastNames: ["Angom", "Haokip", "Heigrujam", "Hijam", "Kamei", "Khangembam", "Khuraijam", "Kipgen", "Konthoujam", "Laishram", "Longjam", "Luwang", "Mangang", "Moirangthem", "Mutum", "Ngangom", "Ningthoujam", "Oinam", "Pamei", "Rajkumar", "Salam", "Sapam", "Shamurailatpam", "Singh", "Taorem", "Thangjam", "Thongam", "Waikhom", "Yengkhom", "Yumnam"],
  },
  mizoram: {
    firstNames: ["Benjamin", "Calsang", "David", "Fannai", "Hminga", "Hmingthanga", "John", "Joseph", "K. Lalthan", "Lalbiak", "Lalchhan", "Lalduh", "Lalhming", "Lalnun", "Lalram", "Lalrin", "Lalsang", "Lalthan", "Malsawm", "Michael", "Raldin", "Rinawma", "Rochhar", "Rohming", "Rosang", "Samuel", "Vanlal", "Zachariah", "Zonun", "Zothan"],
    lastNames: ["Chhangte", "Chhakchhuak", "Chawngthu", "Hauhnar", "Hmar", "Khiangte", "Lalbiak", "Lalchhuan", "Lalhriat", "Lalmuana", "Lalnunmawia", "Lalremruata", "Lalrinchhana", "Lalrindika", "Lalruat", "Lalsangzuala", "Lalthlamuana", "Lalthuammawia", "Pachuau", "Pautu", "Ralte", "Renthlei", "Rokhum", "Sailo", "Thanglura", "Tochhawng", "Vanlalhruaia", "Vanlalruata", "Vansanga", "Zadeng"],
  },
  tripura: {
    firstNames: ["Abhijit", "Ajoy", "Anirban", "Arijit", "Arnab", "Bikash", "Biswajit", "Debabrata", "Debajit", "Deepayan", "Dwaipayan", "Goutam", "Jayanta", "Kaushik", "Kishore", "Manik", "Niladri", "Partha", "Prasenjit", "Rahul", "Rajib", "Ranjit", "Ratan", "Ritwik", "Sanjay", "Saptarshi", "Sourav", "Subhajit", "Suman", "Tanmoy"],
    lastNames: ["Barman", "Bhattacharjee", "Chakma", "Chakraborty", "Choudhury", "Das", "Deb", "Debbarma", "Dey", "Ghosh", "Jamatia", "Jha", "Kalai", "Kar", "Majumder", "Malakar", "Miah", "Nath", "Noatia", "Paul", "Reang", "Roy", "Rupini", "Saha", "Sarkar", "Sen", "Sinha", "Talapatra", "Tripura", "Uchoi"],
  },
  gujarat: {
    firstNames: ["Aakash", "Aarav", "Ankit", "Bhargav", "Bhavin", "Chintan", "Darshan", "Devang", "Dhruv", "Hardik", "Harsh", "Hemang", "Hiren", "Jaimin", "Jay", "Jeet", "Krunal", "Maulik", "Meet", "Mihir", "Nirav", "Parth", "Pranav", "Rahil", "Raj", "Rishi", "Ronak", "Smit", "Tirth", "Yash"],
    lastNames: ["Amin", "Barot", "Bhatt", "Chauhan", "Dalal", "Dave", "Desai", "Gandhi", "Gohil", "Jadeja", "Jani", "Joshi", "Kotecha", "Makwana", "Mehta", "Modi", "Panchal", "Pandya", "Parikh", "Patel", "Pathak", "Rana", "Raval", "Sanghvi", "Shah", "Solanki", "Thakkar", "Trivedi", "Vaghela", "Vyas"],
  },
  "madhya-pradesh": {
    firstNames: ["Abhishek", "Aditya", "Akshat", "Aman", "Aniket", "Ankit", "Anshul", "Arpit", "Avesh", "Deepak", "Harsh", "Ishwar", "Kartik", "Kuldeep", "Mihir", "Naman", "Nitesh", "Parth", "Prakhar", "Pranav", "Rajat", "Rishabh", "Ritesh", "Rohan", "Sandeep", "Saransh", "Shivam", "Shubham", "Venkatesh", "Yash"],
    lastNames: ["Agarwal", "Baghel", "Bais", "Bundela", "Chandel", "Chouhan", "Dixit", "Dubey", "Gour", "Jain", "Kachhi", "Kirar", "Kushwah", "Malviya", "Mishra", "Nema", "Nigam", "Pachori", "Pandey", "Parmar", "Patidar", "Raghuvanshi", "Rajput", "Rathore", "Saxena", "Shukla", "Sisodia", "Tiwari", "Tomar", "Yadav"],
  },
  jharkhand: {
    firstNames: ["Abhishek", "Aditya", "Akash", "Amit", "Anand", "Ankit", "Ashish", "Basant", "Deepak", "Gaurav", "Kunal", "Manish", "Nishant", "Pankaj", "Pradeep", "Rahul", "Rakesh", "Ranjit", "Ravi", "Rohit", "Sandeep", "Sanjay", "Saurabh", "Shubham", "Somnath", "Sunil", "Vikash", "Vimal", "Vinay", "Vivek"],
    lastNames: ["Barla", "Baskey", "Besra", "Birua", "Deogam", "Ekka", "Hembram", "Horo", "Kerketta", "Khalkho", "Kisku", "Kujur", "Lakra", "Linda", "Mahto", "Marandi", "Minz", "Munda", "Murmu", "Oraon", "Purty", "Soren", "Soy", "Tigga", "Tirkey", "Tudu", "Toppo", "Xalxo", "Kandulna", "Kongari"],
  },
  "west-bengal": {
    firstNames: ["Abhijit", "Aniket", "Anirban", "Arijit", "Arindam", "Arnab", "Aritra", "Avik", "Debanjan", "Debjit", "Deep", "Indranil", "Joydeep", "Kaushik", "Mainak", "Nilanjan", "Prantik", "Prosenjit", "Rahul", "Ritwik", "Rohan", "Sagnik", "Saptarshi", "Sayan", "Soham", "Soumyajit", "Subhajit", "Sudip", "Tanmoy", "Utsav"],
    lastNames: ["Bandyopadhyay", "Banerjee", "Basu", "Bhattacharya", "Biswas", "Bose", "Chakraborty", "Chatterjee", "Chowdhury", "Das", "Datta", "Dey", "Dhar", "Gangopadhyay", "Ganguly", "Ghosh", "Guha", "Karmakar", "Lahiri", "Majumdar", "Mitra", "Mukherjee", "Nandi", "Pal", "Paul", "Ray", "Saha", "Sarkar", "Sen", "Sengupta"],
  },
  chhattisgarh: {
    firstNames: ["Abhishek", "Akash", "Aman", "Amit", "Ankit", "Ashutosh", "Bhupendra", "Deepak", "Devendra", "Gajendra", "Harish", "Jitesh", "Kamal", "Lokesh", "Manish", "Mukesh", "Nikhil", "Pankaj", "Pradeep", "Rahul", "Rajesh", "Rakesh", "Rishabh", "Ritesh", "Rohit", "Santosh", "Shashank", "Shubham", "Vikas", "Yashwant"],
    lastNames: ["Baghel", "Chandrakar", "Dewangan", "Dhruw", "Gendre", "Jangde", "Kashyap", "Kaushik", "Kurre", "Markam", "Maravi", "Netam", "Nishad", "Paikra", "Patel", "Rathia", "Sahu", "Sinha", "Soni", "Tandi", "Tekam", "Thakur", "Verma", "Yadav", "Banjare", "Korram", "Mandavi", "Nag", "Poyam", "Usendi"],
  },
  odisha: {
    firstNames: ["Abhishek", "Aditya", "Akash", "Ankit", "Anshuman", "Ashutosh", "Bikash", "Biswajit", "Debabrata", "Deepak", "Dibya", "Jagannath", "Jyotiranjan", "Kishan", "Manas", "Niranjan", "Pratyush", "Rakesh", "Ranjan", "Rashmi", "Ritesh", "Roshan", "Sambit", "Sandeep", "Saswat", "Shubham", "Siddhant", "Subham", "Suraj", "Swastik"],
    lastNames: ["Baral", "Behera", "Biswal", "Das", "Dash", "Jena", "Kar", "Khuntia", "Lenka", "Mahapatra", "Mallik", "Mangaraj", "Mishra", "Mohanty", "Nayak", "Panda", "Panigrahi", "Parida", "Patnaik", "Pattnaik", "Pradhan", "Rath", "Rout", "Sahoo", "Samal", "Satapathy", "Senapati", "Swain", "Tripathy", "Acharya"],
  },
  maharashtra: {
    firstNames: ["Aaditya", "Abhijit", "Adwait", "Ajinkya", "Akshay", "Amey", "Aniket", "Atharva", "Chinmay", "Gaurav", "Harshal", "Kaustubh", "Kedar", "Mandar", "Mayur", "Nachiket", "Nikhil", "Omkar", "Prathamesh", "Rohan", "Ruturaj", "Sanket", "Saurabh", "Shantanu", "Shreyas", "Siddhesh", "Swapnil", "Tejas", "Vaibhav", "Yash"],
    lastNames: ["Bhave", "Bhosale", "Chavan", "Deshmukh", "Deshpande", "Gawande", "Gokhale", "Jadhav", "Joshi", "Kadam", "Kale", "Kamble", "Karnik", "Kulkarni", "Mahadik", "Mane", "More", "Naik", "Nene", "Patil", "Pawar", "Phadke", "Ranade", "Salunkhe", "Sawant", "Shinde", "Tambe", "Vaidya", "Wagh", "Zagade"],
  },
  goa: {
    firstNames: ["Aaron", "Adrian", "Akash", "Alister", "Amey", "Andre", "Antonio", "Ashley", "Brandon", "Brian", "Clive", "Daniel", "Darryl", "Devendra", "Elton", "Francis", "Gavin", "Joel", "Joshua", "Kedar", "Kevin", "Leon", "Lloyd", "Melroy", "Nathan", "Nilesh", "Pravin", "Rohan", "Ryan", "Savios"],
    lastNames: ["Almeida", "Araujo", "Braganza", "Carvalho", "Colaco", "Costa", "Coutinho", "D'Souza", "Dias", "Fernandes", "Furtado", "Gomes", "Kamat", "Lobo", "Mascarenhas", "Menezes", "Monteiro", "Naik", "Noronha", "Pereira", "Pinto", "Prabhu", "Rane", "Rodrigues", "Saldanha", "Sardesai", "Sequeira", "Vaz", "Velho", "Vernekar"],
  },
  telangana: {
    firstNames: ["Abhinav", "Aditya", "Akhil", "Anirudh", "Aravind", "Bhargav", "Chaitanya", "Charan", "Harsha", "Hemanth", "Karthik", "Koushik", "Manideep", "Nikhil", "Pranav", "Praneeth", "Rahul", "Rakesh", "Rohit", "Sai", "Sandeep", "Siddharth", "Srikar", "Srinivas", "Teja", "Uday", "Varun", "Vamsi", "Vishal", "Yashwanth"],
    lastNames: ["Anumula", "Bandi", "Bollineni", "Chilukuri", "Goud", "Jupally", "Kandula", "Kanneganti", "Konda", "Mamidala", "Manda", "Nallari", "Palle", "Rachakonda", "Rao", "Reddy", "Sabbani", "Sangem", "Thota", "Uppal", "Vanga", "Velama", "Yadav", "Gandla", "Katakam", "Komati", "Munnuru", "Ponnam", "Ravula", "Tummala"],
  },
  "andhra-pradesh": {
    firstNames: ["Abhishek", "Aditya", "Ajay", "Akhil", "Anand", "Bhanu", "Chaitanya", "Dheeraj", "Ganesh", "Gopi", "Harish", "Jagan", "Kalyan", "Karthik", "Kiran", "Lokesh", "Manoj", "Naga", "Pavan", "Pradeep", "Prudhvi", "Raghu", "Ravi", "Sandeep", "Satish", "Siva", "Surya", "Tarun", "Venkata", "Vijay"],
    lastNames: ["Alluri", "Bommana", "Chalasani", "Chintala", "Daggubati", "Gadde", "Ghattamaneni", "Gollapudi", "Gorantla", "Kamineni", "Kandula", "Koneru", "Maddala", "Nanduri", "Narla", "Pamulaparti", "Raju", "Rao", "Reddy", "Sagi", "Satrasala", "Tadikonda", "Uppalapati", "Varma", "Vemuri", "Yarlagadda", "Akkineni", "Bhupathiraju", "Kommareddy", "Pasupuleti"],
  },
  karnataka: {
    firstNames: ["Abhinav", "Aditya", "Akash", "Amogh", "Anirudh", "Arjun", "Bharath", "Chethan", "Darshan", "Deepak", "Ganesh", "Harsha", "Karthik", "Kaushik", "Kiran", "Manish", "Mayank", "Nikhil", "Nitin", "Pranav", "Prajwal", "Rakshith", "Rohan", "Samarth", "Shashank", "Shreyas", "Suhas", "Tejas", "Varun", "Vijay"],
    lastNames: ["Acharya", "Bhat", "Deshpande", "Gowda", "Hegde", "Joshi", "Kamath", "Karanth", "Kulkarni", "Murthy", "Nayak", "Pai", "Patil", "Prasad", "Rao", "Shetty", "Shenoy", "Udupa", "Upadhyaya", "Wodeyar", "Adiga", "Bellad", "Hebbar", "Holla", "Kamat", "Mallya", "Poojary", "Puranik", "Shanbhag", "Tunga"],
  },
  kerala: {
    firstNames: ["Abhijith", "Adarsh", "Akhil", "Amal", "Anand", "Arjun", "Arun", "Aswin", "Basil", "Bivin", "Gokul", "Hari", "Jishnu", "Joel", "Kiran", "Manu", "Midhun", "Nandu", "Nikhil", "Nithin", "Rahul", "Renjith", "Rohit", "Sachin", "Sanjay", "Sreehari", "Sreeram", "Vaisakh", "Vishnu", "Vivek"],
    lastNames: ["Abraham", "Chacko", "Cherian", "George", "Joseph", "Kurian", "Mathew", "Menon", "Nair", "Nambiar", "Namboodiri", "Pillai", "Thomas", "Varghese", "Warrier", "Panicker", "Tharakan", "Varkey", "Koshy", "Ipe", "Mammen", "Paul", "Rajan", "Raveendran", "Sasidharan", "Sukumaran", "Unnikrishnan", "Vijayan", "Balakrishnan", "Gopalakrishnan"],
  },
  "tamil-nadu": {
    firstNames: ["Abhinav", "Ajay", "Akash", "Aravind", "Arjun", "Ashwin", "Bharath", "Dinesh", "Gautham", "Hari", "Harish", "Karthik", "Kaushik", "Kishore", "Lokesh", "Madhan", "Manikandan", "Naveen", "Pradeep", "Pranav", "Raghav", "Rahul", "Ramesh", "Sai", "Sanjay", "Sriram", "Surya", "Vignesh", "Vijay", "Vishnu"],
    lastNames: ["Arumugam", "Balasubramanian", "Chandrasekar", "Ganesan", "Iyer", "Iyengar", "Kannan", "Krishnamurthy", "Kumar", "Mahadevan", "Manoharan", "Murugan", "Natarajan", "Palanisamy", "Parthasarathy", "Raghavan", "Rajan", "Rajendran", "Ramakrishnan", "Ramasamy", "Ravichandran", "Sekar", "Selvaraj", "Shankar", "Sivakumar", "Srinivasan", "Subramanian", "Sundaram", "Venkatesan", "Viswanathan"],
  },
};

function normalizedName(value: string): string {
  return value.replace(/\s*\(R\)\s*$/i, "").trim().toLocaleLowerCase("en-GB");
}

/** Deterministically pick a state-appropriate name, avoiding existing players. */
export function generateIndianStateRegenName(
  stateId: string,
  random: () => number,
  existingNames: Iterable<string> = [],
): string {
  const pool = INDIAN_STATE_REGEN_NAME_POOLS[stateId];
  if (!pool) throw new Error(`Missing Indian regen name pool for state: ${stateId}`);
  const used = new Set(Array.from(existingNames, normalizedName));
  const firstStart = Math.floor(random() * pool.firstNames.length);
  const lastStart = Math.floor(random() * pool.lastNames.length);
  const combinations = pool.firstNames.length * pool.lastNames.length;
  for (let offset = 0; offset < combinations; offset += 1) {
    const firstName = pool.firstNames[(firstStart + offset) % pool.firstNames.length];
    const lastName = pool.lastNames[(lastStart + Math.floor(offset / pool.firstNames.length)) % pool.lastNames.length];
    const candidate = `${firstName} ${lastName}`;
    if (!used.has(normalizedName(candidate))) return candidate;
  }
  return `${pool.firstNames[firstStart]} ${pool.lastNames[lastStart]}`;
}

export function validateIndianStateRegenNamePools(stateIds: Iterable<string>): string[] {
  return Array.from(stateIds).flatMap((stateId) => {
    const pool = INDIAN_STATE_REGEN_NAME_POOLS[stateId];
    if (!pool) return [`${stateId}: missing pool`];
    const issues: string[] = [];
    if (new Set(pool.firstNames).size < 30) issues.push(`${stateId}: fewer than 30 unique first names`);
    if (new Set(pool.lastNames).size < 30) issues.push(`${stateId}: fewer than 30 unique last names`);
    return issues;
  });
}
