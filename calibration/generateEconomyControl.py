"""Reproducible contextual run-prevention estimates; no database writes."""
import csv, json, re, unicodedata, zipfile, datetime, collections, pathlib, pickle, math
import numpy as np
from sklearn.feature_extraction import DictVectorizer
from sklearn.linear_model import Ridge

ROOT=pathlib.Path('calibration/data/economy-control'); SOURCE=ROOT.parent/'cricsheet'
CUTOFF=datetime.date(2026,11,2)
def norm(s): return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',s).lower())
def tokens(s): return re.findall('[a-z]+',unicodedata.normalize('NFKD',s).lower())
players=json.loads((ROOT/'players-before.json').read_text())
people=list(csv.DictReader((SOURCE/'people.csv').open(encoding='utf-8')))
names=collections.defaultdict(set)
for p in people:
    names[p['identifier']].update([p['name'],p['unique_name']])
for p in csv.DictReader((SOURCE/'names.csv').open(encoding='utf-8')): names[p['identifier']].add(p['name'])

cache=ROOT/'overs-v2.pkl'
if cache.exists(): rows=pickle.loads(cache.read_bytes())
else:
    rows=[]; seen=set()
    for archive in sorted(SOURCE.glob('*_json.zip')):
        comp=archive.name.split('_male')[0]
        with zipfile.ZipFile(archive) as z:
            for filename in z.namelist():
                if not filename.endswith('.json') or filename in seen:continue
                seen.add(filename); d=json.loads(z.read(filename)); info=d['info']
                date=datetime.date.fromisoformat(str(info['dates'][0]))
                if date>CUTOFF or date<datetime.date(2021,1,1) or info.get('gender')!='male' or info.get('match_type') not in ['T20','IT20']:continue
                registry=info.get('registry',{}).get('people',{})
                for inn_index,inn in enumerate(d['innings']):
                    if inn.get('super_over'):continue
                    wk=0; score=0; legal_sofar=0; maxovers=info.get('overs',20)
                    target=inn.get('target',{}); target_runs=target.get('runs',0); limit=target.get('overs',maxovers)
                    # An injury or suspension can change the bowler mid-over.
                    # Keep contiguous segments separate so every run and legal
                    # ball is attributed to the correct person.
                    segments=[]
                    for original_over in inn['overs']:
                        for delivery in original_over['deliveries']:
                            if not segments or segments[-1]['over']!=original_over['over'] or segments[-1]['deliveries'][-1]['bowler']!=delivery['bowler']:
                                segments.append(dict(over=original_over['over'],deliveries=[]))
                            segments[-1]['deliveries'].append(delivery)
                    for over in segments:
                        deliveries=over['deliveries']; balls=0; runs=0; fours=0;sixes=0;dots=0; extras=0
                        bowler=registry.get(deliveries[0]['bowler'])
                        if not bowler:continue
                        batter=registry.get(deliveries[0]['batter'],'unknown')
                        remaining=max(1,limit*6-legal_sofar)
                        rrr=max(0,min(24,(target_runs-score)*6/remaining)) if target_runs else 0
                        start_wk=wk
                        for ball in deliveries:
                            ex=ball.get('extras',{}); legal=not(ex.get('wides') or ex.get('noballs'))
                            charged=ball['runs']['total']-ex.get('byes',0)-ex.get('legbyes',0)
                            balls+=int(legal);runs+=charged;extras+=ex.get('wides',0)+ex.get('noballs',0)
                            fours+=int(ball['runs']['batter']==4);sixes+=int(ball['runs']['batter']==6)
                            dots+=int(legal and ball['runs']['total']==0)
                            wk+=len([w for w in ball.get('wickets',[]) if w['kind']!='retired hurt'])
                            score+=ball['runs']['total'];legal_sofar+=int(legal)
                        if balls:
                            phase='pp' if over['over']<max(2,round(maxovers*.3)) else 'death' if over['over']>=limit-max(2,round(limit*.25)) else 'middle'
                            rows.append(dict(match=filename,date=date.isoformat(),year=date.year,comp=comp,venue=norm(info['venue']),bowler=bowler,batter=batter,innings=min(inn_index+1,2),over=over['over'],phase=phase,wickets=min(start_wk,9),rrr=rrr,balls=balls,runs=runs,fours=fours,sixes=sixes,dots=dots,extras=extras))
        print('parsed',archive.name,'overs',len(rows),flush=True)
    cache.write_bytes(pickle.dumps(rows))

# Penalised bowler and batter effects identify cross-competition players jointly.
# Context controls scoring environment; bowler coefficients are the control estimate.
def features(r):
    return {'environment':r['comp']+':'+str(r['year']), 'venue':r['venue'], 'phase':r['phase'],
        'over':str(r['over']), 'innings':str(r['innings']), 'wickets':str(r['wickets']//2),
        'requiredRate':r['rrr']/12, 'batter':r['batter'], 'bowler':r['bowler']}
def fit(subset,alpha,asof,include_bowler=True):
    vec=DictVectorizer(dtype=np.float64)
    X=vec.fit_transform({k:v for k,v in features(r).items() if include_bowler or k!='bowler'} for r in subset)
    # At alpha=40, bowler estimates need about 240 weighted balls to overcome the prior.
    weight=np.array([r['balls']/6*2**(-max(0,(asof-datetime.date.fromisoformat(r['date'])).days)/730) for r in subset])
    y=np.array([6*r['runs']/r['balls'] for r in subset])
    model=Ridge(alpha=alpha,solver='lsqr',tol=1e-6).fit(X,y,sample_weight=weight)
    return vec,model
training=[r for r in rows if 2022<=r['year']<=2024]
heldout=[r for r in rows if r['year']==2025]
validation=[]
for alpha in [20,40,80]:
    vec,model=fit(training,alpha,datetime.date(2024,12,31))
    X=vec.transform(features(r) for r in heldout); pred=model.predict(X)
    base_vec,base_model=fit(training,alpha,datetime.date(2024,12,31),False)
    baseline=base_model.predict(base_vec.transform(features(r) for r in heldout))
    y=np.array([6*r['runs']/r['balls'] for r in heldout]);w=np.array([r['balls'] for r in heldout])
    validation.append(dict(alpha=alpha,heldoutYear=2025,trainingOvers=len(training),testOvers=len(heldout),modelMSE=float(np.average((y-pred)**2,weights=w)),withoutBowlerMSE=float(np.average((y-baseline)**2,weights=w))))
    print('validation',validation[-1],flush=True)
alpha=min(validation,key=lambda x:x['modelMSE'])['alpha']
# A second chronological test is not used to choose regularisation.
test_train=[r for r in rows if 2023<=r['year']<=2025]
test_rows=[r for r in rows if r['year']==2026]
test_vec,test_model=fit(test_train,alpha,datetime.date(2025,12,31))
test_x=test_vec.transform(features(r) for r in test_rows)
test_pred=test_model.predict(test_x)
test_base_vec,test_base_model=fit(test_train,alpha,datetime.date(2025,12,31),False)
test_base=test_base_model.predict(test_base_vec.transform(features(r) for r in test_rows))
test_y=np.array([6*r['runs']/r['balls'] for r in test_rows]);test_w=np.array([r['balls'] for r in test_rows])
test_result=dict(year=2026,overs=len(test_rows),modelMSE=float(np.average((test_y-test_pred)**2,weights=test_w)),withoutBowlerMSE=float(np.average((test_y-test_base)**2,weights=test_w)))
print('independent test',test_result,flush=True)
recent=[r for r in rows if r['year']>=2024]
vec,model=fit(recent,alpha,CUTOFF)
coef={name.split('=',1)[1]:float(model.coef_[i]) for name,i in vec.vocabulary_.items() if name.startswith('bowler=')}
stats=collections.defaultdict(lambda:dict(balls=0,runs=0,weightedBalls=0,fours=0,sixes=0,dots=0,extras=0,seasons=set(),competitions=set(),iplBalls=0))
for r in recent:
    s=stats[r['bowler']]
    for k in ['balls','runs','fours','sixes','dots','extras']:s[k]+=r[k]
    s['weightedBalls']+=r['balls']*2**(-(CUTOFF-datetime.date.fromisoformat(r['date'])).days/730)
    s['seasons'].add(r['year']);s['competitions'].add(r['comp']);s['iplBalls']+=r['balls'] if r['comp']=='ipl' else 0

aliases={'Varun Chakravarthy':'CV Varun','Khaleel Ahmed':'KK Ahmed','Rashid Khan':'Rashid Khan', 'Mohd. Arshad Khan':'Arshad Khan','Gurnoor Singh Brar':'Gurnoor Brar','Manimaran Siddharth':'M Siddharth','Allah Ghazanfar':'AM Ghazanfar','Prasidh Krishna':'M Prasidh Krishna','Sai Sudharsan':'B Sai Sudharsan','Yarra Prithvi Raj':'Y Prithvi Raj','Nitish Kumar Reddy':'K Nitish Kumar Reddy'}
# Rashid's identifier disambiguates people with the same full name.
overrides={'Rashid Khan':'5f547c8b','Finn Allen':'bf74b130','Sarfaraz Khan':'f088b960',
 'Rohit Sharma':'740742ef','Suryakumar Yadav':'271f83cd','Steve Smith':'30a45b23',
 'Jamie Smith':'c834c290','Prashant Solanki':'c695b423','Smaran Ravichandran':'c1e53c3f',
 'Kamindu Mendis':'08548b13','Kuldip Yadav':'030f3089','Gus Atkinson':'add6bd03',
 'Callum Vidler':'4332744d','Mohd. Arshad Khan':'12314277','Abdul Samad':'8e514b4c',
 'Mohsin Khan':'c33d8116'}
unresolved={'Mangesh Yadav'}  # Never substitute Mayank Yadav based on initials.
reviewed_file=ROOT/'reviewed-identities.json'
if reviewed_file.exists():overrides.update(json.loads(reviewed_file.read_text()))
ix=collections.defaultdict(set)
for pid,variants in names.items():
    for name in variants:ix[norm(name)].add(pid)
result=[]; ambiguous=[]
for p in players:
    name=p['name']; lookup=aliases.get(name,name); candidate=ix[norm(lookup)];method='exact/register-alias'
    if name in overrides:candidate={overrides[name]};method='explicit-identity'
    if len(candidate)!=1 and name not in overrides:
        ts=tokens(lookup);last=ts[-1];initial=ts[0][0]
        candidate={pid for pid,variants in names.items() if any((lambda t:len(t)>=2 and t[-1]==last and t[0][0]==initial)(tokens(n)) for n in variants)}
        # Restrict initials matching to people observed in the downloaded men's T20 data.
        active={r['bowler'] for r in recent} | {r['batter'] for r in recent}
        candidate &=active; method='unique-initial-surname-in-men-T20'
        # Subsequent runs require initial-only matches to have been reviewed.
        if reviewed_file.exists():candidate=set()
    pid=next(iter(candidate)) if len(candidate)==1 and name not in unresolved else None
    if len(candidate)>1:ambiguous.append(dict(name=name,candidates=[dict(id=i,names=sorted(names[i])) for i in sorted(candidate)]))
    s=stats.get(pid,{})
    ability=float(p.get('current_bowling') or 30)
    # Missing data is an explicit gameplay prior, never a claimed measured skill.
    prior=max(15,min(80,70+(ability-82)*.65))
    measured=pid in coef and bool(s.get('balls'))
    rating=max(1,min(99,round(70-18*coef[pid]))) if measured else round(prior)
    confidence='high' if s.get('weightedBalls',0)>=600 and s.get('iplBalls',0)>=180 else 'medium' if s.get('weightedBalls',0)>=240 else 'low' if measured else 'provisional'
    result.append(dict(id=p['id'],name=name,team=p.get('team') or 'Free agent',rating=rating,confidence=confidence,source='contextual-T20-model' if measured else 'ability-based-prior',cricsheetId=pid,identityMethod=method if pid else 'unresolved',balls=s.get('balls',0),weightedBalls=round(s.get('weightedBalls',0),1),iplBalls=s.get('iplBalls',0),economy=round(s['runs']*6/s['balls'],3) if measured else None,adjustedEconomyEffect=round(coef[pid],4) if measured else None,seasons=sorted(s.get('seasons',[])),competitions=sorted(s.get('competitions',[]))))
assert len(result)==len(players) and len(set(p['id'] for p in result))==len(players)
assert all(1<=p['rating']<=99 for p in result)
identities=[p['cricsheetId'] for p in result if p['cricsheetId']]
assert len(identities)==len(set(identities)), 'Two database players mapped to one person'
output=dict(version=1,cutoff=CUTOFF.isoformat(),scale='70 - 18 * penalised bowler runs-per-over effect; bounded 1..99',alpha=alpha,validation=validation,test=test_result,overs=len(recent),players=result,ambiguous=ambiguous)
(ROOT/'ratings.json').write_text(json.dumps(output,indent=2))
with (ROOT/'ratings.csv').open('w',newline='',encoding='utf-8-sig') as f:
    writer=csv.DictWriter(f,fieldnames=list(result[0]));writer.writeheader();writer.writerows(result)
print(json.dumps(dict(players=len(result),confidence=dict(collections.Counter(r['confidence'] for r in result)),unmatched=[r['name'] for r in result if not r['cricsheetId']],ambiguous=len(ambiguous)),indent=2))
