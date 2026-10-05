from pathlib import Path
import json, hashlib, sys
ROOT=Path(__file__).resolve().parent
rom_path=Path(sys.argv[1]) if len(sys.argv)>1 else (ROOT/'ff7_v22_base.nes' if (ROOT/'ff7_v22_base.nes').exists() else ROOT.parent/'ff7_v22_base.nes')
ROM=rom_path.read_bytes()
assert len(ROM)==2097168, 'Ce générateur est spécifique à la v22.'
word=lambda p:int.from_bytes(ROM[p:p+2],'little')
configs=[(0x30010, p, c, cat) for p,c,cat in [
(0x30029,80,'Système et personnages'),(0x30341,56,'Accessoires'),(0x30588,129,'Armures'),(0x30ac8,106,'Casques'),(0x30f20,59,'Boucliers'),(0x31185,101,'Armes'),(0x315d6,8,'Éléments'),(0x31622,64,'Sorts'),(0x318f5,32,'Objets'),(0x31a40,32,'Descriptions des objets'),(0x31cf8,100,'Personnages et ennemis')]]
for base,ps in [(0x38010,[0x38019]),(0x50010,[0x50019]),(0x58010,[0x58019,0x5b766,0x5fc26]),(0x60010,[0x60017]),(0x68010,[0x68019,0x6bfe9]),(0x78010,[0x79011,0x7c7df])]:
 for p in ps:
  n=(base+word(p)-0x8000-p)//2
  configs.append((base,p,n,'Dialogues'))
entries={}; refs=set();tables=[];skipped=[]
for base,p,n,cat in configs:
 ptrs=[base+word(p+i*2)-0x8000 for i in range(n)];refs.update(x for x in ptrs if base<=x<base+0x8000)
 tables.append({'base':base,'offset':p,'count':n,'category':cat})
 for i,off in enumerate(ptrs):
  if not base<=off<base+0x8000:skipped.append({'table':p,'index':i,'reason':'Pointeur hors du bloc'});continue
  end=None
  for e in range(off,min(off+2048,base+0x8000)):
   if ROM[e] in (10,13):end=e;break
  if end is None or end==off or any(x<32 or x==255 for x in ROM[off:end]):
   skipped.append({'table':p,'index':i,'reason':'Données non textuelles ou terminaison non reconnue'});continue
  key=f'T{off:06X}'
  entry=entries.setdefault(key,{'id':key,'offset':off,'end':end,'category':cat,'kind':'text','block':f'{base:06X}/{p:06X}','references':[]})
  entry['references'].append({'table':p,'index':i})
for e in entries.values():
 codes=[]; raw=ROM[e['offset']:e['end']]; i=0
 while i<len(raw):
  v=raw[i]
  if v==64 and i==0 and len(raw)>1: codes.append('{P:'+format(raw[i+1],'02X')+'}'); i+=2; continue
  if v>=123 or v==64: codes.append('{'+format(v,'02X')+'}')
  i+=1
 e['protectedCodes']=codes
 overlap=[x for x in refs if e['offset']<x<e['end']]
 e['locked']=bool(overlap)
 if overlap:e['reason']='Ce texte partage des octets avec une autre entrée.'
# These graphic offsets and formats were established by the v19–v22 patches.
small={
'A':['0110','1001','1001','1111','1001','1001','1001'],'B':['1110','1001','1001','1110','1001','1001','1110'],
'C':['0111','1000','1000','1000','1000','1000','0111'],'D':['1110','1001','1001','1001','1001','1001','1110'],
'E':['1111','1000','1000','1110','1000','1000','1111'],'F':['1111','1000','1000','1110','1000','1000','1000'],
'G':['0111','1000','1000','1011','1001','1001','0111'],'H':['1001','1001','1001','1111','1001','1001','1001'],
'I':['111','010','010','010','010','010','111'],'J':['0011','0001','0001','0001','1001','1001','0110'],
'K':['1001','1010','1100','1000','1100','1010','1001'],'L':['1000','1000','1000','1000','1000','1000','1111'],
'M':['10001','11011','10101','10101','10001','10001','10001'],'N':['1001','1101','1101','1011','1011','1001','1001'],
'O':['0110','1001','1001','1001','1001','1001','0110'],'P':['1110','1001','1001','1110','1000','1000','1000'],
'Q':['0110','1001','1001','1001','1011','1001','0111'],'R':['1110','1001','1001','1110','1010','1001','1001'],
'S':['0111','1000','1000','0110','0001','0001','1110'],'T':['1111','0010','0010','0010','0010','0010','0010'],
'U':['1001','1001','1001','1001','1001','1001','0110'],'V':['1001','1001','1001','1001','1001','0110','0110'],
'W':['10001','10001','10001','10101','10101','11011','10001'],'X':['1001','1001','0110','0110','0110','1001','1001'],
'Y':['1001','1001','0110','0010','0010','0010','0010'],'Z':['1111','0001','0010','0110','0100','1000','1111'],
'-':['000','000','000','111','000','000','000'],'.':['0','0','0','0','0','1','1'],
'0':['0110','1001','1011','1101','1001','1001','0110'],'1':['010','110','010','010','010','010','111'],
'2':['0110','1001','0001','0010','0100','1000','1111'],'3':['1110','0001','0001','0110','0001','0001','1110'],
'4':['0010','0110','1010','1010','1111','0010','0010'],'5':['1111','1000','1000','1110','0001','0001','1110'],
'6':['0111','1000','1000','1110','1001','1001','0110'],'7':['1111','0001','0010','0010','0100','0100','0100'],
'8':['0110','1001','1001','0110','1001','1001','0110'],'9':['0110','1001','1001','0111','0001','0001','1110']}
graphics=[]
def gr(id,text,offsets,width,style='blue',font='small',order=None):
 g={'id':'G'+id,'kind':'graphic','category':'Menus graphiques','label':id,'defaultText':text,'offsets':offsets,'width':width,'style':style,'font':font,'order':order or list(range(width//8)),'locked':False,'offset':min(offsets),'block':'Graphismes'}
 g['baseBytes']=[list(ROM[a:a+(8 if style=='mono' else 16)]) for a in offsets];graphics.append(g)
for name,text,a in zip(['etat','objets','magie','equip','equipe','sauver'],['ETAT','OBJETS','MAGIE','EQUIP','EQUIPE','SAUVER'],[0x28117,0x28227,0x282a7,0x28327,0x283a7,0x28427]):gr(name,text,[a+i*16 for i in range(4)],32)
for name,text,a,width,style in [('inventaire','OBJETS',0x29e07,32,'blue'),('cles','CLES',0x29e47,24,'blue'),('sauvegarde','SAUVEGARDE',0xcd3d,64,'white'),('force','FOR',0x289d7,24,'blue'),('esprit','ESP',0x28b87,24,'blue')]:gr(name,text,[a+i*16 for i in range(width//8)],width,style)
for k,text in enumerate(['COMBAT','MAGIE','OBJETS','FUIR']):gr('combat'+str(k),text,[0x4bf70+k*64+i*8 for i in range(4)],32,'mono','small',[0,2,1,3])
gr('nouveau','Nouveau jeu',[0xa75d+i*16 for i in [0x51,0x52,0x53,0x54,0x55,0x56,0x57,0x74,0x7f,0x80]],80,'white','rom')
gr('continuer','Continuer',[0xa75d+i*16 for i in [0x60,0x61,0x62,0x63,0x64,0x65,0x66,0x67,0x73]],72,'white','rom')
# Continue tiles must be verified against the title map before enabling.
nt=ROM[0xda10:0xde10]
print('title menu rows',[(y,nt[y*32+22:y*32+32].hex()) for y in [22,24]])
# Read the actual Continue row instead of guessing its tile identifiers.
ids=list(nt[25*32+22:25*32+31]);g=graphics[-1];g['offsets']=[0xa75d+i*16 for i in ids];g['offset']=min(g['offsets']);g['baseBytes']=[list(ROM[a:a+16]) for a in g['offsets']]
graphics[-1]['locked']=True
graphics[-1]['reason']='Certains tiles sont partagés avec le décor du titre ; consultation uniquement dans cette version.'
allentries=list(entries.values())+graphics
mask=bytearray(ROM)
for e in allentries:
 if e.get('locked'):continue
 if e['kind']=='text':mask[e['offset']:e['end']]=bytes(e['end']-e['offset'])
 else:
  for a in e['offsets']:mask[a:a+(8 if e['style']=='mono' else 16)]=bytes(8 if e['style']=='mono' else 16)
manifest={'profile':'ff7-nes-fr-v22','version':1,'romSize':len(ROM),'baseHash':hashlib.sha256(ROM).hexdigest(),'fingerprint':hashlib.sha256(mask).hexdigest(),'fontBase':0x78010,'smallFont':small,'tables':tables,'entries':allentries,'skipped':skipped}
(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':')))
print('entries',len(allentries),'texts',len(entries),'graphics',len(graphics),'locked',sum(e.get('locked',False) for e in allentries),'skipped',len(skipped))
(ROOT/'ff7_v22_base.nes').write_bytes(ROM)
