import csv
import json
import re

TEAM_MAP = {
    "Kolkata Knight Riders": "KKR",
    "Mumbai Indians": "MI",
    "Royal Challengers Bengaluru": "RCB",
    "Gujarat Titans": "GT",
    "Rajasthan Royals": "RR",
    "Lucknow Super Giants": "LSG",
    "Sunrisers Hyderabad": "SRH",
    "Punjab Kings": "PBKS",
    "Chennai Super Kings": "CSK",
    "Delhi Capitals": "DC",
}

ROLE_MAP = {
    "Batter": "Batsman",
    "Bowler (Pace)": "Pace Bowler",
    "Bowler (Spinner)": "Spin Bowler",
    "All-Rounder": "All-Rounder",
    "Wicketkeeper-Batter": "WK-Batsman",
}

def clean_id(name):
    s = name.lower().strip()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')

def parse_2025_info(col_val):
    col_val = col_val.strip()
    if not col_val or col_val.startswith("Unsold"):
        match = re.search(r'\(([\d.]+)\s*Cr\)', col_val)
        price_cr = float(match.group(1)) if match else 0.0
        return "UNSOLD", int(round(price_cr * 100))
    
    match = re.search(r'^([A-Z]+)\s*\(([\d.]+)\s*Cr\)', col_val)
    if match:
        return match.group(1), int(round(float(match.group(2)) * 100))
    
    return "UNSOLD", 0

def calc_star_rating(curr_bat, curr_bowl):
    max_rating = max(curr_bat, curr_bowl)
    if max_rating >= 90:
        return 5
    elif max_rating >= 85:
        return 4.5
    elif max_rating >= 80:
        return 4
    elif max_rating >= 75:
        return 3.5
    elif max_rating >= 70:
        return 3
    elif max_rating >= 60:
        return 2.5
    elif max_rating >= 50:
        return 2
    else:
        return 1.5

def calc_potential_label(curr_bat, curr_bowl, pot_bat, pot_bowl, age):
    max_curr = max(curr_bat, curr_bowl)
    max_pot = max(pot_bat, pot_bowl)
    if max_pot >= max_curr + 5:
        if age <= 23:
            return "Wonderkid"
        else:
            return "Promising"
    elif max_curr >= 85:
        return "World Class"
    else:
        return "Established"

def calc_phase1_base_price(curr_bat, curr_bowl, is_capped, overseas_status):
    max_rating = max(curr_bat, curr_bowl)
    is_overseas = overseas_status == "Overseas"
    
    if not is_capped:
        if is_overseas:
            return 50
        if max_rating < 66:
            return 30
        elif max_rating <= 70:
            return 40
        else:
            return 50
    else:
        if max_rating >= 85:
            base = 200
        elif max_rating >= 80:
            base = 150
        elif max_rating >= 75:
            base = 100
        elif max_rating >= 70:
            base = 75
        else:
            base = 50
            
        if is_overseas and max_rating >= 76:
            base = max(base, 150)
            
        return base

players = []

with open("database2.csv", "r", encoding="utf-8") as f:
    reader = csv.reader(f)
    header = next(reader)
    
    for row in reader:
        if not row or not any(row):
            continue
        
        team_raw = row[0].strip()
        player_name = row[1].strip()
        if not player_name:
            continue
        
        team_2025_raw = row[2].strip()
        nationality_raw = row[3].strip()
        age = int(row[4].strip()) if row[4].strip().isdigit() else 25
        salary_2026_cr = float(row[5].strip()) if row[5].strip() else 0.20
        overseas_status = row[6].strip()
        status_capped = row[7].strip()
        primary_role_raw = row[8].strip()
        bowling_type = row[9].strip()
        bowling_hand = row[10].strip()
        batting_hand_raw = row[11].strip()
        curr_bat = int(float(row[12].strip())) if row[12].strip() else 0
        pot_bat = int(float(row[13].strip())) if row[13].strip() else 0
        curr_bowl = int(float(row[14].strip())) if row[14].strip() else 0
        pot_bowl = int(float(row[15].strip())) if row[15].strip() else 0
        reputation = int(float(row[16].strip())) if row[16].strip() else 5
        can_keep = row[17].strip().lower() == "yes"
        part_time_keep = row[18].strip().lower() == "yes"
        is_opener = row[19].strip().lower() == "yes"
        is_finisher = row[20].strip().lower() == "yes"
        captaincy = int(round(float(row[21].strip()))) if row[21].strip() else 50
        bat_aggression = int(round(float(row[22].strip()))) if row[22].strip() else 50
        
        pid = clean_id(player_name)
        nationality = "Overseas" if overseas_status == "Overseas" else "Indian"
        role = ROLE_MAP.get(primary_role_raw, "Batsman")
        batting_style = "Left-hand" if "lhb" in batting_hand_raw.lower() or "left" in batting_hand_raw.lower() else "Right-hand"
        
        if bowling_type == "NA" or not bowling_type:
            bowling_style = None
        else:
            hand_prefix = "Left-arm" if "left" in bowling_hand.lower() else "Right-arm"
            bowling_style = f"{hand_prefix} {bowling_type}"
            
        is_capped = status_capped.lower() == "capped"
        base_price_lakhs = calc_phase1_base_price(curr_bat, curr_bowl, is_capped, overseas_status)
            
        current_team_id = TEAM_MAP.get(team_raw, None)
        
        # 2025 info
        team_2025, price_2025 = parse_2025_info(team_2025_raw)
        
        ipl_history = []
        if team_2025:
            ipl_history.append({
                "teamId": team_2025,
                "season": "2025",
                "price": price_2025
            })
        if current_team_id:
            ipl_history.append({
                "teamId": current_team_id,
                "season": "2026",
                "price": int(round(salary_2026_cr * 100)) if salary_2026_cr > 0 else base_price_lakhs
            })

        star_rating = calc_star_rating(curr_bat, curr_bowl)
        potential = calc_potential_label(curr_bat, curr_bowl, pot_bat, pot_bowl, age)
        
        bat_matches = int(round(curr_bat * 1.2)) if curr_bat > 30 else 0
        bat_runs = int(round(bat_matches * (curr_bat * 0.45))) if bat_matches > 0 else 0
        bowl_matches = int(round(curr_bowl * 0.9)) if curr_bowl > 30 else 0
        bowl_wkts = int(round(bowl_matches * (curr_bowl * 0.025))) if bowl_matches > 0 else 0

        player_obj = {
            "id": pid,
            "name": player_name,
            "age": age,
            "nationality": nationality,
            "role": role,
            "battingStyle": batting_style,
            "bowlingStyle": bowling_style,
            "starRating": star_rating,
            "basePrice": base_price_lakhs,
            "isCapped": is_capped,
            "isRetained": False,
            "retainedByTeamId": None,
            "currentTeamId": None,
            "potential": potential,
            "currentBatting": curr_bat,
            "potentialBatting": pot_bat,
            "currentBowling": curr_bowl,
            "potentialBowling": pot_bowl,
            "reputation": reputation,
            "captaincy": captaincy,
            "battingAggression": bat_aggression,
            "isWicketkeeper": can_keep,
            "isPartTimeWk": part_time_keep,
            "isOpener": is_opener,
            "isFinisher": is_finisher,
            "attributes": {
                "technique": min(20, max(5, int(curr_bat / 5))),
                "power": min(20, max(5, int(bat_aggression / 5))),
                "timing": min(20, max(5, int(curr_bat / 5))),
                "placement": min(20, max(5, int(curr_bat / 5))),
                "running": 11,
                "pace": min(20, max(5, int(curr_bowl / 5))) if curr_bowl > 0 else 7,
                "swing": min(20, max(5, int(curr_bowl / 5))) if curr_bowl > 0 else 7,
                "seam": min(20, max(5, int(curr_bowl / 5))) if curr_bowl > 0 else 7,
                "spin": min(20, max(5, int(curr_bowl / 5))) if curr_bowl > 0 else 7,
                "flight": min(20, max(5, int(curr_bowl / 5))) if curr_bowl > 0 else 7,
                "accuracy": min(20, max(5, int(curr_bowl / 5))) if curr_bowl > 0 else 8,
                "variation": min(20, max(5, int(curr_bowl / 5))) if curr_bowl > 0 else 7,
                "catching": 13,
                "throwing": 12,
                "agility": 13,
                "composure": min(20, max(5, int(reputation * 2))),
                "leadership": min(20, max(5, int(captaincy / 5))),
                "determination": 13,
            },
            "careerStats": {
                "batting": {
                    "matches": bat_matches,
                    "innings": max(0, bat_matches - 5),
                    "runs": bat_runs,
                    "average": round(curr_bat * 0.45, 1) if curr_bat > 0 else 0,
                    "strikeRate": round(110 + bat_aggression * 0.5, 1) if curr_bat > 0 else 0,
                    "fifties": max(0, int(bat_runs / 350)),
                    "hundreds": max(0, int(bat_runs / 1200)),
                },
                "bowling": {
                    "matches": bowl_matches,
                    "wickets": bowl_wkts,
                    "economy": round(10.5 - (curr_bowl * 0.04), 2) if curr_bowl > 0 else 0,
                    "average": round(40 - (curr_bowl * 0.2), 2) if curr_bowl > 0 else 0,
                    "bestFigures": "4/19" if bowl_wkts > 30 else "2/24",
                }
            },
            "iplHistory": ipl_history
        }
        players.append(player_obj)

print(f"Parsed {len(players)} players with Phase 1 Base Prices.")

ts_content = '''import { Player } from "@/lib/types";

export const PLAYERS: Player[] = ''' + json.dumps(players, indent=2) + ';\n\nexport const PLAYERS_SEED: Player[] = PLAYERS;\n'

with open("lib/data/players.ts", "w", encoding="utf-8") as f:
    f.write(ts_content)

print("Successfully updated lib/data/players.ts")
