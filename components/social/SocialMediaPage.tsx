"use client";
import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Award, BadgeCheck, Bell, Bookmark, CalendarDays, Camera, ChevronDown, CircleHelp, Compass, Heart, Home, Image, Mail, MessageCircle, MoreHorizontal, Play, Plus, Search, Send, Settings, Shield, Smile, Star, Users, Video, Zap } from "lucide-react";
import type { Player, Team } from "@/lib/types";
import { type SeasonPhase, type SocialPostTopic } from "@/lib/data/socialMediaPosts";
import { SOCIAL_OPINION_TEMPLATES, type SocialOpinionTrigger } from "@/lib/data/socialMediaOpinions";
import { getTriggeredTeamSocialComments } from "@/lib/data/socialMediaTeamComments";
import { SOCIAL_COMMENTS, matchesEligibility, type SocialPlatform } from "@/lib/data/socialComments";
import {
  formatPerformanceFooter,
  isPlayerPerformanceComment,
  passesPerformanceEvidence,
  performanceScope,
  performanceSentiment,
} from "@/lib/logic/socialCommentPolicy";

interface SocialPlayerStats {
  id: string; runs: number; balls: number; wickets: number; runsConceded: number; oversBowled: number; matches: number;
  dismissal?: string; fours?: number; sixes?: number;
}
interface SocialFixture {
  id: string; matchNumber: number; teamA: string; teamB: string; played: boolean; winner?: string; date?: string;
  scoreA?: { runs: number; wickets: number; overs: number };
  scoreB?: { runs: number; wickets: number; overs: number };
  scorecard?: {
    inningsA: { batting: SocialScorecardPlayer[]; bowling: SocialScorecardPlayer[] };
    inningsB: { batting: SocialScorecardPlayer[]; bowling: SocialScorecardPlayer[] };
  };
  stage?: string;
}
interface SocialScorecardPlayer {
  id: string; runs?: number; balls?: number; fours?: number; sixes?: number; wickets?: number; runsConceded?: number; overs?: number; dismissal?: string;
}
interface SocialMediaPageProps {
  team: Team; players: Record<string, Player>; playerStats: Record<string, SocialPlayerStats>;
  battingFirstXI: string[]; bowlingFirstXI: string[]; fixtures: SocialFixture[];
  captainId: string | null; impactPlayerIds: Array<string | null>; currentDate: string; currentSeason: number;
}
interface FanPost {
  id: string; username: string; comment: string; topic: SocialPostTopic; tag: string; publishedAt: string;
}

function PlatformLogo({ platform, size = 16 }: { platform: SocialPlatform; size?: number }) {
  if (platform === "x") {
    return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25h6.826l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" /></svg>;
  }
  if (platform === "reddit") {
    return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 12.1c0-1.3-1.05-2.35-2.35-2.35-.64 0-1.22.26-1.64.68-1.3-.9-2.98-1.48-4.84-1.55l.82-3.85 2.67.57a1.65 1.65 0 1 0 .23-1.02l-3.23-.69a.5.5 0 0 0-.6.38l-.95 4.59c-1.9.05-3.62.63-4.94 1.54a2.35 2.35 0 1 0-3.95 1.7c-.04.24-.06.48-.06.73 0 3.67 4.18 6.65 9.34 6.65s9.34-2.98 9.34-6.65c0-.25-.02-.49-.06-.73.14-.01.28-.03.42-.05 1.06-.16 1.86-1.08 1.86-2.15ZM8.5 13.2a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Zm6.98 3.3c-1.05 1-2.74 1.5-5.03 1.5s-3.98-.5-5.03-1.5a.5.5 0 1 1 .69-.72c.8.77 2.21 1.22 4.34 1.22s3.54-.45 4.34-1.22a.5.5 0 1 1 .69.72Zm.02-3.3a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Z" /></svg>;
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" /></svg>;
}
const hashtagSafe = (value: string) => value.replace(/[^A-Za-z0-9]/g, "");
const toCamelCase = (str: string): string => {
  return str
    .replace(/^team_/, "")
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
};
const navIcon = (label: string, platform: SocialPlatform) => {
  const size = 19;
  if (platform === "x") {
    const icons: Record<string, ReactNode> = { Home: <Home size={size} />, Explore: <Search size={size} />, Notifications: <Bell size={size} />, Messages: <Mail size={size} />, Bookmarks: <Bookmark size={size} />, Profile: <Users size={size} /> };
    return icons[label] ?? <MoreHorizontal size={size} />;
  }
  if (platform === "reddit") {
    const icons: Record<string, ReactNode> = { Home: <Home size={size} />, Popular: <TrendingIcon size={size} />, All: <Compass size={size} />, Communities: <Users size={size} />, "Custom Feeds": <Bookmark size={size} /> };
    return icons[label] ?? <MoreHorizontal size={size} />;
  }
  const icons: Record<string, ReactNode> = { Home: <Home size={size} />, Search: <Search size={size} />, Explore: <Compass size={size} />, Reels: <Play size={size} />, Messages: <Send size={size} />, Profile: <Users size={size} /> };
  return icons[label] ?? <MoreHorizontal size={size} />;
};
function TrendingIcon({ size = 19 }: { size?: number }) { return <span style={{ fontSize: size, lineHeight: 1 }}>↗</span>; }
function PlusIcon() { return <Plus size={17} />; }
function OfficialBadge() { return <BadgeCheck aria-label="Verified official account" className="inline-block shrink-0 text-sky-400" size={16} fill="currentColor" stroke="black" />; }
const fanNamePrefixes = ["Diehard", "Loyal", "True", "Proud", "United", "Daily", "Super", "Ultimate", "Real", "The"];
const fanNameSuffixes = ["Army", "FanClub", "Faithful", "Supporters", "Addict", "Nation", "Central", "Updates", "Corner", "Club"];
const regionalFanPrefixes = ["City", "Metro", "Capital", "Eastern", "Western", "Northern", "Southern", "Coastal", "Local", "State"];
const regionalFanSuffixes = ["Fans", "Supporters", "Followers", "Voices", "Army"];
const TEAM_REGION: Record<string, string> = { KKR: "Kolkata", MI: "Mumbai", RCB: "Bengaluru", CSK: "Chennai", DC: "Delhi", SRH: "Hyderabad", RR: "Rajasthan", PBKS: "Punjab", GT: "Gujarat", LSG: "Lucknow" };
const REGIONAL_NAMES: Record<string, string[]> = {
  KKR: ["Anirban Das", "Soham Banerjee", "Ritwick Ghosh", "Madhurima Sen", "Arindam Roy", "Debarati Bose", "Sayan Mukherjee", "Ishita Chatterjee", "Kunal Bhattacharya", "Moumita Dutta", "Anirban Ghosh", "Soham Roy", "Ritwick Das", "Madhurima Bose", "Arindam Sen", "Debarati Roy", "Sayan Banerjee", "Ishita Dutta", "Kunal Ghosh", "Moumita Sen", "Abir Chatterjee", "Riya Mukherjee", "Pratik Das", "Tania Bose", "Subhajit Roy", "Ananya Sen", "Joy Banerjee", "Poulomi Ghosh", "Niladri Dutta", "Sreya Chatterjee", "Aritra Bose", "Roshni Das", "Kaushik Sen", "Nandita Roy", "Soumya Banerjee", "Mainak Ghosh", "Rupsa Dutta", "Tanmay Mukherjee", "Diya Bose", "Arnab Chatterjee", "Payel Sen", "Sourav Das", "Mitali Roy", "Debojit Banerjee", "Tuli Ghosh", "Abhishek Dutta", "Rimjhim Bose", "Rajdeep Sen", "Sohini Roy", "Ayan Mukherjee"],
  MI: ["Aarav Mehta", "Isha Shah", "Rohan Desai", "Kavya Patel", "Aditya Joshi", "Neha Kulkarni", "Siddharth Naik", "Aditi Bhosale", "Rahul More", "Mira Kamat", "Arjun Mehta", "Pooja Shah", "Vivek Desai", "Riya Patel", "Nikhil Joshi", "Ananya Kulkarni", "Omkar Naik", "Sneha Bhosale", "Yash More", "Tara Kamat", "Dhruv Mehta", "Mansi Shah", "Karan Desai", "Priya Patel", "Amit Joshi", "Rutuja Kulkarni", "Sahil Naik", "Mrunal Bhosale", "Tejas More", "Avni Kamat", "Harsh Mehta", "Diya Shah", "Manav Desai", "Ira Patel", "Rishabh Joshi", "Sayali Kulkarni", "Atharva Naik", "Tanvi Bhosale", "Samar More", "Naina Kamat", "Ved Mehta", "Shreya Shah", "Anuj Desai", "Kriti Patel", "Parth Joshi", "Madhavi Kulkarni", "Sanket Naik", "Rhea Bhosale", "Akash More", "Sonal Kamat"],
  RCB: ["Arjun Gowda", "Kavya Shetty", "Rohan Hegde", "Ananya Rao", "Kiran Kumar", "Divya Nair", "Vikram Reddy", "Meera Pai", "Aditya Bhat", "Sneha Murthy", "Rahul Gowda", "Pooja Shetty", "Sanjay Hegde", "Nisha Rao", "Varun Kumar", "Deepa Nair", "Pranav Reddy", "Asha Pai", "Manoj Bhat", "Ritu Murthy", "Darshan Gowda", "Shreya Shetty", "Nithin Hegde", "Swathi Rao", "Harish Kumar", "Lakshmi Nair", "Abhishek Reddy", "Radhika Pai", "Karthik Bhat", "Shalini Murthy", "Yash Gowda", "Pallavi Shetty", "Suraj Hegde", "Nandini Rao", "Suresh Kumar", "Keerthi Nair", "Naveen Reddy", "Anu Pai", "Girish Bhat", "Maya Murthy", "Dhanush Gowda", "Ishani Shetty", "Manoj Hegde", "Aishwarya Rao", "Rakesh Kumar", "Sahana Nair", "Ravi Reddy", "Nikita Pai", "Vijay Bhat", "Chaitra Murthy"],
  CSK: ["Arun Subramanian", "Meena Krishnan", "Karthik Iyer", "Anjali Natarajan", "Vignesh Kumar", "Divya Srinivasan", "Suresh Balaji", "Lakshmi Rajan", "Pradeep Shankar", "Kavitha Menon", "Aravind Subramanian", "Janani Krishnan", "Ramesh Iyer", "Shalini Natarajan", "Dinesh Kumar", "Revathi Srinivasan", "Mohan Balaji", "Meera Rajan", "Sathish Shankar", "Priya Menon", "Bharath Subramanian", "Nithya Krishnan", "Gokul Iyer", "Swetha Natarajan", "Surya Kumar", "Harini Srinivasan", "Vijay Balaji", "Aarthi Rajan", "Muthu Shankar", "Anu Menon", "Sanjay Subramanian", "Keerthana Krishnan", "Ravi Iyer", "Deepa Natarajan", "Prakash Kumar", "Sangeetha Srinivasan", "Kannan Balaji", "Malar Rajan", "Mani Shankar", "Vani Menon", "Ashwin Subramanian", "Gayathri Krishnan", "Vimal Iyer", "Divya Natarajan", "Hari Kumar", "Nandhini Srinivasan", "Arun Balaji", "Pavithra Rajan", "Siva Shankar", "Revathi Menon"],
  DC: ["Arjun Sharma", "Aditi Malhotra", "Rohan Kapoor", "Neha Verma", "Kunal Bhatia", "Riya Sethi", "Manav Khanna", "Ishita Suri", "Rahul Arora", "Simran Ahuja", "Aman Sharma", "Pooja Malhotra", "Varun Kapoor", "Nisha Verma", "Aditya Bhatia", "Ananya Sethi", "Siddharth Khanna", "Kritika Suri", "Vivek Arora", "Mehak Ahuja", "Yuvraj Sharma", "Sakshi Malhotra", "Harsh Kapoor", "Tanya Verma", "Ankit Bhatia", "Shreya Sethi", "Rishabh Khanna", "Aarohi Suri", "Nakul Arora", "Divya Ahuja", "Mohit Sharma", "Ritika Malhotra", "Kabir Kapoor", "Ira Verma", "Gaurav Bhatia", "Kashish Sethi", "Varun Khanna", "Mansi Suri", "Abhinav Arora", "Nandini Ahuja", "Aakash Sharma", "Prerna Malhotra", "Kartik Kapoor", "Radhika Verma", "Samar Bhatia", "Ishani Sethi", "Vikrant Khanna", "Aanya Suri", "Rajat Arora", "Sonal Ahuja"],
  SRH: ["Arjun Reddy", "Kavya Rao", "Rohan Varma", "Ananya Naidu", "Vikram Goud", "Divya Rani", "Sandeep Yadav", "Meghana Prasad", "Nikhil Raju", "Lakshmi Devi", "Aditya Reddy", "Pooja Rao", "Harish Varma", "Siri Naidu", "Kiran Goud", "Swathi Rani", "Ravi Yadav", "Keerthi Prasad", "Manoj Raju", "Anusha Devi", "Sumanth Reddy", "Nitya Rao", "Tarun Varma", "Bhavya Naidu", "Mahesh Goud", "Pallavi Rani", "Rakesh Yadav", "Akhila Prasad", "Vamsi Raju", "Sravani Devi", "Sai Reddy", "Mounika Rao", "Vishal Varma", "Lasya Naidu", "Ravi Goud", "Harika Rani", "Praveen Yadav", "Madhavi Prasad", "Karthik Raju", "Sowmya Devi", "Naveen Reddy", "Apoorva Rao", "Girish Varma", "Tejaswini Naidu", "Raghu Goud", "Niharika Rani", "Srinivas Yadav", "Bhavani Prasad", "Chandu Raju", "Uma Devi"],
  RR: ["Aarav Singh", "Diya Rathore", "Rohan Sharma", "Kavya Chauhan", "Vikram Singh", "Meera Shekhawat", "Aditya Rajput", "Isha Solanki", "Manav Gehlot", "Nisha Kachhwaha", "Arjun Singh", "Pooja Rathore", "Karan Sharma", "Ananya Chauhan", "Rahul Singh", "Riya Shekhawat", "Yash Rajput", "Simran Solanki", "Sahil Gehlot", "Aditi Kachhwaha", "Dhruv Singh", "Mansi Rathore", "Mohit Sharma", "Tanya Chauhan", "Aman Singh", "Kriti Shekhawat", "Rajat Rajput", "Neha Solanki", "Harsh Gehlot", "Pallavi Kachhwaha", "Rishabh Singh", "Sakshi Rathore", "Nakul Sharma", "Ira Chauhan", "Vivek Singh", "Shreya Shekhawat", "Kunal Rajput", "Mira Solanki", "Gaurav Gehlot", "Radhika Kachhwaha", "Yuvraj Singh", "Kashish Rathore", "Ankit Sharma", "Aarohi Chauhan", "Varun Singh", "Nandini Shekhawat", "Samar Rajput", "Roshni Solanki", "Vikas Gehlot", "Asha Kachhwaha"],
  PBKS: ["Gurpreet Singh", "Jasleen Kaur", "Harpreet Gill", "Simran Sandhu", "Amrit Bains", "Navjot Dhillon", "Maninder Sidhu", "Rajveer Brar", "Amandeep Saini", "Kiran Chahal", "Gagandeep Singh", "Mandeep Kaur", "Balraj Gill", "Preet Sandhu", "Jasbir Bains", "Sukhwinder Dhillon", "Davinder Sidhu", "Harman Brar", "Ravinder Saini", "Gurkirat Chahal", "Jagdeep Singh", "Navneet Kaur", "Karan Gill", "Taran Sandhu", "Anoop Bains", "Manpreet Dhillon", "Gurman Sidhu", "Amar Brar", "Dilpreet Saini", "Jasraj Chahal", "Sandeep Singh", "Kirandeep Kaur", "Hardeep Gill", "Sukhman Sandhu", "Balwinder Bains", "Jaskaran Dhillon", "Gursharan Sidhu", "Rupinder Brar", "Tejinder Saini", "Manraj Chahal", "Kuldeep Singh", "Amandeep Kaur", "Gurtej Gill", "Harnoor Sandhu", "Jatinder Bains", "Parminder Dhillon", "Sarabjit Sidhu", "Ranjit Brar", "Kamal Saini", "Gurleen Chahal"],
  GT: ["Aarav Patel", "Diya Shah", "Rohan Desai", "Kavya Mehta", "Dhruv Joshi", "Isha Trivedi", "Harsh Dave", "Mira Vyas", "Karan Bhatt", "Pooja Modi", "Aditya Patel", "Riya Shah", "Vivek Desai", "Ananya Mehta", "Nikhil Joshi", "Neha Trivedi", "Yash Dave", "Sonal Vyas", "Parth Bhatt", "Aditi Modi", "Meet Patel", "Kajal Shah", "Siddharth Desai", "Mansi Mehta", "Jay Joshi", "Krisha Trivedi", "Mihir Dave", "Riddhi Vyas", "Kunal Bhatt", "Rupal Modi", "Dev Patel", "Pallavi Shah", "Manan Desai", "Ira Mehta", "Hiren Joshi", "Janki Trivedi", "Raj Dave", "Nisha Vyas", "Aakash Bhatt", "Hetal Modi", "Kartik Patel", "Nandini Shah", "Chirag Desai", "Ami Mehta", "Rakesh Joshi", "Bhavika Trivedi", "Tushar Dave", "Mitali Vyas", "Sahil Bhatt", "Sonali Modi"],
  LSG: ["Aarav Singh", "Ananya Tripathi", "Rohan Verma", "Kavya Mishra", "Aditya Srivastava", "Isha Shukla", "Vivek Yadav", "Neha Tiwari", "Kunal Pandey", "Riya Awasthi", "Arjun Singh", "Pooja Tripathi", "Rahul Verma", "Diya Mishra", "Siddharth Srivastava", "Nisha Shukla", "Amit Yadav", "Meera Tiwari", "Varun Pandey", "Simran Awasthi", "Yash Singh", "Kriti Tripathi", "Mohit Verma", "Tanya Mishra", "Rishabh Srivastava", "Anjali Shukla", "Harsh Yadav", "Shreya Tiwari", "Samar Pandey", "Ira Awasthi", "Vikrant Singh", "Radhika Tripathi", "Ankit Verma", "Aarohi Mishra", "Nakul Srivastava", "Mansi Shukla", "Gaurav Yadav", "Pallavi Tiwari", "Kartik Pandey", "Nandini Awasthi", "Aman Singh", "Ritu Tripathi", "Saurabh Verma", "Poonam Mishra", "Abhishek Srivastava", "Sakshi Shukla", "Ravi Yadav", "Swati Tiwari", "Dev Pandey", "Kashish Awasthi"],
};
const fanAccountName = (teamCode: string, index: number) => {
  const clean = hashtagSafe(teamCode).toUpperCase();
  const region = TEAM_REGION[clean] ?? clean;
  // The two generated pools provide 100 club handles and 50 regional handles
  // per club, while the index keeps the result stable between renders.
  if (index % 3 === 0) return REGIONAL_NAMES[clean]?.[index % 50] ?? `${region}${regionalFanPrefixes[index % 10]}${regionalFanSuffixes[Math.floor(index / 10) % 5]}`;
  return `${clean}${fanNamePrefixes[index % 10]}${fanNameSuffixes[Math.floor(index / 10) % 10]}`;
};
const legacyCommentsEnabled = () => false;

const displayGameDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))));
};

const sortPostsChronologically = (posts: FanPost[]) => [...posts].sort((left, right) => (
  left.publishedAt.localeCompare(right.publishedAt) || left.id.localeCompare(right.id)
));

const playerRating = (player: Player) => Math.max(player.currentBatting, player.currentBowling);
const isPrimaryBatter = (player: Player) => (
  player.role === "Batsman"
  || player.role === "WK-Batsman"
  || Boolean(player.isWicketkeeper)
  || (player.role === "All-Rounder" && player.currentBatting >= player.currentBowling)
);
const isPrimaryBowler = (player: Player) => (
  player.role === "Pace Bowler"
  || player.role === "Spin Bowler"
  || (player.role === "All-Rounder" && player.currentBowling > player.currentBatting)
);
const battingAverage = (stats?: SocialPlayerStats) => stats?.matches ? stats.runs / stats.matches : 0;
const economy = (stats?: SocialPlayerStats) => stats?.oversBowled ? stats.runsConceded / stats.oversBowled : 0;
const formatAuctionPrice = (price: number) => price >= 100
  ? `₹${(price / 100).toFixed(price % 100 === 0 ? 0 : 2)} Cr`
  : `₹${price} Lakhs`;
const inningsEconomy = (runs: number, overs: number) => {
  const wholeOvers = Math.floor(overs);
  const balls = wholeOvers * 6 + Math.round((overs - wholeOvers) * 10);
  return balls > 0 ? runs / balls * 6 : 0;
};
const isCloseFixture = (fixture: SocialFixture) => {
  if (!fixture.scoreA || !fixture.scoreB || !fixture.winner) return false;
  if (fixture.winner === fixture.teamB) return fixture.scoreB.overs >= 19;
  return Math.abs(fixture.scoreA.runs - fixture.scoreB.runs) <= 15;
};

const TEAM_COLOUR_NAMES: Record<string, string> = {
  MI: "blue and gold", CSK: "yellow", KKR: "purple and gold", RCB: "red and black", DC: "red and blue",
  SRH: "orange and black", PBKS: "red and silver", RR: "pink and blue", GT: "navy and gold", LSG: "blue and orange",
};

function positionSuitability(player: Player, lineup: string[]) {
  const lineupIndex = lineup.indexOf(player.id);
  // Players outside the selected XI do not have a batting position. Treating
  // index -1 as the opener was causing lower-order squad players to be used in
  // opening/powerplay comments.
  if (lineupIndex < 0) return { positionName: "squad role", isSuitable: true, reason: "is not in the selected batting XI" };
  const slot = lineupIndex;
  if (slot <= 1) return { positionName: "Opening", isSuitable: Boolean(player.isOpener), reason: player.isOpener ? "is a recognised opener" : "is normally a middle-order batter" };
  if (slot === 2) return { positionName: "#3", isSuitable: Boolean(player.hasBattedAt3), reason: player.hasBattedAt3 ? "has experience at number three" : "has rarely batted at number three" };
  if (slot === 3) return { positionName: "#4", isSuitable: Boolean(player.hasBattedAt4), reason: player.hasBattedAt4 ? "is comfortable at number four" : "is being used outside a familiar role" };
  if (slot === 4) return { positionName: "#5", isSuitable: Boolean(player.hasBattedAt5), reason: player.hasBattedAt5 ? "has experience at number five" : "has limited experience in that position" };
  if (slot <= 6) return { positionName: `#${slot + 1}`, isSuitable: Boolean(player.isFinisher || player.hasBattedAt6 || player.hasBattedAt7), reason: player.isFinisher ? "is a recognised finisher" : "is being asked to finish without a proven history there" };
  return { positionName: `#${slot + 1}`, isSuitable: true, reason: "has a conventional lower-order role" };
}

function derivePhase(teamId: string, fixtures: SocialFixture[], currentDate: string): { phase: SeasonPhase; label: string; recent?: SocialFixture } {
  const teamFixtures = fixtures.filter((fixture) => fixture.teamA === teamId || fixture.teamB === teamId);
  const played = teamFixtures.filter((fixture) => fixture.played).sort((a, b) => a.matchNumber - b.matchNumber);
  const regularPlayed = played.filter((fixture) => !fixture.stage).length;
  const recent = played.at(-1);
  const month = Number(currentDate.slice(5, 7));
  const hasFutureMatch = teamFixtures.some((fixture) => !fixture.played);
  const champion = played.some((fixture) => fixture.stage === "final" && fixture.winner === teamId);
  const eliminatedInPlayoff = Boolean(
    recent?.stage
    && recent.winner
    && recent.winner !== teamId
    && ["eliminator", "qualifier2", "final"].includes(recent.stage),
  );
  let phase: SeasonPhase;
  if (regularPlayed === 0) phase = month <= 1 || month >= 11 ? "post_auction" : "pre_season";
  else if (eliminatedInPlayoff) phase = "knocked_out";
  else if (regularPlayed <= 4) phase = "early_season";
  else if (regularPlayed <= 10) phase = "mid_season";
  else if (regularPlayed < 14) phase = "late_season";
  else if (hasFutureMatch || champion) phase = "playoffs";
  else phase = month >= 6 ? "next_season" : "knocked_out";
  const lastThree = played.slice(-3).map((fixture) => fixture.winner === teamId ? "W" : "L").join("–");
  return {
    phase,
    recent,
    label: recent ? `After Match ${recent.matchNumber}${lastThree ? ` · ${lastThree}` : ""}` : phase === "post_auction" ? "Post-auction reaction" : "Pre-season discussion",
  };
}

function buildFeed(props: SocialMediaPageProps, activePlatform: SocialPlatform): { posts: FanPost[]; phase: SeasonPhase; label: string } {
  const { team, players, playerStats, battingFirstXI, bowlingFirstXI, fixtures } = props;
  const squad = team.squad.map((id) => players[id]).filter((player): player is Player => Boolean(player));
  const fallback = [...squad].sort((a, b) => playerRating(b) - playerRating(a));
  const selectedIds = new Set([...battingFirstXI, ...bowlingFirstXI]);
  const selected = squad.filter((player) => selectedIds.has(player.id));
  const bench = squad.filter((player) => !selectedIds.has(player.id)).sort((a, b) => playerRating(b) - playerRating(a));
  const batters = squad.filter((player) => player.currentBatting >= 68).sort((a, b) => battingAverage(playerStats[b.id]) - battingAverage(playerStats[a.id]));
  const bowlers = squad.filter((player) => player.currentBowling >= 68).sort((a, b) => (playerStats[b.id]?.wickets ?? 0) - (playerStats[a.id]?.wickets ?? 0));
  const underperformers = [...selected].filter((player) => (playerStats[player.id]?.matches ?? 0) >= 2).sort((a, b) => {
    const form = (player: Player) => player.currentBatting >= player.currentBowling
      ? battingAverage(playerStats[player.id])
      : (playerStats[player.id]?.wickets ?? 0) * 12 - economy(playerStats[player.id]);
    return form(a) - form(b);
  });
  const keepers = selected.filter((player) => player.isWicketkeeper || player.role === "WK-Batsman");
  const keeper = keepers[0] ?? squad.find((player) => player.isWicketkeeper || player.role === "WK-Batsman");
  const captain = (props.captainId ? players[props.captainId] : undefined) ?? selected.find((player) => (player.captaincy ?? 0) >= 80);
  const impactPlayers = props.impactPlayerIds.map((id) => id ? players[id] : undefined).filter((player): player is Player => Boolean(player));
  const youngsters = squad.filter((player) => player.age <= 23);
  const veterans = squad.filter((player) => player.age >= 33);
  const openers = squad.filter((player) => player.isOpener || player.onlyOpensOrBenched);
  const finishers = squad.filter((player) => player.isFinisher || player.hasBattedAt6 || player.hasBattedAt7);
  const latestPrice = (player?: Player) => player?.iplHistory.filter((entry) => entry.teamId === team.id && entry.price > 0)
    .sort((a, b) => Number(b.season) - Number(a.season))[0]?.price;
  const pricedPlayers = squad.filter((player) => latestPrice(player) !== undefined).sort((a, b) => (latestPrice(b) ?? 0) - (latestPrice(a) ?? 0));
  const orangeCapCandidates = squad.filter((player) => player.currentBatting >= 80 && (
    player.isOpener || player.onlyOpensOrBenched || player.hasBattedAt3 || player.role === "Batsman" || player.role === "WK-Batsman"
  )).sort((a, b) => b.currentBatting - a.currentBatting || (b.reputation ?? 0) - (a.reputation ?? 0));
  const breakoutCandidates = squad.filter((player) => (
    player.age <= 25 && playerRating(player) >= 74 && playerRating(player) <= 84 && player.iplStats.matches <= 25
  )).sort((a, b) => playerRating(b) - playerRating(a));
  const iplDebutants = selected.filter((player) => player.iplStats.matches === 0);
  const phaseContext = derivePhase(team.id, fixtures, props.currentDate);
  const playedTeamFixtures = fixtures.filter((fixture) => fixture.played && (fixture.teamA === team.id || fixture.teamB === team.id));
  const recent = phaseContext.recent;
  const closeRecentMatch = Boolean(recent && isCloseFixture(recent));
  const seasonBattingScores: Record<string, number[]> = {};
  const seasonBowlingWickets: Record<string, string[]> = {};
  playedTeamFixtures.forEach((fixture) => {
    if (!fixture.scorecard) return;
    const isTeamA = fixture.teamA === team.id;
    const battingInnings = isTeamA ? fixture.scorecard.inningsA : fixture.scorecard.inningsB;
    const bowlingInnings = isTeamA ? fixture.scorecard.inningsB : fixture.scorecard.inningsA;
    battingInnings.batting.forEach((entry) => {
      if (!entry.id || (entry.balls ?? 0) <= 0) return;
      (seasonBattingScores[entry.id] ??= []).push(entry.runs ?? 0);
    });
    bowlingInnings.bowling.forEach((entry) => {
      if (!entry.id || (entry.balls ?? 0) <= 0) return;
      (seasonBowlingWickets[entry.id] ??= []).push(`${entry.wickets ?? 0}/${entry.runsConceded ?? 0}`);
    });
  });
  const teamResults = playedTeamFixtures
    .slice()
    .sort((a, b) => a.matchNumber - b.matchNumber)
    .map((fixture) => fixture.winner === team.id ? "W" : fixture.winner ? "L" : null)
    .filter((result): result is "W" | "L" => Boolean(result));
  const teamWins = teamResults.filter((result) => result === "W").length;
  const teamLosses = teamResults.filter((result) => result === "L").length;
  const lastTeamResult = teamResults.at(-1);
  const currentResultStreak = (() => {
    if (!lastTeamResult) return 0;
    let count = 0;
    for (let index = teamResults.length - 1; index >= 0 && teamResults[index] === lastTeamResult; index -= 1) count += 1;
    return count;
  })();
  const winsInLast = (count: number) => teamResults.slice(-count).filter((result) => result === "W").length;
  const supportsTeamFormComment = (text: string) => {
    const lower = text.toLowerCase();
    if (!teamResults.length) return false;
    // Standings/qualification claims need the actual table, which is not part
    // of this feed's context. Suppress them rather than guessing from form.
    if (/\b(top 4|top four|top 2|top two|top of the table|bottom half|playoff qualification|playoff chances|qualified|qualify|playoffs?)\b/.test(lower)) return false;
    if (/\b(nrr|net run rate|away game|away win|home game|home win)\b/.test(lower)) return false;
    const record = lower.match(/\b(\d+)\s*[-/]\s*(\d+)\b/);
    if (record) {
      const wins = Number(record[1]);
      const losses = Number(record[2]);
      if (lower.includes("win") && lower.includes("out of")) return winsInLast(losses || wins) === wins && teamResults.length >= (losses || wins);
      if (lower.includes("start") || lower.includes("record")) return teamWins === wins && teamLosses === losses;
      if (lower.includes("2 points") || lower.includes("points")) return lastTeamResult === "W";
    }
    const streak = lower.match(/\b(\d+)\s*(?:[- ]match\s*)?(?:consecutive\s+)?(winning|wins?|losing|losses?)\s*(?:run|streak|in a row)?\b/);
    if (streak) {
      const count = Number(streak[1]);
      const wantsWin = streak[2].startsWith("win");
      return currentResultStreak >= count && (wantsWin ? lastTeamResult === "W" : lastTeamResult === "L");
    }
    if (/\b(unbeaten|undefeated)\b/.test(lower)) return teamLosses === 0;
    if (/\b(loss|lost|defeat|defeated|heartbroken|regroup|recalibrate|rebuild|reset)\b/.test(lower)
      && /\b(today|match|game|result|loss|defeat|lost|tough|season is over)\b/.test(lower)) return lastTeamResult === "L";
    if (/\b(win|victory|winning|won|dominant display|dominant win|2 points|momentum)\b/.test(lower)
      && !/\b(loss|lost|defeat|without)\b/.test(lower)) return lastTeamResult === "W";
    return true;
  };
  const supportsResultTone = (text: string, topic: SocialPostTopic) => {
    if (topic !== "team_form" || !lastTeamResult) return true;
    const lower = text.toLowerCase();
    const negative = /\b(loss|lost|defeat|defeated|poor|slump|struggl|painful|failed|failure|mistake|concern|rebuild|reset|disappoint|bottom|eliminat|under pressure)\b/.test(lower);
    const positive = /\b(win|wins|victory|winning|won|great|perfect|dominant|momentum|unbeaten|undefeated|champion|firing|confidence|masterclass|massive|excellent|top)\b/.test(lower);
    if (lastTeamResult === "W" && negative && !positive) return false;
    if (lastTeamResult === "L" && positive && !negative) return false;
    return true;
  };
  const supportsMatchResultClaim = (text: string, topic: SocialPostTopic) => {
    if (!["individual_match", "clutch"].includes(topic) || !lastTeamResult) return true;
    const lower = text.toLowerCase();
    const claimsWin = /\b(win|wins|winning|won|victory|victorious|winning score|seal(?:ed)? the win|title contenders)\b/.test(lower);
    const claimsLoss = /\b(loss|lost|losing|defeat|defeated|losing cause|fell short|couldn't get over the line|rough spell|poor outing)\b/.test(lower);
    // Individual brilliance is allowed in defeat, but a post cannot claim the
    // team won or lost when the fixture result says otherwise.
    if (claimsWin && lastTeamResult !== "W" && !/\bindividual|losing cause\b/.test(lower)) return false;
    if (claimsLoss && lastTeamResult !== "L" && !/\bindividual|losing cause\b/.test(lower)) return false;
    return true;
  };
  const recentMatchStats: Record<string, SocialPlayerStats> = {};
  if (recent?.scorecard) {
    const userBatting = recent.teamA === team.id ? recent.scorecard.inningsA.batting : recent.scorecard.inningsB.batting;
    const userBowling = recent.teamA === team.id ? recent.scorecard.inningsB.bowling : recent.scorecard.inningsA.bowling;
    userBatting.forEach((entry) => {
      if (!entry.id || (entry.balls ?? 0) <= 0) return;
      recentMatchStats[entry.id] = {
        id: entry.id, runs: entry.runs ?? 0, balls: entry.balls ?? 0,
        wickets: 0, runsConceded: 0, oversBowled: 0, matches: 1,
        dismissal: entry.dismissal,
        fours: entry.fours ?? 0, sixes: entry.sixes ?? 0,
      };
    });
    userBowling.forEach((entry) => {
      if (!entry.id || (entry.overs ?? 0) <= 0) return;
      const current = recentMatchStats[entry.id] ?? {
        id: entry.id, runs: 0, balls: 0, wickets: 0, runsConceded: 0, oversBowled: 0, matches: 1,
      };
      recentMatchStats[entry.id] = {
        ...current,
        wickets: entry.wickets ?? 0,
        runsConceded: entry.runsConceded ?? 0,
        oversBowled: entry.overs ?? 0,
      };
    });
  }
  const recentPerformers = Object.keys(recentMatchStats)
    .map((id) => players[id])
    .filter((player): player is Player => Boolean(player))
    .sort((left, right) => {
      const leftStats = recentMatchStats[left.id];
      const rightStats = recentMatchStats[right.id];
      const impact = (stats: SocialPlayerStats) => stats.runs + stats.wickets * 22 - economy(stats) * (stats.oversBowled > 0 ? 1 : 0);
      return impact(rightStats) - impact(leftStats);
    });

  // Legacy event/opinion comments are intentionally disabled. All active
  // reactions must come from the structured catalogue below.
  if (legacyCommentsEnabled() && ["early_season", "mid_season", "late_season", "playoffs", "knocked_out"].includes(phaseContext.phase) && recent?.scorecard) {
    const userWon = recent.winner === team.id;
    const opponentId = recent.teamA === team.id ? recent.teamB : recent.teamA;
    const userScore = recent.teamA === team.id ? recent.scoreA : recent.scoreB;
    const opponentScore = recent.teamA === team.id ? recent.scoreB : recent.scoreA;
    const userBatting = recent.teamA === team.id ? recent.scorecard.inningsA.batting : recent.scorecard.inningsB.batting;
    const userBowling = recent.teamA === team.id ? recent.scorecard.inningsB.bowling : recent.scorecard.inningsA.bowling;
    const opponentBatting = recent.teamA === team.id ? recent.scorecard.inningsB.batting : recent.scorecard.inningsA.batting;
    const opponentBowling = recent.teamA === team.id ? recent.scorecard.inningsA.bowling : recent.scorecard.inningsB.bowling;
    const currentParticipantIds = new Set<string>([
      ...userBatting.map((entry) => entry.id),
      ...userBowling.map((entry) => entry.id),
    ].filter((id): id is string => Boolean(id)));
    const participantsFor = (fixture: SocialFixture): Set<string> => {
      if (!fixture.scorecard) return new Set<string>();
      const batting = fixture.teamA === team.id ? fixture.scorecard.inningsA.batting : fixture.scorecard.inningsB.batting;
      const bowling = fixture.teamA === team.id ? fixture.scorecard.inningsB.bowling : fixture.scorecard.inningsA.bowling;
      return new Set<string>([...batting, ...bowling].map((entry) => entry.id).filter((id): id is string => Boolean(id)));
    };
    const previousFixture = playedTeamFixtures
      .filter((fixture) => fixture.matchNumber < recent.matchNumber && fixture.scorecard)
      .sort((a, b) => b.matchNumber - a.matchNumber)[0];
    const previousParticipantIds = previousFixture ? participantsFor(previousFixture) : new Set<string>();
    const priorSeasonParticipantIds = new Set<string>(
      playedTeamFixtures
        .filter((fixture) => fixture.matchNumber < recent.matchNumber && fixture.scorecard)
        .flatMap((fixture) => Array.from(participantsFor(fixture))),
    );
    const battingPerformances = userBatting.filter((entry) => (
      (entry.balls ?? 0) > 0 && Boolean(players[entry.id] && isPrimaryBatter(players[entry.id]))
    ))
      .sort((a, b) => (b.runs ?? 0) - (a.runs ?? 0));
    const bowlingPerformances = userBowling.filter((entry) => (
      (entry.overs ?? 0) > 0 && Boolean(players[entry.id] && isPrimaryBowler(players[entry.id]))
    ))
      .sort((a, b) => (b.wickets ?? 0) - (a.wickets ?? 0) || (a.runsConceded ?? 0) - (b.runsConceded ?? 0));
    const topBat = battingPerformances[0];
    const secondBat = battingPerformances[1];
    const topBowler = bowlingPerformances[0];
    const economicalBowler = [...bowlingPerformances].sort((a, b) => (
      inningsEconomy(a.runsConceded ?? 0, a.overs ?? 0) - inningsEconomy(b.runsConceded ?? 0, b.overs ?? 0)
    ))[0];
    const expensiveBowler = [...bowlingPerformances].sort((a, b) => (
      inningsEconomy(b.runsConceded ?? 0, b.overs ?? 0) - inningsEconomy(a.runsConceded ?? 0, a.overs ?? 0)
    ))[0];
    const quietBat = [...battingPerformances].filter((entry) => (
      (entry.balls ?? 0) >= 8 && Boolean(players[entry.id] && isPrimaryBatter(players[entry.id]))
    ))
      .sort((a, b) => (a.runs ?? 0) - (b.runs ?? 0))[0];
    const seasonBat = [...squad].filter((player) => (playerStats[player.id]?.balls ?? 0) > 0)
      .sort((a, b) => (playerStats[b.id]?.runs ?? 0) - (playerStats[a.id]?.runs ?? 0))[0];
    const seasonBowler = [...squad].filter((player) => (playerStats[player.id]?.oversBowled ?? 0) > 0)
      .sort((a, b) => (playerStats[b.id]?.wickets ?? 0) - (playerStats[a.id]?.wickets ?? 0))[0];
    const wins = playedTeamFixtures.filter((fixture) => fixture.winner === team.id).length;
    const losses = playedTeamFixtures.filter((fixture) => Boolean(fixture.winner) && fixture.winner !== team.id).length;
    const reactions: Array<{ text: string; topic: SocialPostTopic; publishedAt?: string }> = [];
    const add = (text: string, topic: SocialPostTopic = "individual_match", publishedAt?: string) => reactions.push({ text, topic, publishedAt });
    add(`${userWon ? "That is a valuable win" : "That defeat hurts"} against ${opponentId}. ${team.shortName} now have ${wins} win${wins === 1 ? "" : "s"} and ${losses} loss${losses === 1 ? "" : "es"}.`, "team_form");
    if (userScore && opponentScore) add(`${team.shortName} made ${userScore.runs}/${userScore.wickets}, while ${opponentId} finished on ${opponentScore.runs}/${opponentScore.wickets}. The result reflects what actually happened, not pre-season expectations.`);
    if (topBat && (topBat.runs ?? 0) >= 25) {
      const name = players[topBat.id]?.name ?? "Our leading batter";
      const sr = (topBat.balls ?? 0) > 0 ? ((topBat.runs ?? 0) / (topBat.balls ?? 1) * 100).toFixed(1) : "0.0";
      add(`${name}'s ${topBat.runs ?? 0} from ${topBat.balls ?? 0} balls at a strike rate of ${sr} was ${userWon ? "a major part of the win" : "one of the few positives in the defeat"}.`);
    }
    if (secondBat && (secondBat.runs ?? 0) >= 30) add(`${players[secondBat.id]?.name ?? "Another batter"} also contributed ${secondBat.runs} from ${secondBat.balls} balls. That support mattered alongside the leading score.`);
    if (topBowler && (topBowler.wickets ?? 0) >= 2) add(`${players[topBowler.id]?.name ?? "Our leading bowler"} led the attack with ${topBowler.wickets}/${topBowler.runsConceded}. That is the bowling performance supporters should be discussing.`);
    if (economicalBowler && (economicalBowler.overs ?? 0) >= 3 && inningsEconomy(economicalBowler.runsConceded ?? 0, economicalBowler.overs ?? 0) <= 7.5) {
      const econ = inningsEconomy(economicalBowler.runsConceded ?? 0, economicalBowler.overs ?? 0).toFixed(1);
      add(`${players[economicalBowler.id]?.name ?? "The most economical bowler"} conceded ${economicalBowler.runsConceded} in ${economicalBowler.overs} overs—an economy of ${econ}. That spell gave the attack control.`);
    }
    if (expensiveBowler && (expensiveBowler.overs ?? 0) >= 2 && inningsEconomy(expensiveBowler.runsConceded ?? 0, expensiveBowler.overs ?? 0) >= 11) add(`${players[expensiveBowler.id]?.name ?? "One bowler"} went for ${expensiveBowler.runsConceded} in ${expensiveBowler.overs} overs. The role and matchups need reviewing before the next game.`);
    if (quietBat && (quietBat.runs ?? 0) <= 15) add(`${players[quietBat.id]?.name ?? "One batter"} managed ${quietBat.runs} from ${quietBat.balls} balls. It is fair for supporters to expect a stronger contribution next time.`);
    if (seasonBat) {
      const stats = playerStats[seasonBat.id];
      add(`${seasonBat.name} currently leads ${team.shortName}'s season scoring with ${stats.runs} runs from ${stats.matches} match${stats.matches === 1 ? "" : "es"}.`, "team_form");
    }
    if (seasonBowler) {
      const stats = playerStats[seasonBowler.id];
      add(`${seasonBowler.name} is the team's leading wicket-taker so far with ${stats.wickets} wicket${stats.wickets === 1 ? "" : "s"}.`, "team_form");
    }
    if (isCloseFixture(recent)) add(`That match went deep enough for small moments to decide it. ${team.shortName} and ${opponentId} were still under pressure at the end.`, "clutch");
    if (phaseContext.phase === "knocked_out") {
      const stageName = recent.stage === "eliminator"
        ? "the Eliminator"
        : recent.stage === "qualifier2"
          ? "Qualifier 2"
          : recent.stage === "final"
            ? "the Final"
            : "the league phase";
      const scoreDetail = userScore && opponentScore
        ? ` We made ${userScore.runs}/${userScore.wickets} and ${opponentId} made ${opponentScore.runs}/${opponentScore.wickets}.`
        : "";
      const eliminationLead = recent.stage
        ? `${team.shortName} have been knocked out by ${opponentId} in ${stageName}.`
        : `${team.shortName} have been eliminated at the end of the league phase after today's match against ${opponentId}.`;
      add(
        `${eliminationLead}${scoreDetail} That is the result ending our season today.`,
        "team_form",
        recent.date ?? props.currentDate,
      );
      add(`${team.shortName}'s season is over after ${wins} win${wins === 1 ? "" : "s"} and ${losses} loss${losses === 1 ? "" : "es"}. Any review now has to be based on the players who actually appeared this season.`, "team_form", recent.date ?? props.currentDate);
    }

    // An ex-player reaction requires all three facts: the player previously
    // represented this club, played for today's opponent, and did something
    // notable in this actual match.
    const opponentBattingById = new Map(opponentBatting.map((entry) => [entry.id, entry]));
    const opponentBowlingById = new Map(opponentBowling.map((entry) => [entry.id, entry]));
    const opponentParticipantIds = new Set<string>([
      ...opponentBatting.map((entry) => entry.id),
      ...opponentBowling.map((entry) => entry.id),
    ].filter((id): id is string => Boolean(id)));
    Array.from(opponentParticipantIds).forEach((playerId) => {
      const formerPlayer = players[playerId];
      if (!formerPlayer || formerPlayer.currentTeamId !== opponentId) return;
      const previouslyRepresentedClub = formerPlayer.iplHistory.some((entry) => (
        entry.teamId === team.id && entry.teamId !== formerPlayer.currentTeamId
      ));
      if (!previouslyRepresentedClub) return;
      const batting = opponentBattingById.get(playerId);
      const bowling = opponentBowlingById.get(playerId);
      if ((batting?.runs ?? 0) >= 40) {
        add(`${formerPlayer.name}, a former ${team.shortName} player, actually scored ${batting?.runs ?? 0} from ${batting?.balls ?? 0} balls against us today. That is the kind of ex-player performance supporters are entitled to discuss.`, "ex_player");
      } else if ((bowling?.wickets ?? 0) >= 2) {
        add(`${formerPlayer.name}, who previously represented ${team.shortName}, actually took ${bowling?.wickets ?? 0}/${bowling?.runsConceded ?? 0} against us today. This one genuinely was an ex-player influencing the match.`, "ex_player");
      }
    });
    if (playedTeamFixtures.length <= 4) {
      add(`${playedTeamFixtures.length} match${playedTeamFixtures.length === 1 ? "" : "es"} is still a small sample, so selection debates should use the evidence without pretending the season is already settled.`, "team_form");
    }

    const opinionSeed = recent.matchNumber * 31 + (userWon ? 11 : 5);
    const addOpinions = (trigger: SocialOpinionTrigger, player: Player | undefined, alternative: Player | undefined, count = 2) => {
      if (!player && trigger !== "selection_patience" && trigger !== "promote_bench") return;
      const available = SOCIAL_OPINION_TEMPLATES.filter((template) => template.trigger === trigger);
      for (let offset = 0; offset < Math.min(count, available.length); offset += 1) {
        const template = available[(opinionSeed + offset * 7 + (player?.id.length ?? 0)) % available.length];
        add(
          template.text
            .replaceAll("{player}", player?.name ?? "this player")
            .replaceAll("{alternative}", alternative?.name ?? "a bench option"),
          trigger.includes("bowler") || trigger === "match_bowling" ? "individual_match" : "team_form",
        );
      }
    };
    // Ordinary form comments must concern somebody who actually played in the
    // latest match. Selection changes receive their own explicit reactions.
    const seasonBatters = squad.filter((player) => (
      currentParticipantIds.has(player.id)
      && isPrimaryBatter(player)
      && (playerStats[player.id]?.balls ?? 0) > 0
    ));
    const seasonBowlers = squad.filter((player) => (
      currentParticipantIds.has(player.id)
      && isPrimaryBowler(player)
      && (playerStats[player.id]?.oversBowled ?? 0) > 0
    ));
    const poorBatters = seasonBatters.filter((player) => {
      const stats = playerStats[player.id];
      const average = stats.runs / Math.max(1, stats.matches);
      const strikeRate = stats.runs / Math.max(1, stats.balls) * 100;
      return stats.matches >= 2 && (average < 22 || (stats.balls >= 30 && strikeRate < 115));
    }).sort((a, b) => battingAverage(playerStats[a.id]) - battingAverage(playerStats[b.id]));
    const poorBowlers = seasonBowlers.filter((player) => {
      const stats = playerStats[player.id];
      return stats.oversBowled >= 6 && economy(stats) > 10.5 && stats.wickets < Math.max(2, stats.matches);
    }).sort((a, b) => economy(playerStats[b.id]) - economy(playerStats[a.id]));
    const strongBatters = seasonBatters.filter((player) => {
      const stats = playerStats[player.id];
      return stats.runs >= 80 && (battingAverage(stats) >= 35 || stats.runs / Math.max(1, stats.balls) * 100 >= 145);
    }).sort((a, b) => (playerStats[b.id]?.runs ?? 0) - (playerStats[a.id]?.runs ?? 0));
    const strongBowlers = seasonBowlers.filter((player) => {
      const stats = playerStats[player.id];
      return stats.wickets >= 3 && economy(stats) <= 9;
    }).sort((a, b) => (playerStats[b.id]?.wickets ?? 0) - (playerStats[a.id]?.wickets ?? 0));

    // Auction value is assessed only after a meaningful, phase-sensitive
    // sample and every claim prints the statistics that triggered it.
    const minimumPriceSample = phaseContext.phase === "early_season" ? 2
      : phaseContext.phase === "mid_season" ? 4
        : 6;
    const priceReactions: Array<{ player: Player; price: number; text: string }> = [];
    pricedPlayers.forEach((player) => {
      const price = latestPrice(player);
      const stats = playerStats[player.id];
      if (price === undefined || !stats || stats.matches < minimumPriceSample) return;
      if (isPrimaryBatter(player) && stats.balls >= minimumPriceSample * 10) {
        const average = stats.runs / Math.max(1, stats.matches);
        const strikeRate = stats.runs / Math.max(1, stats.balls) * 100;
        const strong = average >= 35 && strikeRate >= 135;
        const poor = average < 22 || strikeRate < 115;
        if (price >= 800 && strong) {
          priceReactions.push({ player, price, text: `${player.name} cost ${formatAuctionPrice(price)}, but ${stats.runs} runs at ${average.toFixed(1)} per match and a ${strikeRate.toFixed(1)} strike rate is backing up that investment.` });
        } else if (price >= 800 && poor) {
          priceReactions.push({ player, price, text: `${formatAuctionPrice(price)} created major expectations for ${player.name}. After ${stats.matches} matches, ${stats.runs} runs at ${average.toFixed(1)} per match and a ${strikeRate.toFixed(1)} strike rate is not enough for that price.` });
        } else if (price <= 300 && strong) {
          priceReactions.push({ player, price, text: `${player.name} is outperforming a ${formatAuctionPrice(price)} fee: ${stats.runs} runs at ${average.toFixed(1)} per match with a ${strikeRate.toFixed(1)} strike rate looks like genuine auction value.` });
        }
      } else if (isPrimaryBowler(player) && stats.oversBowled >= minimumPriceSample * 2) {
        const bowlingEconomy = economy(stats);
        const wicketsPerMatch = stats.wickets / Math.max(1, stats.matches);
        const strong = wicketsPerMatch >= 1 && bowlingEconomy <= 8.5;
        const poor = wicketsPerMatch < 0.5 || bowlingEconomy >= 10;
        if (price >= 800 && strong) {
          priceReactions.push({ player, price, text: `${player.name}'s ${formatAuctionPrice(price)} fee is being justified by ${stats.wickets} wickets in ${stats.matches} matches at an economy of ${bowlingEconomy.toFixed(1)}.` });
        } else if (price >= 800 && poor) {
          priceReactions.push({ player, price, text: `${player.name} cost ${formatAuctionPrice(price)}, so ${stats.wickets} wickets in ${stats.matches} matches at an economy of ${bowlingEconomy.toFixed(1)} is a fair reason for supporters to expect more.` });
        } else if (price <= 300 && strong) {
          priceReactions.push({ player, price, text: `${stats.wickets} wickets at an economy of ${bowlingEconomy.toFixed(1)} makes ${player.name} outstanding value at ${formatAuctionPrice(price)}.` });
        }
      }
    });
    pricedPlayers.forEach((player) => {
      const price = latestPrice(player);
      if (price === undefined || priceReactions.some((reaction) => reaction.player.id === player.id)) return;
      const batting = userBatting.find((entry) => entry.id === player.id);
      const bowling = userBowling.find((entry) => entry.id === player.id);
      if (isPrimaryBatter(player) && batting && (batting.balls ?? 0) > 0) {
        const runs = batting.runs ?? 0;
        const balls = batting.balls ?? 0;
        const strikeRate = runs / Math.max(1, balls) * 100;
        const exceptional = runs >= 80 || (runs >= 65 && strikeRate >= 145);
        const disastrous = runs <= 10 && balls >= 8;
        if (price >= 800 && exceptional) {
          priceReactions.push({ player, price, text: `${player.name} looked worth the ${formatAuctionPrice(price)} fee today: ${runs} from ${balls} at a ${strikeRate.toFixed(1)} strike rate is a premium performance.` });
        } else if (price >= 800 && disastrous) {
          priceReactions.push({ player, price, text: `${player.name}'s ${formatAuctionPrice(price)} fee brings scrutiny after ${runs} from ${balls} today. One innings does not define the signing, but that performance was well below premium expectations.` });
        } else if (price <= 300 && exceptional) {
          priceReactions.push({ player, price, text: `${runs} from ${balls} makes ${player.name}'s ${formatAuctionPrice(price)} price look exceptional value after today's match.` });
        }
      } else if (isPrimaryBowler(player) && bowling && (bowling.overs ?? 0) > 0) {
        const wicketsTaken = bowling.wickets ?? 0;
        const oversBowled = bowling.overs ?? 0;
        const spellEconomy = inningsEconomy(bowling.runsConceded ?? 0, oversBowled);
        const exceptional = wicketsTaken >= 3 && spellEconomy <= 8.5;
        const disastrous = oversBowled >= 3 && wicketsTaken === 0 && spellEconomy >= 11.5;
        if (price >= 800 && exceptional) {
          priceReactions.push({ player, price, text: `${player.name} delivered a premium spell for a premium ${formatAuctionPrice(price)} fee: ${wicketsTaken}/${bowling.runsConceded} at ${spellEconomy.toFixed(1)} economy.` });
        } else if (price >= 800 && disastrous) {
          priceReactions.push({ player, price, text: `${formatAuctionPrice(price)} means ${player.name}'s ${wicketsTaken}/${bowling.runsConceded} from ${oversBowled} overs will be criticised. That was far below the expected impact.` });
        } else if (price <= 300 && exceptional) {
          priceReactions.push({ player, price, text: `${player.name}'s ${wicketsTaken}/${bowling.runsConceded} makes a ${formatAuctionPrice(price)} fee look like outstanding value today.` });
        }
      }
    });
    priceReactions
      .sort((left, right) => right.price - left.price || left.player.name.localeCompare(right.player.name))
      .slice(0, 3)
      .forEach((reaction) => add(reaction.text, "price_tag", recent.date ?? props.currentDate));
    const bestBenchAlternative = (player?: Player) => bench
      .filter((candidate) => player ? (
        player.currentBatting >= player.currentBowling
          ? candidate.currentBatting >= 68
          : candidate.currentBowling >= 68
      ) : true)
      .sort((a, b) => playerRating(b) - playerRating(a))[0];
    poorBatters.slice(0, 2).forEach((player) => {
      const alternative = bestBenchAlternative(player);
      addOpinions("drop_batter", player, alternative, playerRating(player) >= 82 ? 1 : 3);
      if (playerRating(player) >= 80 || (player.reputation ?? 0) >= 8) addOpinions("back_batter", player, alternative, 2);
      if (alternative) addOpinions("promote_bench", player, alternative, 1);
    });
    poorBowlers.slice(0, 2).forEach((player) => {
      const alternative = bestBenchAlternative(player);
      addOpinions("drop_bowler", player, alternative, playerRating(player) >= 82 ? 1 : 3);
      if (playerRating(player) >= 80 || (player.reputation ?? 0) >= 8) addOpinions("back_bowler", player, alternative, 2);
      if (alternative) addOpinions("promote_bench", player, alternative, 1);
    });
    strongBatters.slice(0, 2).forEach((player) => addOpinions("praise_batter", player, undefined, 2));
    strongBowlers.slice(0, 2).forEach((player) => addOpinions("praise_bowler", player, undefined, 2));
    if (topBat && (topBat.runs ?? 0) >= 40 && players[topBat.id] && isPrimaryBatter(players[topBat.id])) {
      addOpinions("match_batting", players[topBat.id], undefined, 2);
    }
    if (topBowler && (topBowler.wickets ?? 0) >= 2 && players[topBowler.id] && isPrimaryBowler(players[topBowler.id])) {
      addOpinions("match_bowling", players[topBowler.id], undefined, 2);
    }

    const droppedPlayers = Array.from(previousParticipantIds)
      .filter((id) => !currentParticipantIds.has(id))
      .map((id) => players[id])
      .filter((player): player is Player => Boolean(player));
    droppedPlayers.forEach((player) => {
      const stats = playerStats[player.id];
      if (!stats || stats.matches < 2) return;
      const poorBattingRun = isPrimaryBatter(player) && (
        stats.runs / Math.max(1, stats.matches) < 22
        || (stats.balls >= 30 && stats.runs / Math.max(1, stats.balls) * 100 < 115)
      );
      const poorBowlingRun = isPrimaryBowler(player)
        && stats.oversBowled >= 6
        && economy(stats) > 10.5
        && stats.wickets < Math.max(2, stats.matches);
      if (poorBattingRun) {
        add(`${player.name} has finally been left out after that poor run with the bat. It is a big selection call, but the recent returns made a change understandable.`, "team_form");
      } else if (poorBowlingRun) {
        add(`${player.name} has been dropped after a difficult run with the ball. The attack needed a change, and now the replacement has to justify it.`, "team_form");
      }
    });

    if (previousFixture) {
      const firstSeasonAppearances = Array.from(currentParticipantIds)
        .filter((id) => !priorSeasonParticipantIds.has(id))
        .map((id) => players[id])
        .filter((player): player is Player => Boolean(player));
      firstSeasonAppearances.slice(0, 2).forEach((player) => {
        add(`${player.name} has come into the XI for a first appearance of the season. Fresh opportunity now—supporters will be watching how ${isPrimaryBowler(player) ? "the bowling role" : "the batting role"} is used.`, "team_form");
      });
    }
    // Build at most one club-history reaction for each distinct match. This
    // gives the feed a season-long timeline instead of three legend references
    // all prompted by today's innings.
    const chronologicalFixtures = playedTeamFixtures
      .filter((fixture) => Boolean(fixture.winner && fixture.scorecard))
      .sort((a, b) => a.matchNumber - b.matchNumber);
    chronologicalFixtures.forEach((fixture, fixtureIndex) => {
      if (!fixture.scorecard) return;
      const fixtureOpponent = fixture.teamA === team.id ? fixture.teamB : fixture.teamA;
      const fixtureScore = fixture.teamA === team.id ? fixture.scoreA : fixture.scoreB;
      const fixtureOpponentScore = fixture.teamA === team.id ? fixture.scoreB : fixture.scoreA;
      const resultWasWin = fixture.winner === team.id;
      const fixtureDate = fixture.date ?? (fixture.id === recent.id ? props.currentDate : undefined);
      if (!fixtureDate) return;
      const fixtureBatting = fixture.teamA === team.id ? fixture.scorecard.inningsA.batting : fixture.scorecard.inningsB.batting;
      const fixtureBowling = fixture.teamA === team.id ? fixture.scorecard.inningsB.bowling : fixture.scorecard.inningsA.bowling;
      const historyBat = [...fixtureBatting]
        .filter((entry) => Boolean(players[entry.id] && isPrimaryBatter(players[entry.id])))
        .sort((a, b) => (b.runs ?? 0) - (a.runs ?? 0))[0];
      const historyBowler = [...fixtureBowling]
        .filter((entry) => Boolean(players[entry.id] && isPrimaryBowler(players[entry.id])))
        .sort((a, b) => (b.wickets ?? 0) - (a.wickets ?? 0) || (a.runsConceded ?? 0) - (b.runsConceded ?? 0))[0];
      const allRoundPerformances = fixtureBatting
        .map((battingEntry) => {
          const player = players[battingEntry.id];
          const bowlingEntry = fixtureBowling.find((entry) => entry.id === battingEntry.id);
          if (!player || player.role !== "All-Rounder" || !bowlingEntry) return null;
          return { name: player.name, runs: battingEntry.runs ?? 0, wickets: bowlingEntry.wickets ?? 0 };
        })
        .filter((performance): performance is { name: string; runs: number; wickets: number } => Boolean(performance))
        .sort((a, b) => (b.runs + b.wickets * 22) - (a.runs + a.wickets * 22));
      if (fixture.id !== recent.id) {
        if (fixtureScore && fixtureOpponentScore) {
          add(
            `${resultWasWin ? "A win" : "A defeat"} against ${fixtureOpponent}: ${team.shortName} made ${fixtureScore.runs}/${fixtureScore.wickets} and ${fixtureOpponent} made ${fixtureOpponentScore.runs}/${fixtureOpponentScore.wickets}.`,
            "individual_match",
            fixtureDate,
          );
        }
        const standoutBat = [...fixtureBatting]
          .filter((entry) => (entry.runs ?? 0) >= 40 && Boolean(players[entry.id] && isPrimaryBatter(players[entry.id])))
          .sort((a, b) => (b.runs ?? 0) - (a.runs ?? 0))[0];
        const standoutBowler = [...fixtureBowling]
          .filter((entry) => (entry.wickets ?? 0) >= 2 && Boolean(players[entry.id] && isPrimaryBowler(players[entry.id])))
          .sort((a, b) => (b.wickets ?? 0) - (a.wickets ?? 0) || (a.runsConceded ?? 0) - (b.runsConceded ?? 0))[0];
        if (standoutBat) {
          add(`${players[standoutBat.id].name}'s ${standoutBat.runs} from ${standoutBat.balls} was the batting performance worth discussing against ${fixtureOpponent}.`, "individual_match", fixtureDate);
        }
        if (standoutBowler) {
          add(`${players[standoutBowler.id].name} took ${standoutBowler.wickets}/${standoutBowler.runsConceded} against ${fixtureOpponent}. That spell earned a reaction on the day it happened.`, "individual_match", fixtureDate);
        }
      }
      let streak = 0;
      for (let index = fixtureIndex; index >= 0; index -= 1) {
        if ((chronologicalFixtures[index].winner === team.id) !== resultWasWin) break;
        streak += 1;
      }
      const comments = getTriggeredTeamSocialComments(team.id, {
        won: resultWasWin,
        opponent: fixtureOpponent,
        score: fixtureScore?.runs ?? 0,
        wickets: fixtureScore?.wickets ?? 0,
        chased: fixture.teamB === team.id,
        closeMatch: isCloseFixture(fixture),
        consecutiveWins: resultWasWin ? streak : 0,
        consecutiveLosses: resultWasWin ? 0 : streak,
        stage: fixture.stage,
        battingPerformance: historyBat ? {
          name: players[historyBat.id].name,
          runs: historyBat.runs ?? 0,
          balls: historyBat.balls ?? 0,
        } : undefined,
        bowlingPerformance: historyBowler ? {
          name: players[historyBowler.id].name,
          wickets: historyBowler.wickets ?? 0,
          runsConceded: historyBowler.runsConceded ?? 0,
          overs: historyBowler.overs ?? 0,
        } : undefined,
        allRoundPerformance: allRoundPerformances[0],
        seed: fixture.matchNumber * 31 + (resultWasWin ? 11 : 5),
      });
      comments.forEach((comment) => add(comment, "team_form", fixtureDate));
    });
    return {
      phase: phaseContext.phase,
      label: phaseContext.label,
      posts: sortPostsChronologically(reactions.map((reaction, index) => ({
        id: `event_${recent.id}_${index}`,
        username: `Fan ${recent.matchNumber * 20 + index + 1}`,
        comment: reaction.text,
        topic: reaction.topic,
        tag: reaction.topic.replaceAll("_", " "),
        publishedAt: reaction.publishedAt ?? recent.date ?? props.currentDate,
      }))),
    };
  }

  const pools: Record<SocialPostTopic, Player[]> = {
    post_auction: squad, pre_season: squad, early_season: selected, mid_season: selected,
    late_season: selected, playoffs: selected, knocked_out: squad, next_season: squad,
    individual_match: recentPerformers, role_misuse: selected,
    team_form: underperformers.length ? underperformers : selected, yoy_comparison: [],
    ex_player: [], price_tag: pricedPlayers, youngsters: breakoutCandidates,
    impact_sub: impactPlayers, captaincy: captain ? [captain] : [], venue: selected,
    veteran_vs_youngster: veterans.concat(youngsters), clutch: recentPerformers, balance: selected,
  };
  const topicEligible = (topic: SocialPostTopic) => {
    if (topic === phaseContext.phase) return true;
    if (topic === "individual_match") return recentPerformers.length > 0;
    if (topic === "role_misuse" || topic === "balance") return selected.length === 11;
    if (topic === "team_form") return playedTeamFixtures.length >= 3;
    if (topic === "yoy_comparison") return false;
    // Generic ex-player templates contain claims that cannot be verified from
    // this context. Verified reactions are built from scorecards above.
    if (topic === "ex_player") return false;
    if (topic === "price_tag") return pricedPlayers.length > 0;
    if (topic === "youngsters") return breakoutCandidates.length > 0;
    if (topic === "impact_sub") return impactPlayers.length > 0;
    if (topic === "captaincy") return Boolean(captain && recent);
    if (topic === "venue") return Boolean(recent);
    if (topic === "veteran_vs_youngster") return veterans.length > 0 && youngsters.length > 0;
    if (topic === "clutch") return closeRecentMatch && recentPerformers.length > 0;
    return false;
  };
  const isTrainingComment = (text: string) => /\b(training|practice|nets?|net sessions?|practice drills?|intra-squad)\b/i.test(text);
  const referencesUnsupportedFeature = (text: string) => /\b(injur(?:y|ies|ed)|fitness test|medical replacement|concussion substitute)\b/i.test(text);
  const isUnverifiedPreSeasonClaim = (text: string) => (
    phaseContext.phase === "pre_season"
    && /\b(pre-season form|looks? (intense|sharp|fit|lethal|settled|unplayable|in unbelievable touch)|camp|fitness levels?|interviews?|media day|no injury|arrived early|acclimatized|dressing room|coaching staff|tactical meetings?|preparation has been|squad bond)\b/i.test(text)
  );
  const standingsPoints = new Map<string, number>();
  fixtures.forEach((f) => {
    if (f.played && f.winner) {
      standingsPoints.set(f.winner, (standingsPoints.get(f.winner) ?? 0) + 2);
      const loser = f.winner === f.teamA ? f.teamB : f.teamA;
      standingsPoints.set(loser, standingsPoints.get(loser) ?? 0);
    }
  });
  const sortedTeams = Array.from(standingsPoints.entries())
    .sort((a, b) => b[1] - a[1]);
  const teamRank = sortedTeams.findIndex(([teamId]) => teamId === team.id) + 1;
  const hasStandings = sortedTeams.length > 0;

  const candidates = SOCIAL_COMMENTS.filter((template) => {
    if (!template.platforms.includes(activePlatform)) return false;
    if (isTrainingComment(template.text)) return false;
    if (referencesUnsupportedFeature(template.text)) return false;
    if (isUnverifiedPreSeasonClaim(template.text)) return false;
    if (!topicEligible(template.topic)) return false;
    if (template.topic !== phaseContext.phase && !template.phases.includes(phaseContext.phase)) return false;
    
    // Strict Win/Loss validation
    const lastResult = lastTeamResult;
    const reqs = template.requirements || [];
    const isLossReq = reqs.some(r => r.includes("lost recent") || r.includes("team lost"));
    const isWinReq = reqs.some(r => r.includes("won recent") || r.includes("team won"));
    
    if (isLossReq && lastResult !== "L") return false;
    if (isWinReq && lastResult !== "W") return false;
    
    if (template.topic === "team_form") {
      if (template.tone === "critical" && lastResult !== "L") return false;
      if (["enthusiastic", "celebratory"].includes(template.tone) && lastResult !== "W") return false;
    }
    
    if (template.tag.startsWith("losing_cause_") && lastResult !== "L") return false;

    // Streaks
    const winStreakReq = reqs.some(r => r.includes("winning streak") || r.includes("win streak"));
    const lossStreakReq = reqs.some(r => r.includes("losing streak") || r.includes("loss streak"));
    if (winStreakReq && (lastResult !== "W" || currentResultStreak < 2)) return false;
    if (lossStreakReq && (lastResult !== "L" || currentResultStreak < 2)) return false;

    // Standings / Positions
    const topOfTableReq = reqs.some(r => r.includes("top of the table") || r.includes("first place"));
    const top4Req = reqs.some(r => r.includes("top 4") || r.includes("top four"));
    const top2Req = reqs.some(r => r.includes("top 2") || r.includes("top two"));
    const bottomHalfReq = reqs.some(r => r.includes("bottom half") || r.includes("lower half"));
    const qualifiedReq = reqs.some(r => r.includes("qualified") || r.includes("playoff qualification"));
    
    if (topOfTableReq && (!hasStandings || teamRank !== 1)) return false;
    if (top4Req && (!hasStandings || teamRank < 1 || teamRank > 4)) return false;
    if (top2Req && (!hasStandings || teamRank < 1 || teamRank > 2)) return false;
    if (bottomHalfReq && (!hasStandings || teamRank <= 4)) return false;
    if (qualifiedReq && (!hasStandings || teamRank > 4 || playedTeamFixtures.length < 10)) return false;

    // Strict Chase vs Defend validation
    if (recent && recent.scorecard && ["clutch", "individual_match", "team_form"].includes(template.topic)) {
      const lowerText = template.text.toLowerCase();
      const userBattedFirst = recent.scorecard.inningsA.batting.some(player => squad.some(p => p.id === player.id));
      const teamWasChasing = !userBattedFirst;
      const teamWasDefending = userBattedFirst;
      
      const claimsChase = /\b(needed \d+ off|chase|chasing|get \d+ runs off|get over the line)\b/i.test(lowerText);
      const claimsDefend = /\b(defend|defended|defending|protect|choking the chase)\b/i.test(lowerText);
      
      if (claimsChase && !teamWasChasing) return false;
      if (claimsDefend && !teamWasDefending) return false;
    }
    
    return true;
  });
  const seed = playedTeamFixtures.reduce((sum, fixture) => sum + fixture.matchNumber * 17 + (fixture.winner === team.id ? 7 : 3), team.id.length * 19);
  const rotated = candidates.length ? [...candidates.slice(seed % candidates.length), ...candidates.slice(0, seed % candidates.length)] : [];
  const pick = (pool: Player[], index: number) => pool[index % Math.max(1, pool.length)] ?? fallback[index % Math.max(1, fallback.length)];
  const output: FanPost[] = [];

  const semanticPools = (text: string, defaultPool: Player[]) => {
    const lower = text.toLowerCase();
    const isCaptainComment = /\b(captain|captaincy|leadership)\b/.test(lower);
    const isKeeperComment = /\b(keeper|wicketkeeper|glovework|stumping)\b/.test(lower);
    const isOpeningComment = /\b(opening with|open the batting|opening the batting|at the top|opening pair)\b/.test(lower);
    const isFinishingComment = /\b(finisher|finishing|finish games|death-over hitting)\b/.test(lower);
    const isBowlingComment = /\b(bowl|bowler|bowling|wicket|yorker|economy|spinner|spin attack|pacer|pace attack|death overs?|slower ball)\b/.test(lower);
    const isBattingComment = /\b(bat|batter|batting|runs?|innings|strike rate|orange cap|sixes|boundary hitter|top order|middle order)\b/.test(lower);
    const isAllRounderComment = /\b(all-round|all-rounder|all rounder|bat and ball|both departments|two-way|two-skill|all round|multi-skill)\b/.test(lower);
    const isTopOrderComment = /\b(top order|top-order|opening pair|open(?:ing)?|at the top)\b/.test(lower);
    const powerplayBattingSignal = /\b(bat|batter|batting|runs?|score|scoring|strike rate|sixes|boundary|aggression|advantage|middle order|top order)\b/.test(lower);
    const isPowerplayBattingComment = /\b(powerplay|power play)\b/.test(lower) && powerplayBattingSignal && !isBowlingComment;
    const battingLineup = battingFirstXI.length ? battingFirstXI : bowlingFirstXI;
    const topOrderBatters = battingLineup.length
      ? batters.filter((player) => { const index = battingLineup.indexOf(player.id); return index >= 0 && index <= 2; })
      : batters;
    const powerplayBatters = battingLineup.length
      ? batters.filter((player) => { const index = battingLineup.indexOf(player.id); return index >= 0 && index <= 3; })
      : batters;
    const openingBatters = battingLineup.length
      ? batters.filter((player) => { const index = battingLineup.indexOf(player.id); return index >= 0 && index <= 1; })
      : openers.length ? openers : batters;
    const middleOrderBatters = battingLineup.length
      ? batters.filter((player) => { const index = battingLineup.indexOf(player.id); return index >= 0 && index >= 2 && index <= 5; })
      : batters;
    let primary = defaultPool;
    const requiresOrangeCapCandidate = /orange cap/i.test(text);
    const requiresDebutant = /\b(make (his|their) debut|ipl debut|first ipl)\b/i.test(text);
    const requiresBreakoutCandidate = /\b(breakout player|breakout season|surprise package|star in the making)\b/i.test(text);
    if (requiresOrangeCapCandidate) primary = orangeCapCandidates;
    else if (requiresDebutant) primary = iplDebutants;
    else if (requiresBreakoutCandidate) primary = breakoutCandidates;
    else if (isCaptainComment && captain) primary = [captain];
    else if (isKeeperComment && keeper) primary = [keeper];
    else if (isOpeningComment) primary = openingBatters;
    else if (isFinishingComment) primary = finishers.length ? finishers : batters;
    else if (isBowlingComment) primary = bowlers;
    else if (isTopOrderComment) primary = topOrderBatters;
    else if (/ middle[- ]order /.test(lower)) primary = middleOrderBatters;
    else if (isPowerplayBattingComment) primary = powerplayBatters;
    else if (isAllRounderComment) {
      const allRounders = squad.filter(player => player.role === "All-Rounder");
      primary = allRounders.length ? allRounders : squad;
    }
    else if (isBattingComment) primary = batters;

    let secondary = primary;
    if (isTopOrderComment) secondary = topOrderBatters;
    else if (/ middle[- ]order /.test(lower)) secondary = middleOrderBatters;
    else if (isPowerplayBattingComment) secondary = powerplayBatters;
    if (/\b(young|youngster|uncapped)\s+\{b\}/i.test(text)) secondary = youngsters;
    else if (/\b(senior|veteran)\s+\{b\}/i.test(text)) secondary = veterans;
    else if (/\{b\}[^.]{0,45}\b(bowl|bowling|wicket|yorker)/i.test(text)) secondary = bowlers;
    else if (/\{b\}[^.]{0,45}\b(bat|runs?|score|hit|anchor|floater|opening)/i.test(text)) secondary = batters;
    // Youth/veteran comparison comments often describe both players. Select
    // the second subject from the group explicitly referenced by the prose,
    // rather than falling back to the whole squad.
    if (/\b(young|youth|youngster|uncapped|prospect)\b[^.]{0,55}\{b\}/i.test(text)) secondary = youngsters;
    else if (/\b(veteran|senior|legend|experience|experienced)\b[^.]{0,55}\{b\}/i.test(text)) secondary = veterans;
    const requiresSpecialCandidate = requiresOrangeCapCandidate || requiresDebutant || requiresBreakoutCandidate;
    return {
      primary: primary.length ? primary : requiresSpecialCandidate ? [] : defaultPool,
      secondary: secondary.length ? secondary : defaultPool,
    };
  };

  for (let index = 0; index < rotated.length && output.length < (recent ? 24 : 18); index += 1) {
    let template = rotated[index];
    const pool = pools[template.topic];
    const rolePools = semanticPools(template.text, pool.length ? pool : fallback);
    let primaryPool = rolePools.primary;
    if ('eligible' in template) {
      const rule = (template as any).eligible;
      const filtered = primaryPool.filter(p => {
        if (typeof rule === "function") return rule(p);
        if (typeof rule === "string") return matchesEligibility(p, rule);
        return true;
      });
      if (filtered.length === 0) continue;
      primaryPool = filtered;
    }
    if (template.topic === "veteran_vs_youngster" || /^pre_season_youth_/.test(template.id)) {
      rolePools.secondary = primaryPool.some((player) => player.age >= 32) ? youngsters : veterans;
    }
    let subject = template.topic === "captaincy" ? captain : pick(primaryPool, index);
    if (!subject) continue;

    const structuredTemplate = SOCIAL_COMMENTS.find((item) => item.id === template.id);
    if (structuredTemplate) {
      const currentEntry = (subject.iplHistory ?? []).find((entry) => entry.season === String(props.currentSeason) && entry.teamId === team.id && entry.price > 0);
      const previousEntry = (subject.iplHistory ?? []).find((entry) => entry.season === String(props.currentSeason - 1));
      const isNewAuctionSigning = Boolean(currentEntry && !subject.isRetained && previousEntry?.teamId !== team.id);
      const isRetention = subject.isRetained === true;
      const isRtm = Boolean(currentEntry?.isRtm);
      const isSquadAnalysis = structuredTemplate.tag === "team_squad_analysis";
      const isDeparture = structuredTemplate.tag === "team_departures";
      // Post-auction sections are mutually exclusive. This prevents a new
      // auction signing from being described as a retention or RTM player.
      if (structuredTemplate.tag === "team_retention" && !isRetention) continue;
      if (structuredTemplate.tag === "team_rtm" && !isRtm) continue;
      if (structuredTemplate.tag === "team_bargains" && !isNewAuctionSigning) continue;
      if (structuredTemplate.tag === "team_needs" && !isNewAuctionSigning) continue;
      if (isDeparture || (!isSquadAnalysis && !isRetention && !isRtm && !isNewAuctionSigning)) continue;
      if (!isSquadAnalysis && !currentEntry) continue;
      if (currentEntry && structuredTemplate.maxPrice !== undefined && currentEntry.price > structuredTemplate.maxPrice) continue;
      if (currentEntry && structuredTemplate.minPrice !== undefined && currentEntry.price < structuredTemplate.minPrice) continue;
      if (!matchesEligibility(subject, structuredTemplate.eligible)) continue;

      // Strict player-centric metadata requirements checks
      const reqs = structuredTemplate.requirements || [];
      const price = currentEntry ? currentEntry.price : 0;
      
      const priceHighReq = reqs.some(r => r.includes("price >= 1000") || r.includes("bought for price >= 1000") || r.includes("price >= 800") || r.includes("price >= 600"));
      const priceLowReq = reqs.some(r => r.includes("price <= 400") || r.includes("bought for price <= 400") || r.includes("price <= 300"));
      const youngsterReq = reqs.some(r => r.includes("youngster") || r.includes("young"));
      const veteranReq = reqs.some(r => r.includes("veteran") || r.includes("senior"));
      
      if (priceHighReq) {
        let minPriceLimit = 600;
        if (reqs.some(r => r.includes("price >= 1000"))) minPriceLimit = 1000;
        else if (reqs.some(r => r.includes("price >= 800"))) minPriceLimit = 800;
        if (price < minPriceLimit) continue;
      }
      
      if (priceLowReq) {
        let maxPriceLimit = 400;
        if (reqs.some(r => r.includes("price <= 300"))) maxPriceLimit = 300;
        if (price > maxPriceLimit || price <= 0) continue;
      }
      
      if (youngsterReq && subject.age >= 26) continue;
      if (veteranReq && subject.age < 30) continue;

      // In-season performance/stats verification for all topics
      const hasSeasonStatsPhase = ["early_season", "mid_season", "late_season", "playoffs", "knocked_out", "next_season"].includes(phaseContext.phase);
      if (hasSeasonStatsPhase && ["price_tag", "youngsters", "balance", "role_misuse", "impact_sub"].includes(template.topic)) {
        const stats = playerStats[subject.id];
        const played = (stats?.matches ?? 0) > 0;
        
        const mentionsOnField = /\b(form|performance|delivering|contribution|play|playing|on the field|spell|knock|runs|wickets|average|strike rate|economy|bargain|value|underperforming|flop|waste|bargain|star|shining|hero|dominant|impact)\b/i.test(structuredTemplate.text);
        if (mentionsOnField && !played) continue; // Must have played to make on-field claims!

        if (played && stats) {
          const isBatter = subject.currentBatting >= subject.currentBowling;
          const isPositive = structuredTemplate.tone === "positive" || structuredTemplate.tone === "hype" || structuredTemplate.tone === "optimistic";
          const isNegative = structuredTemplate.tone === "critical" || structuredTemplate.tone === "banter";

          // Verify that their last game wasn't a failure when praised for maintaining consistency/form
          const recentStats = recentMatchStats[subject.id];
          if (recentStats && recentStats.matches > 0) {
            if (isPositive) {
              const isFormComment = /\b(form|consistency|maintaining|continue|continuing|streak|rhythm|keeps? (it )?going|momentum)\b/i.test(structuredTemplate.text);
              if (isFormComment) {
                if (isBatter && (recentStats.runs ?? 0) < 29) continue;
                if (!isBatter && (recentStats.wickets ?? 0) === 0 && (recentStats.oversBowled ?? 0) > 0) continue;
              }
            }
          }
          
          if (isPositive) {
            if (isBatter) {
              const minRuns = ["early_season", "knocked_out", "next_season"].includes(phaseContext.phase) ? 30 : 75;
              if ((stats.runs ?? 0) < minRuns) continue;
            } else {
              const minWickets = ["early_season", "knocked_out", "next_season"].includes(phaseContext.phase) ? 1 : 3;
              if ((stats.wickets ?? 0) < minWickets) continue;
            }
          } else if (isNegative) {
            if (isBatter) {
              const avg = stats.runs / Math.max(1, stats.matches);
              const sr = stats.balls > 0 ? (stats.runs / stats.balls) * 100 : 0;
              if (stats.runs > 100 && avg > 30 && sr > 130) continue;
            } else {
              const econ = stats.runsConceded / Math.max(0.1, stats.oversBowled);
              if (stats.wickets >= 5 && econ < 8.0) continue;
            }
          }
        }
      }

      // Verify specific templates
      if (hasSeasonStatsPhase) {
        // Verify critical template: make sure they haven't actually won any games with 40+ runs
        if (template.id === "mid_price_x_002") {
          let matchWinningKnocks = 0;
          playedTeamFixtures.forEach((fixture) => {
            if (fixture.winner === team.id && fixture.scorecard) {
              const isTeamA = fixture.teamA === team.id;
              const batting = isTeamA ? fixture.scorecard.inningsA.batting : fixture.scorecard.inningsB.batting;
              const entry = batting.find(e => e.id === subject.id);
              if (entry && (entry.runs ?? 0) >= 40) {
                matchWinningKnocks++;
              }
            }
          });
          if (matchWinningKnocks > 0) continue;
        }

        // Verify peak mid-season fitness comment
        if (template.id === "mid_match_reddit_024") {
          const mStats = recentMatchStats[subject.id];
          if (!mStats) continue;
          const dismissalText = (mStats.dismissal ?? "").toLowerCase();
          if (dismissalText.includes("run out") || dismissalText.includes("run-out")) continue;
          const runningRuns = mStats.runs - ((mStats.fours ?? 0) * 4 + (mStats.sixes ?? 0) * 6);
          if (runningRuns < 12) continue;
        }
      }

      // Check base price claims
      if (structuredTemplate.text.toLowerCase().includes("at base price")) {
        if (currentEntry && currentEntry.price !== subject.basePrice) continue;
      }
    }
    let alternative = pick(rolePools.secondary, index + 1);
    if (alternative?.id === subject.id) alternative = pick(rolePools.secondary, index + 2);
    // Never render an unresolved or semantically impossible second subject.
    // A generic fallback name made otherwise valid-looking posts claim that a
    // random squad player was the intended comparison (especially in youth /
    // veteran posts).  Templates requiring a second name must have a real,
    // distinct player from the appropriate semantic pool.
    if (template.text.includes("{b}")) {
      if (!alternative || alternative.id === subject.id) continue;
      const secondIsYoung = /\b(young|youth|youngster|uncapped|prospect)\b[^.]{0,70}\{b\}/i.test(template.text);
      const secondIsVeteran = /\b(veteran|senior|legend|experience|experienced)\b[^.]{0,70}\{b\}/i.test(template.text);
      if (secondIsYoung && alternative.age >= 27) continue;
      if (secondIsVeteran && alternative.age < 30) continue;
      // Role-specific comparisons must not silently substitute an unrelated
      // player when the requested pool is empty.
      if (/\{b\}[^.]{0,55}\b(bowl|bowling|wicket|yorker|spinner|spin|pace|pacer)\b/i.test(template.text)
        && !(alternative.role === "Pace Bowler" || alternative.role === "Spin Bowler" || (alternative.role === "All-Rounder" && alternative.currentBowling > alternative.currentBatting))) continue;
      if (/\{b\}[^.]{0,55}\b(bat|runs?|score|hit|anchor|floater|opening)\b/i.test(template.text)
        && alternative.currentBatting < alternative.currentBowling) continue;
    }
    if (template.text.includes("{keeper}") && !keeper) continue;
    if (template.text.includes("{captain}") && !captain) continue;
    const usesMatchStats = template.topic === "individual_match" || template.topic === "clutch";
    const performanceTopic = usesMatchStats || (
      template.text.includes("{a}")
      && ["balance", "youngsters", "role_misuse", "impact_sub"].includes(template.topic)
      && /\b(bat|batter|batting|innings|runs?|strike rate|sixes|hitting|knock|scor(?:e|ing)|wicket|bowling|bowler|economy|spell|boundar(?:y|ies)|clearing|ropes)\b/i.test(template.text)
    );
    const requiresPerformanceEvidence = isPlayerPerformanceComment(template.text, template.topic, phaseContext.phase);
    const evidenceScope = performanceScope(template.topic);
    const stats = performanceTopic || requiresPerformanceEvidence
      ? (evidenceScope === "match" ? recentMatchStats[subject.id] : playerStats[subject.id])
      : playerStats[subject.id];
    if (requiresPerformanceEvidence) {
      const isBatter = subject.currentBatting >= subject.currentBowling;
      const sentiment = performanceSentiment(template.text, structuredTemplate?.tone ?? template.tone);
      if (!passesPerformanceEvidence(stats, isBatter, sentiment, evidenceScope)) continue;
    }
    if (performanceTopic && /\bthrowing away 30s|convert(?:ing)? 30s|thirties\b/i.test(template.text)) {
      const scores = seasonBattingScores[subject.id] ?? [];
      const thirties = scores.filter((score) => score >= 30 && score < 50).length;
      if (thirties < 2) continue;
    }
    if (structuredTemplate?.validatePerformance) {
      const isDummy = structuredTemplate.validatePerformance.toString().replace(/\s/g, '').includes("=>true");
      if (!isDummy) {
        if (!stats || !structuredTemplate.validatePerformance(stats)) continue;
      } else {
        if (!stats) continue;
        const tag = template.tag;
        const isBatter = subject.currentBatting >= subject.currentBowling;
        
        if (tag === "batting_form") {
          const runs = stats.runs ?? 0;
          if (runs < 29) continue;
        }
        if (tag === "bowling_form") {
          const wickets = stats.wickets ?? 0;
          const overs = stats.oversBowled ?? 0;
          const econ = overs > 0 ? stats.runsConceded / overs : 10;
          if (wickets < 2 && econ > 7.0) continue;
        }
        if (tag === "price_tag_pressure") {
          if (isBatter) {
            const avg = stats.runs / Math.max(1, stats.matches || 1);
            if (stats.runs < 80 || avg < 25) continue;
          } else {
            const econ = stats.oversBowled > 0 ? (stats.runsConceded / stats.oversBowled) : 10;
            if (stats.wickets < 4 || econ > 8.5) continue;
          }
        }
      }
    }
    if (template.tag.startsWith("losing_cause_") && stats) {
      const isBattingCause = template.tag === "losing_cause_batting";
      const isBowlingCause = template.tag === "losing_cause_bowling";
      const battingValue = stats.balls >= 15 && stats.runs >= 30;
      const bowlingValue = stats.oversBowled >= 2 && (stats.wickets >= 2 || (stats.wickets >= 1 && economy(stats) <= 7.5));
      if ((isBattingCause && !battingValue) || (isBowlingCause && !bowlingValue) || (!isBattingCause && !isBowlingCause && !(battingValue || bowlingValue))) continue;
    }
    const price = latestPrice(subject);
    if (template.text.includes("{runs}") && !stats?.runs) continue;
    if (template.text.includes("{sr}") && !stats?.balls) continue;
    if (template.text.includes("{econ}") && !stats?.oversBowled) continue;
    if (template.text.includes("{runsConceded}") && !stats?.oversBowled) continue;
    if (template.text.includes("{wickets}") && !stats?.oversBowled) continue;
    if (template.text.includes("{price}") && price === undefined) continue;
    if (["individual_match", "team_form", "clutch"].includes(template.topic) && !(stats?.matches > 0)) continue;
    const position = positionSuitability(subject, battingFirstXI.length ? battingFirstXI : bowlingFirstXI);
    if (template.topic === "role_misuse" && Boolean((template as any).isPraiseVariant) !== position.isSuitable) continue;
    const priceText = price === undefined ? "the recorded fee" : price >= 100
      ? `₹${(price / 100).toFixed(price % 100 === 0 ? 0 : 2)} Cr`
      : `₹${price} Lakhs`;

    const getStatsBracket = (): string => {
      if (!template.text.includes("{a}")) return "";
      const lowerText = template.text.toLowerCase();
      const isBatter = subject.currentBatting >= subject.currentBowling;
      const isRecentForm = /\b(form|consistency|maintaining|continue|continuing|streak|rhythm|keeps? (it )?going|momentum|slump|decline|declining|in a row|consecutive|slumping|recent|last \d+ matches|last \d+ games)\b/i.test(lowerText);
      const isClutchOrMatch = ["individual_match", "clutch"].includes(template.topic);
      const isSeason = !isClutchOrMatch && (/\b(season|year|campaign|price|auction|signing|bargain|value|mid-season|late-season)\b/i.test(lowerText) || ["price_tag", "youngsters"].includes(template.topic));

      const pStats = playerStats[subject.id];
      const rStats = recentMatchStats[subject.id];

      if (isRecentForm) {
        if (isBatter) {
          const scores = seasonBattingScores[subject.id] ?? [];
          if (scores.length > 0) {
            let matchCount = 3;
            const numMatch = lowerText.match(/\b(\d+)\s*(?:consecutive|matches|games|low|wins|losses|-match|-game)/);
            if (numMatch) matchCount = parseInt(numMatch[1]);
            const recentScores = scores.slice(-matchCount);
            return `[Recent: ${recentScores.join(", ")}]`;
          }
        } else {
          const wicketsList = seasonBowlingWickets[subject.id] ?? [];
          if (wicketsList.length > 0) {
            let matchCount = 3;
            const numMatch = lowerText.match(/\b(\d+)\s*(?:consecutive|matches|games|low|wins|losses|-match|-game)/);
            if (numMatch) matchCount = parseInt(numMatch[1]);
            const recentWickets = wicketsList.slice(-matchCount);
            return `[Recent: ${recentWickets.join(", ")}]`;
          }
        }
      } else if (isSeason) {
        if (pStats && pStats.matches > 0) {
          if (isBatter) {
            const avg = (pStats.runs / pStats.matches).toFixed(1);
            const sr = pStats.balls > 0 ? Math.round(pStats.runs / pStats.balls * 100) : 0;
            return `[Season: ${pStats.runs} runs @ ${avg} Avg, ${sr} SR]`;
          } else {
            const econ = pStats.oversBowled > 0 ? (pStats.runsConceded / pStats.oversBowled).toFixed(1) : "0.0";
            return `[Season: ${pStats.wickets} wkts @ ${econ} Econ]`;
          }
        }
      } else {
        if (rStats && rStats.matches > 0) {
          if (isBatter) {
            return `[Last match: ${rStats.runs} (${rStats.balls})]`;
          } else {
            const econ = rStats.oversBowled > 0 ? (rStats.runsConceded / rStats.oversBowled).toFixed(1) : "0.0";
            return `[Last match: ${rStats.wickets}/${rStats.runsConceded} (${econ} Econ)]`;
          }
        }
      }
      return "";
    };

    const bracket = requiresPerformanceEvidence && stats
      ? formatPerformanceFooter(stats, evidenceScope)
      : getStatsBracket();

    let comment = template.text
      .replaceAll("{a}", subject.name).replaceAll("{b}", alternative?.name ?? "another squad player")
      .replaceAll("{keeper}", keeper?.name ?? "our wicketkeeper").replaceAll("{captain}", captain?.name ?? "our captain")
      .replaceAll("{team}", team.shortName).replaceAll("{rival}", recent ? (recent.teamA === team.id ? recent.teamB : recent.teamA) : "the opposition")
      .replaceAll("{price}", priceText).replaceAll("{venue}", team.homeGround)
      .replaceAll("{colours}", TEAM_COLOUR_NAMES[team.id] ?? "the club colours")
      .replaceAll("{pos}", position.positionName).replaceAll("{reason}", position.reason)
      .replaceAll("{runs}", `${stats?.runs ?? 0}`).replaceAll("{balls}", `${stats?.balls ?? 0}`)
      .replaceAll("{sr}", stats?.balls ? `${Math.round(stats.runs / stats.balls * 100)}` : "")
      .replaceAll("{econ}", stats?.oversBowled ? economy(stats).toFixed(1) : "")
      .replaceAll("{runsConceded}", `${stats?.runsConceded ?? 0}`)
      .replaceAll("{wickets}", `${stats?.wickets ?? 0}`);

    if (bracket) {
      comment += ` ${bracket}`;
    }

    const referencedSeason = phaseContext.phase === "next_season" ? props.currentSeason + 1 : props.currentSeason;
    comment = comment.replaceAll("2026", String(referencedSeason)).replaceAll("2027", String(referencedSeason));
    if (/keeper|glovework|stumping/i.test(comment) && keeper) comment = comment.replaceAll(subject.name, keeper.name);
    // A catalogue typo must never be visible as fabricated-looking output.
    if (/\{[A-Za-z]+\}/.test(comment)) continue;

    output.push({
      id: `${template.id}_${seed}_${output.length}`,
      username: `Fan ${seed + output.length + 1}`,
      comment,
      topic: template.topic,
      tag: (() => {
        const isPlayerSpecific = ["individual_match", "clutch", "price_tag", "youngsters", "role_misuse", "balance", "impact_sub"].includes(template.topic);
        if (isPlayerSpecific && subject) {
          const nameParts = subject.name.trim().split(/\s+/);
          return hashtagSafe(nameParts[nameParts.length - 1]);
        }
        const tagPart = structuredTemplate ? toCamelCase(structuredTemplate.tag) : toCamelCase(template.topic);
        return `${hashtagSafe(team.shortName)}${tagPart}`;
      })(),
      publishedAt: recent?.date ?? props.currentDate,
    });
  }
  return { posts: sortPostsChronologically(output), phase: phaseContext.phase, label: phaseContext.label };
}

export default function SocialMediaPage(props: SocialMediaPageProps) {
  const [activePlatform, setActivePlatform] = useState<SocialPlatform>("x");
  const [selectedTrend, setSelectedTrend] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [repostedPosts, setRepostedPosts] = useState<Record<string, boolean>>({});
  const [savedPosts, setSavedPosts] = useState<Record<string, boolean>>({});
  const [votedPosts, setVotedPosts] = useState<Record<string, "up" | "down" | undefined>>({});
  const officialHandle = `${hashtagSafe(props.team.shortName)}Official`;
  const feed = buildFeed(props, activePlatform);
  const trending = useMemo(() => {
    const counts = new Map<string, number>();
    feed.posts.forEach((post) => counts.set(post.tag, (counts.get(post.tag) ?? 0) + 1));
    return Array.from(counts.entries())
      .filter((entry) => entry[1] > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [feed.posts]);
  const visiblePosts = selectedTrend ? feed.posts.filter((post) => post.tag.toLowerCase() === selectedTrend.toLowerCase()) : feed.posts;
  const togglePostState = (setter: Dispatch<SetStateAction<Record<string, boolean>>>, id: string) => setter((current) => ({ ...current, [id]: !current[id] }));
  const baseMetric = (id: string, offset: number) => 18 + ((id.length * 13 + offset) % 83);
  const switcher = <div className="sticky top-4 z-50 ml-auto flex w-fit max-w-[calc(100%-1rem)] items-center gap-1 overflow-hidden rounded-full border border-white/15 bg-black/80 p-1 shadow-2xl backdrop-blur-md">
    {(["x", "reddit", "instagram"] as const).map((platform) => <button key={platform} onClick={() => setActivePlatform(platform)} aria-label={`Open ${platform}`} className={`flex size-9 items-center justify-center rounded-full transition ${activePlatform === platform ? "bg-white text-black" : "text-white/65 hover:bg-white/15 hover:text-white"}`}><PlatformLogo platform={platform} size={17} /></button>)}
  </div>;
  const empty = <div className="border border-dashed border-white/15 p-10 text-center text-sm text-white/55">No reactions are available for this phase yet.</div>;
  const posts = visiblePosts.length ? visiblePosts.map((post, index) => {
    const fanAccount = fanAccountName(props.team.shortName, index + post.id.length);
    const instagramPost = activePlatform === "instagram" ? <article key={post.id} className="overflow-hidden border-b border-white/10 bg-black"><div className="flex items-center gap-3 px-4 py-3"><div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-xs font-bold text-white">{fanAccount[0]}</div><span className="font-semibold text-white">{fanAccount}</span><MoreHorizontal className="ml-auto text-white" size={18} /></div><div aria-label="Post image placeholder" className="flex min-h-64 flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#241329] via-[#321328] to-[#19152d] px-8 py-10 text-center"><div className="flex size-14 items-center justify-center rounded-2xl border border-white/25 bg-white/10"><Image size={28} aria-hidden="true" /></div><p className="text-sm font-semibold text-white/85">Matchday image placeholder</p><p className="text-xs text-white/55">{props.team.shortName} supporter post</p></div><div className="px-4 py-3"><div className="flex items-center gap-4 text-white"><button type="button" aria-label="Like" onClick={() => togglePostState(setLikedPosts, post.id)} className={likedPosts[post.id] ? "text-red-500" : "hover:text-red-400"}><Heart size={24} fill={likedPosts[post.id] ? "currentColor" : "none"} /></button><button type="button" aria-label="Comment"><MessageCircle size={23} /></button><button type="button" aria-label="Share" onClick={() => togglePostState(setRepostedPosts, post.id)} className={repostedPosts[post.id] ? "text-sky-400" : "hover:text-sky-300"}><Send size={22} /></button><button type="button" aria-label="Save" onClick={() => togglePostState(setSavedPosts, post.id)} className={`ml-auto ${savedPosts[post.id] ? "text-amber-300" : "hover:text-amber-200"}`}><Bookmark size={20} fill={savedPosts[post.id] ? "currentColor" : "none"} /></button></div><p className="mt-2 text-xs text-white/65">{baseMetric(post.id, 3) + (likedPosts[post.id] ? 1 : 0)} likes</p><p className="mt-2 text-sm leading-5 text-white"><span className="mr-1 font-semibold">{fanAccount}</span>{post.comment} <span className="text-pink-300">#{post.tag}</span></p><p className="mt-1 text-xs text-white/60">View all comments · {displayGameDate(post.publishedAt)}</p></div></article> : null; if (instagramPost) return instagramPost;
    if (activePlatform === "reddit") return <article key={post.id} className="flex gap-3 border-b border-white/10 bg-[#1a1a1b] px-4 py-4"><div className="flex w-8 shrink-0 flex-col items-center text-[#818384]"><button type="button" aria-label="Upvote" onClick={() => setVotedPosts((current) => ({ ...current, [post.id]: current[post.id] === "up" ? undefined : "up" }))} className={votedPosts[post.id] === "up" ? "text-[#ff4500]" : "hover:text-[#ff4500]"}>▲</button><span className="font-space-mono text-xs">{12 + post.id.length % 88 + (votedPosts[post.id] ? 1 : 0)}</span><button type="button" aria-label="Downvote" onClick={() => setVotedPosts((current) => ({ ...current, [post.id]: current[post.id] === "down" ? undefined : "down" }))} className={votedPosts[post.id] === "down" ? "text-[#7193ff]" : "hover:text-[#7193ff]"}>▼</button></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-xs text-[#818384]"><span className="font-bold text-white">u/{fanAccount}</span><span>·</span><span>{displayGameDate(post.publishedAt)}</span></div><p className="mt-2 text-[15px] text-[#d7dadc]">{post.comment}</p><div className="mt-3 flex gap-5 text-xs font-bold text-[#818384]"><button type="button" onClick={() => togglePostState(setSavedPosts, post.id)} className={savedPosts[post.id] ? "text-white" : "hover:text-white"}>🔖 Save</button><button type="button" onClick={() => togglePostState(setRepostedPosts, post.id)} className={repostedPosts[post.id] ? "text-white" : "hover:text-white"}>↗ Share</button></div></div></article>;
    if (activePlatform === "instagram") return <article key={post.id} className="overflow-hidden border-b border-white/10 bg-[#000]"><div className="flex items-center gap-3 px-4 py-3"><div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-xs font-bold text-white">{fanAccount[0]}</div><span className="font-semibold text-white">{fanAccount}</span><span className="ml-auto text-white">•••</span></div><div className="flex min-h-40 items-center bg-gradient-to-br from-[#241329] via-[#321328] to-[#19152d] px-8 py-10"><p className="text-lg font-semibold leading-7 text-white">{post.comment}</p></div><div className="px-4 py-3"><div className="flex items-center gap-4 text-2xl text-white"><button type="button" aria-label="Like" onClick={() => togglePostState(setLikedPosts, post.id)} className={likedPosts[post.id] ? "text-red-500" : "hover:text-red-400"}>♥</button><button type="button" aria-label="Share" onClick={() => togglePostState(setRepostedPosts, post.id)} className={repostedPosts[post.id] ? "text-sky-400" : "hover:text-sky-300"}>⌁</button><button type="button" aria-label="Save" onClick={() => togglePostState(setSavedPosts, post.id)} className={`ml-auto text-xl ${savedPosts[post.id] ? "text-amber-300" : "hover:text-amber-200"}`}><Bookmark size={20} fill={savedPosts[post.id] ? "currentColor" : "none"} /></button></div><p className="mt-1 text-xs text-white/65">{baseMetric(post.id, 3) + (likedPosts[post.id] ? 1 : 0)} likes</p><p className="mt-2 text-xs font-semibold text-white">{post.tag}</p><p className="mt-1 text-xs text-white/60">View all comments · {displayGameDate(post.publishedAt)}</p></div></article>;
    return <article key={post.id} className="border-b border-white/10 bg-black px-4 py-4"><div className="flex gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-black">{fanAccount[0]}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="font-bold text-white">{fanAccount}</span><span className="text-white/45">· {displayGameDate(post.publishedAt)}</span><span className="ml-auto text-white/50">•••</span></div><p className="mt-1 text-[15px] text-white/90">{post.comment} <span className="text-sky-400">#{post.tag}</span></p><div className="mt-3 flex justify-between text-xs text-white/45"><span>💬 Reply</span><button type="button" onClick={() => togglePostState(setRepostedPosts, post.id)} className={repostedPosts[post.id] ? "text-emerald-400" : "hover:text-white"}>↻ {repostedPosts[post.id] ? "Reposted" : "Repost"}</button><button type="button" onClick={() => togglePostState(setLikedPosts, post.id)} className={likedPosts[post.id] ? "text-pink-400" : "hover:text-pink-300"}>♡ {likedPosts[post.id] ? "Liked" : "Like"}</button><button type="button" onClick={() => togglePostState(setSavedPosts, post.id)} className={savedPosts[post.id] ? "text-amber-300" : "hover:text-white"}>🔖</button></div></div></div></article>;
  }) : [empty];
  const platformShell = activePlatform === "reddit" ? "bg-[#030303] text-white" : activePlatform === "instagram" ? "bg-black text-white" : "bg-black text-white";
  const sideNav = activePlatform === "x"
    ? ["Home", "Explore", "Notifications", "Messages", "Bookmarks", "Profile"]
    : activePlatform === "reddit"
      ? ["Home", "Popular", "All", "Communities", "Custom Feeds"]
      : ["Home", "Search", "Explore", "Reels", "Messages", "Profile"];
  const sideTone = activePlatform === "x"
    ? "text-white/75 hover:bg-white/10"
    : activePlatform === "reddit"
      ? "text-[#818384] hover:bg-[#272729]"
      : "text-white/75 hover:bg-white/10";
  const trendTone = activePlatform === "x" ? "text-sky-300" : activePlatform === "reddit" ? "text-[#ff6a32]" : "text-pink-300";
  const trendHeading = activePlatform === "x" ? "What’s happening" : activePlatform === "reddit" ? "Trending communities" : "Explore trends";
  const trendSubheading = activePlatform === "x" ? "Trends for you" : activePlatform === "reddit" ? "Popular in this community" : "What supporters are talking about";
  const platformFont = activePlatform === "x"
    ? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    : activePlatform === "reddit"
      ? '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif'
      : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  return <div style={{ fontFamily: platformFont }} className={`relative min-h-full overflow-y-auto ${platformShell}`}><div className="relative mx-auto min-h-full max-w-[1400px] px-3 sm:px-5">{switcher}<div className={`grid grid-cols-1 gap-5 pt-0 lg:grid-cols-[190px_minmax(0,680px)_240px] ${activePlatform === "reddit" ? "lg:gap-4" : activePlatform === "instagram" ? "lg:gap-8" : ""}`}>
    <aside className="hidden lg:block lg:pt-8"><div className="sticky top-5 space-y-1">{sideNav.map((item, index) => <button key={item} type="button" className={`flex w-full items-center gap-4 rounded-full px-4 py-3 text-left text-[15px] transition ${index === 0 ? (activePlatform === "reddit" ? "bg-[#272729] font-bold text-white" : "bg-white/10 font-bold text-white") : sideTone}`}>{navIcon(item, activePlatform)}{item}</button>)}{activePlatform === "x" && <button type="button" className="mt-4 w-full rounded-full bg-sky-500 px-4 py-3 text-sm font-bold text-white">Post</button>}{activePlatform === "reddit" && <button type="button" className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#ff4500] px-4 py-3 text-sm font-bold text-white"><PlusIcon /> Create</button>}{activePlatform === "instagram" && <button type="button" className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#f09433] via-[#dc2743] to-[#bc1888] px-4 py-3 text-sm font-bold text-white"><Camera size={17} /> Create</button>}</div></aside>
    <section className="min-w-0">
    {activePlatform === "reddit" && <header className="border-b border-white/10 bg-[#1a1a1b] px-5 py-4"><p className="text-xs text-[#818384]">Home / r/{props.team.shortName.toLowerCase()}fans</p><div className="mt-1 flex items-center gap-2"><h1 className="text-2xl font-bold">u/{officialHandle}</h1><OfficialBadge /></div><p className="mt-1 text-sm text-[#818384]">Official {props.team.shortName} squad updates and analysis</p></header>}
    {activePlatform === "x" && <header className="sticky top-0 z-10 border-b border-white/10 bg-black/85 px-5 py-4 backdrop-blur"><div className="flex items-center gap-3"><PlatformLogo platform="x" size={22} /><h1 className="text-xl font-bold">Home</h1></div><div className="mt-3 flex gap-8 text-sm font-bold"><span className="border-b-2 border-sky-400 pb-3 text-white">For you</span><span className="text-white/45">Following</span></div></header>}
    {activePlatform === "instagram" && <header className="sticky top-0 z-10 border-b border-white/10 bg-black/90 px-5 py-4 backdrop-blur"><div className="flex items-center justify-between"><h1 className="text-2xl font-semibold tracking-tight">Instagram</h1><div className="flex gap-4 text-xl">♡　✉</div></div><div className="mt-4 flex items-center gap-3"><div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] font-bold">{props.team.shortName[0]}</div><div><div className="flex items-center gap-1"><p className="font-bold">{officialHandle}</p><OfficialBadge /></div><p className="text-xs text-white/55">Official {props.team.shortName} account · {feed.posts.length} posts</p></div></div></header>}
    <main>
      {activePlatform === "x" && <div className="border-b border-white/10 bg-black px-4 py-4"><div className="flex gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white font-bold text-black">{props.team.shortName[0]}</div><div className="min-w-0 flex-1"><div className="min-h-12 rounded-xl border border-white/10 px-3 py-3 text-[15px] text-white/45">What is happening?!</div><div className="mt-3 flex items-center justify-between"><div className="flex gap-4 text-sky-400"><Image size={18} /><Video size={18} /><Smile size={18} /><CalendarDays size={18} /></div><button type="button" className="rounded-full bg-sky-500 px-5 py-2 text-sm font-bold text-white">Post</button></div></div></div></div>}
      {activePlatform === "reddit" && <div className="border-b border-[#343536] bg-[#1a1a1b] p-3"><div className="rounded-md border border-[#343536] bg-[#0f0f10] px-4 py-3 text-sm text-[#818384]">Create a post in r/{props.team.shortName.toLowerCase()}fans</div><div className="mt-2 flex gap-2"><button type="button" className="flex items-center gap-2 rounded-full border border-[#343536] px-3 py-2 text-xs font-bold text-white"><Image size={16} /> Image</button><button type="button" className="flex items-center gap-2 rounded-full border border-[#343536] px-3 py-2 text-xs font-bold text-white"><Video size={16} /> Link</button><button type="button" className="ml-auto rounded-full bg-[#ff4500] px-4 py-2 text-xs font-bold text-white">Create post</button></div></div>}
      {activePlatform === "instagram" && <div className="border-b border-white/10 bg-black px-4 py-4"><div className="mb-4 flex gap-4 overflow-hidden"><div className="flex shrink-0 flex-col items-center gap-1 text-[10px] text-white/65"><div className="flex size-16 items-center justify-center rounded-full border-2 border-pink-500 bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-xl font-bold">+</div><span>Your story</span></div><div className="flex shrink-0 flex-col items-center gap-1 text-[10px] text-white/65"><div className="flex size-16 items-center justify-center rounded-full border-2 border-pink-500 bg-white/10"><Camera size={22} /></div><span>Supporters</span></div></div><div className="flex items-center gap-3 border-t border-white/10 pt-3"><div className="flex size-9 items-center justify-center rounded-full bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] font-bold">{props.team.shortName[0]}</div><span className="flex-1 text-sm text-white/45">Share a photo or thought...</span><button type="button" className="rounded-lg bg-gradient-to-r from-[#f09433] via-[#dc2743] to-[#bc1888] px-4 py-2 text-xs font-bold">Share</button></div></div>}
      {posts}
    </main>
    </section>
    <aside className="hidden lg:block lg:pt-8"><div className={`sticky top-5 overflow-hidden rounded-2xl border ${activePlatform === "reddit" ? "border-[#343536] bg-[#1a1a1b]" : activePlatform === "instagram" ? "border-white/10 bg-[#121212]" : "border-white/10 bg-[#16181c]"}`}><div className="border-b border-white/10 px-4 py-3"><p className="text-lg font-bold">{trendHeading}</p><p className="mt-1 text-xs text-white/45">{trendSubheading}</p></div>{trending.length ? trending.map(([tag, count]) => <button key={tag} type="button" onClick={() => setSelectedTrend(selectedTrend === tag ? null : tag)} className={`block w-full border-b border-white/5 px-4 py-3 text-left transition ${selectedTrend === tag ? "bg-white/10" : "hover:bg-white/10"}`}><p className={`text-sm font-bold ${trendTone}`}>#{tag}</p><p className="mt-1 text-xs text-white/45">{count} posts on {activePlatform === "x" ? "X" : activePlatform === "reddit" ? "Reddit" : "Instagram"}</p></button>) : <p className="p-4 text-xs text-white/45">No topics trending yet.</p>}{selectedTrend && <button type="button" onClick={() => setSelectedTrend(null)} className="w-full px-4 py-3 text-left text-xs font-bold text-white/60 hover:text-white">Clear trending filter</button>}</div></aside>
  </div></div></div>;
}
