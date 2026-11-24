
const TOWNS = [
  [175,105],[167,131],[173,129],[125,155],[861,186],
  [843,225],[820,246],[795,251],[776,277],[746,290],
  [732,285],[698,290],[672,290],[645,311],[625,305],
  [598,324],[570,329],[526,311],[519,311],[490,311],
  [481,303],[448,264],[448,243],[416,266],[398,279],
  [374,266],[341,256],[318,240],[294,217],[273,201],
  [255,222],[229,251],[206,207],[191,162],[176,157],
  [155,183],[136,170]
];
const ELEV = [
  [0,140],[25,950],[47,550],[67,450],[91,410],[113,460],[141,430],[169,385],[198,435],[219,570],
  [242,760],[266,800],[292,856],[313,790],[333,800],[358,750],[377.6,810],[404.6,830],[418.6,820],
  [433.6,810],[452.6,800],[472.6,819],[490.1,780],[507.1,850],[527.1,1149],[559.7,542],[586,522],
  [613.8,1293],[634.8,700],[653.4,397],[675.9,440],[700.9,389],[729.7,285],[749,263],[769,262],
  [790,250],[813,330],[832,25]
];
const DAY_LABELS = {1:"D1 · Pyrenees",13:"D13 · Burgos",23:"D23 · León",27:"D27 · O Cebreiro 1,293 m",36:"D36 · Santiago",39:"Finisterre"};
const BASE = new Date(2026,1,22);
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function dateOf(n){ const d = new Date(BASE); d.setDate(d.getDate()+n-1); return d.getDate()+" "+MON[d.getMonth()]; }
const DAYS = [
{n:1,from:"Saint-Jean-Pied-de-Port",to:"Roncesvalles",sub:"via Valcarlos · official winter route",km:25,up:950,tags:["scenic","mountain"],why:"The crossing from France into Spain. In late February the high Route Napoléon is closed (1 Nov – 31 Mar, fines apply), so the Valcarlos valley route is the official line — gentler, quieter, and beautiful in its own right. Split at Valcarlos (~13 km) if the cold bites.",sleep:"Book ahead: the Roncesvalles albergue or a pension. Winter beds are scarce.",eat:"Last French lunch in SJPP; dinner at the albergue.",note:"Get your credencial + first stamp at the Pilgrim Office (39 rue de la Citadelle). Microspikes on. Check the pass-status board that morning."},
{n:2,from:"Roncesvalles",to:"Zubiri",sub:"down through the beech forest",km:22,up:250,tags:["scenic"],why:"A long, satisfying descent from the pass through ancient beech woods to the famous Puente de la Rabia — one of the most photographed bridges on the whole route.",sleep:"Zubiri has several private albergues — book the night before.",eat:"Menú del día in Zubiri; stock snacks for tomorrow.",note:"Water at the fountain in Espinal on the way down."},
{n:3,from:"Zubiri",to:"Pamplona",sub:"the city of the bulls",km:20,up:150,tags:["city"],why:"Through the Magdalena gardens and under the city walls into Pamplona — citadel, cathedral, and the old town’s pintxos bars reward a slow afternoon.",sleep:"Pamplona has the most beds on the route; still confirm in winter.",eat:"Pintxos on Calle Estafeta and Calle San Nicolás — dinner is a crawl, not a meal.",note:"Stamp the credencial at the cathedral or a café."},
{n:4,from:"Pamplona",to:"Puente la Reina",sub:"over the Alto del Perdón",km:24,up:200,tags:["scenic","history"],why:"Up to the wind-turbine ridge of the Alto del Perdón — on a clear day the Pyrenees behind you, the plains ahead — then down to where the two French routes merge at the Romanesque bridge.",sleep:"Puente la Reina: small town, book ahead in winter.",eat:"Lunch at the top of the climb if the bar is open; otherwise carry food.",note:"Wind on the ridge is real — layer up even in sun."},
{n:5,from:"Puente la Reina",to:"Estella",sub:"the star town",km:22,up:250,tags:["history","city"],why:"Into Estella, the ‘star town’ of the Camino — Romanesque churches, the Palacio de los Reyes de Navarra. A good place to stock up before the long Rioja days.",sleep:"Estella has several options; confirm opening.",eat:"Try the local beans and peppers.",note:"Fill water bottles — the next stretch is dry."},
{n:6,from:"Estella",to:"Los Arcos",sub:"long day on the plain",km:28,up:250,tags:["long"],why:"A long, honest day across farmland and vineyards. The fountain at Villamayor de Monjardín is the classic mid-stage water stop.",sleep:"Los Arcos: private albergue or pension, booked ahead.",eat:"Menú in Los Arcos.",note:"Start early — 28 km in short winter daylight."},
{n:7,from:"Los Arcos",to:"Logroño",sub:"into wine country",km:28,up:150,tags:["long","food"],why:"The last long approach into La Rioja’s capital. Calle Laurel at night is the tapas street — dinner is the main event of the day.",sleep:"Logroño is well supplied; take a private room if budget allows.",eat:"Rioja wine with the menú; pintxos on Laurel.",note:"The wine region begins here — celebrate lightly."},
{n:8,from:"Logroño",to:"Nájera",sub:"along the Najerilla valley",km:29,up:200,tags:["long","history"],why:"West along the river valley to Nájera and the monastery of Santa María la Real with its royal pantheon — one of the great church stops of the route.",sleep:"Nájera: book ahead.",eat:"Menú in Nájera.",note:"Longest day so far at 29 km — leave with the sunrise."},
{n:9,from:"Nájera",to:"Santo Domingo de la Calzada",sub:"the chicken legend",km:21,up:250,tags:["history"],why:"Into the town of the cathedral where a live chicken lives in a coop inside the church — the legend of the hanged-and-saved pilgrim.",sleep:"Santo Domingo has several albergues; confirm winter opening.",eat:"The town’s namesake menú.",note:"A good day for a shorter afternoon stroll."},
{n:10,from:"Santo Domingo",to:"Belorado",sub:"onto the high plateau",km:23,up:300,tags:["scenic"],why:"The first real climb onto the Castilian plateau toward Burgos. Big skies and long views begin here.",sleep:"Belorado: small, book ahead.",eat:"Dinner early — tomorrow is long.",note:"Weather can change fast on the plateau; check the sky."},
{n:11,from:"Belorado",to:"San Juan de Ortega",sub:"ruined monastery",km:24,up:150,tags:["history"],why:"Past the atmospheric ruins of the monastery of San Juan de Ortega; quiet villages, gravel paths, classic Castile.",sleep:"San Juan de Ortega is tiny — confirm the one or two places open in winter; otherwise plan for Burgos the next day.",eat:"Carry lunch; options are thin.",note:"Short water gaps — refill in Belorado and Agés."},
{n:12,from:"San Juan de Ortega",to:"Burgos",sub:"arrival under the Gothic cathedral",km:26,up:200,tags:["city"],why:"The great arrival: into Burgos beneath one of Spain’s finest Gothic cathedrals. Worth every kilometre.",sleep:"Burgos is well supplied — take a private room for the rest day.",eat:"Celebrate properly in the old town.",note:"Stamp at the cathedral."},
{n:13,rest:true,from:"Burgos",to:"Burgos",sub:"rest day",km:0,up:0,tags:["rest","city"],why:"Wash clothes, see the cathedral properly, eat well, sleep long. The meseta is relentless — go into it rested.",sleep:"Same place two nights, or upgrade to a hotel.",eat:"Morcilla de Burgos if you eat meat.",note:"Book the next three nights ahead — winter beds are limited."},
{n:14,from:"Burgos",to:"Hornillos del Camino",sub:"onto the meseta",km:21,up:150,tags:["scenic"],why:"Out of the city and onto the meseta: endless horizon, Romanesque churches in tiny villages, and a silence you will remember.",sleep:"Hornillos: small; confirm opening.",eat:"Menú in Hornillos.",note:"The meseta is flat but exposed — wind and sun both."},
{n:15,from:"Hornillos del Camino",to:"Castrojeriz",sub:"castle above the town",km:20,up:100,tags:["scenic"],why:"Up to the ruined castle above Castrojeriz — arguably the best sunset spot on the meseta, looking back over the plain.",sleep:"Castrojeriz has a couple of options; book ahead.",eat:"Dinner with the sunset view.",note:"Photograph the light at golden hour."},
{n:16,from:"Castrojeriz",to:"Frómista",sub:"Romanesque masterpiece",km:25,up:80,tags:["history","scenic"],why:"Down to Frómista and San Martín — one of the finest Romanesque churches in Spain — then along the Canal de Castilla towpath.",sleep:"Frómista: confirm beds.",eat:"Menú in Frómista.",note:"Flat, easy walking — good for tired legs."},
{n:17,from:"Frómista",to:"Carrión de los Condes",sub:"monastery town",km:19.6,up:80,tags:["history"],why:"A deliberately short day into Carrión, with the monastery of San Zoilo and the Church of Santa María del Camino. Easy legs before the big meseta day.",sleep:"Carrión is well supplied; book ahead.",eat:"Rest well — tomorrow is 27 km.",note:"Stock up: the next day has a 17 km no-service stretch."},
{n:18,from:"Carrión de los Condes",to:"Terradillos de los Templarios",sub:"the long meseta day · 17 km no water",km:27,up:120,tags:["long"],why:"The classic long stage: flat cereal fields through Calzadilla de la Cueza and Ledigos. No villages, fountains or shops for the first 17 km — carry 2 L of water and food, and leave early.",sleep:"Terradillos is a small village — confirm the albergue is open.",eat:"Packed lunch from Carrión.",note:"Do not skip the water discipline here. It is the most common winter mistake."},
{n:19,from:"Terradillos",to:"Sahagún",sub:"the halfway point",km:14,up:60,tags:["history"],why:"A short recovery day into Sahagún, the symbolic halfway point of the Francés, famous for its Mudéjar churches of San Tirso and San Lorenzo.",sleep:"Sahagún has several albergues; still confirm in winter.",eat:"Good menú; amarguillos (almond sweets) are the local specialty.",note:"Enjoy the short day — you’ve earned it."},
{n:20,from:"Sahagún",to:"El Burgo Ranero",sub:"Tierra de Campos",km:15,up:40,tags:[],why:"Flat farmland west. Option: the Bercianos del Real Camino variant (10 km of nothing after Sahagún — carry water) or the quieter Vía Trajana via Calzadilla de los Hermanillos, rejoining before Mansilla.",sleep:"El Burgo Ranero: small, book ahead.",eat:"Stock up — the next stretch to Reliegos has no services.",note:"Short day again: use it to recover for León."},
{n:21,from:"El Burgo Ranero",to:"Mansilla de las Mulas",sub:"walled town on the Esla",km:19,up:40,tags:[],why:"13 km of road from El Burgo to Reliegos with no services, then the walled medieval town of Mansilla — the last stop before León.",sleep:"Mansilla has good options; book ahead.",eat:"Menú in Mansilla.",note:"Buy snacks in El Burgo before you leave."},
{n:22,from:"Mansilla de las Mulas",to:"León",sub:"the cathedral city",km:20,up:120,tags:["city"],why:"The final push into León, beneath the stained glass of one of Spain’s greatest cathedrals, plus Casa Botines and the basilica of San Isidoro.",sleep:"León is well supplied — take a room for the rest day.",eat:"Cecina and wine in the Barrio Húmedo.",note:"Arrive before dark in winter — the last kilometres are unlit."},
{n:23,rest:true,from:"León",to:"León",sub:"rest day",km:0,up:0,tags:["rest","city"],why:"Gaudí’s Casa Botines, San Isidoro’s Romanesque frescoes, and a proper rest before the mountains of El Bierzo.",sleep:"Same room two nights or a hotel.",eat:"Barrio Húmedo for tapas.",note:"Book ahead through Ponferrada and Villafranca — Bierzo winter beds are limited."},
{n:24,from:"León",to:"Hospital de Órbigo",sub:"the legendary bridge",km:17.5,up:80,tags:["history"],why:"An easy exit from León over the Puente de Órbigo — twenty arches where the Templars once held the crossing.",sleep:"Hospital de Órbigo: small; confirm.",eat:"Menú at the bridge.",note:"Short day — arrive early, rest the legs."},
{n:25,from:"Hospital de Órbigo",to:"Astorga",sub:"Gaudí’s palace",km:17,up:150,tags:["history","city"],why:"A short pleasant day into Astorga, with Gaudí’s Episcopal Palace watching over the plain — a gem of a small city.",sleep:"Astorga has good options; book ahead.",eat:"Cocido maragato — the hearty local stew.",note:"Fill up: tomorrow climbs to the Cruz de Ferro."},
{n:26,from:"Astorga",to:"Rabanal del Camino",sub:"toward the Cruz de Ferro",km:20,up:350,tags:["mountain","scenic"],why:"The climb begins toward Foncebadón and the Cruz de Ferro at 1,505 m — leave a stone there, with a worry or a prayer. Rabanal itself sits at 1,149 m.",sleep:"Rabanal: confirm the albergue is open — it is the main stop before Ponferrada.",eat:"Early dinner; big day tomorrow.",note:"The Cruz de Ferro is the highest point of the whole route."},
{n:27,from:"Rabanal del Camino",to:"Ponferrada",sub:"the biggest day · Templar castle",km:32.6,up:250,tags:["long","scenic","mountain"],why:"The longest day of the route: down from the high moorland into El Bierzo and the Templar castle of Ponferrada. In short winter daylight, consider splitting at Foncebadón or Molinaseca.",sleep:"Ponferrada is well supplied; book ahead.",eat:"Celebrate — castle, menú, Bierzo wine.",note:"32.6 km is a lot in February light; start at first light."},
{n:28,from:"Ponferrada",to:"Villafranca del Bierzo",sub:"little Compostela",km:26.3,up:200,tags:["scenic","history"],why:"Through the green Bierzo valley to Villafranca, ‘little Compostela’, with its castle and the church of Santiago where sick pilgrims were once carried.",sleep:"Villafranca has several options; confirm winter opening.",eat:"Bierzo peppers and wine.",note:"Long day — leave early."},
{n:29,from:"Villafranca del Bierzo",to:"O Cebreiro",sub:"the climb into Galicia · 1,293 m",km:27.8,up:850,tags:["scenic","mountain"],why:"The big climb into Galicia: up through Vega de Valcarce to the stone village of O Cebreiro at 1,293 m — pallozas, mist, and one of the most atmospheric nights on the route. If weather is severe, the bus to Pedrafita is the wise move.",sleep:"O Cebreiro: book ahead; winter nights here are cold and magical.",eat:"Caldo gallego — Galician broth — for dinner.",note:"Check the forecast the night before; this is the day to stay flexible."},
{n:30,from:"O Cebreiro",to:"Triacastela",sub:"down into the valleys",km:21,up:250,tags:["scenic","mountain"],why:"Down through the San Xil oak forest into the river valleys. Alternative via Hospital da Condesa (28.7 km) for bigger views if the day is kind.",sleep:"Triacastela: book ahead.",eat:"Menú; the first pulpo may appear on the menu.",note:"Mud and wet roots — boots over shoes."},
{n:31,from:"Triacastela",to:"Sarria",sub:"joining the last 100 km",km:18.6,up:150,tags:["scenic"],why:"You cross into the final 100 km at Sarria — this is where the Compostela becomes official, and where the trail gets busier with short-stage pilgrims.",sleep:"Sarria is well supplied; book ahead.",eat:"Pulpo a feira — octopus — starts appearing everywhere.",note:"Stamp twice here to keep the last 100 km honest."},
{n:32,from:"Sarria",to:"Portomarín",sub:"the sunken green lanes",km:22.5,up:200,tags:["scenic"],why:"Through the corredoiras — sunken, mossy green lanes — and down to Portomarín, rebuilt stone by stone above the reservoir.",sleep:"Portomarín: several albergues; book ahead in winter.",eat:"Menú with local wine.",note:"One of the prettiest stages of the last 100 km."},
{n:33,from:"Portomarín",to:"Palas de Rei",sub:"rolling Galician farmland",km:25,up:250,tags:["long","scenic"],why:"Rolling farmland and forest — a proper 25 km push through the heart of rural Galicia.",sleep:"Palas de Rei: book ahead.",eat:"Menú in Palas.",note:"Start early; Galicia mornings are damp."},
{n:34,from:"Palas de Rei",to:"Arzúa",sub:"via Melide — pulpo lunch",km:28.8,up:200,tags:["long","food","scenic"],why:"A long day, but it passes through Melide at lunchtime — stop for pulpo a feira, the octopus dish of the last 100 km — then on through forest to Arzúa.",sleep:"Arzúa: well supplied; book ahead.",eat:"Melide is the lunch stop — do not skip it.",note:"28.8 km — one of the longer final days; leave early."},
{n:35,from:"Arzúa",to:"O Pedrouzo",sub:"last night before the city",km:19.3,up:150,tags:["scenic"],why:"Through eucalyptus and pine toward the outskirts of Santiago. O Pedrouzo is the traditional last stop — sleep well.",sleep:"O Pedrouzo: book ahead.",eat:"Early night.",note:"Tomorrow you walk into the Praza do Obradoiro."},
{n:36,from:"O Pedrouzo",to:"Santiago de Compostela",sub:"the arrival ✦",km:20,up:120,tags:["city"],why:"Through the Porta do Camiño to the Obradoiro square and the cathedral façade. Pilgrim’s Mass at 12:00; collect the Compostela at rúa das Carretas 33. Take a day here — you have walked ~780 km.",sleep:"Santiago: celebrate properly.",eat:"Last pilgrim dinner — the whole city is a table.",note:"The Botafumeiro swings at Mass on Fridays and holy days."},
{n:37,epi:true,from:"Santiago",to:"Negreira",sub:"epilogue · day 1",km:21,up:100,tags:["scenic"],why:"West out of the city into the Tambre valley — the first day beyond Santiago, on old paths toward the coast.",sleep:"Negreira: book a pension.",eat:"Menú in Negreira.",note:"A bus alternative exists if the weather turns."},
{n:38,epi:true,from:"Negreira",to:"Olveiroa",sub:"epilogue · day 2",km:23,up:200,tags:["scenic"],why:"Through pine forest and over the river to Olveiroa, a quiet stop before the final push to the cape.",sleep:"Olveiroa: small; book ahead.",eat:"Dinner early — sunset tomorrow.",note:"Check the sunset time (≈ 20:00 by late March)."},
{n:39,epi:true,from:"Olveiroa",to:"Finisterre",sub:"epilogue · the end of the world",km:19,up:150,tags:["scenic"],why:"The last 19 km to the lighthouse at Cape Finisterre — where the Camino logically ends at the ocean. Watch the sun go down, then bus back to Santiago (Tralusa, ~1 h).",sleep:"One more night in Santiago, then fly home.",eat:"Seafood dinner in Finisterre town.",note:"834 km door to door. Buen Camino."}
];
const ACTS = [
{id:"act1",no:"I",title:"The Pyrenees & Navarra",color:"",range:"Days 1–5 · 22–26 Feb · 113 km",desc:"Crossing from France into Spain over the winter route, then down through Navarre’s green valleys.",from:1,to:5},
{id:"act2",no:"II",title:"La Rioja & the road to Burgos",color:"",range:"Days 6–13 · 27 Feb – 6 Mar · 181 km + rest",desc:"Wine country and Romanesque churches, climbing onto the Castilian plateau, arriving in Burgos for a rest day.",from:6,to:13},
{id:"act3",no:"III",title:"The Meseta & León",color:"",range:"Days 14–23 · 7–16 Mar · 161 km + rest",desc:"The spiritual heart of the route: big sky, straight lines, long waterless stretches — and León’s cathedral at the end.",from:14,to:23},
{id:"act4",no:"IV",title:"León, El Bierzo & the Galician mountains",color:"",range:"Days 24–30 · 17–23 Mar · 168 km",desc:"Over the Cruz de Ferro and the last high passes, down into El Bierzo, then the great climb to O Cebreiro at 1,293 m.",from:24,to:30},
{id:"act5",no:"V",title:"Galicia & Santiago",color:"",range:"Days 31–36 · 24–29 Mar · 149 km",desc:"The last 100 km through sunken green lanes and forest, arriving at the Obradoiro on 29 March.",from:31,to:36},
{id:"epi",no:"✦",title:"Epilogue — to the Atlantic",color:"",range:"Days 37–39 · 30 Mar – 1 Apr · 63 km",desc:"Beyond Santiago to Finisterre, where the road ends at the sea.",from:37,to:39}
];
const TAG_LABEL = {scenic:"scenic",mountain:"mountain",food:"food & wine",city:"city",rest:"rest",long:"long day",history:"history"};
function dayCard(d){
  const tags = d.tags.map(t=>`<i>${TAG_LABEL[t]||t}</i>`).join("");
  const cls = (d.rest?"rest ":"")+(d.epi?"epi ":"");
  const tagAttr = d.tags.concat(d.km>=25?["long"]:[]).join(" ");
  return `<article class="day reveal ${cls}" data-tags="${tagAttr}">
    <button class="day-head" aria-expanded="false">
      <span class="d-no num">${String(d.n).padStart(2,"0")}<small>${dateOf(d.n)}</small></span>
      <span class="d-main">
        <span class="d-route">${d.from} <span class="arr">→</span> ${d.to}</span>
        <span class="d-sub">${d.sub}</span>
        <span class="d-why">${d.why}</span>
        ${tags?`<span class="d-tags">${tags}</span>`:""}
      </span>
      <span class="d-stats num">
        <span class="s"><b>${d.km?d.km:"—"}</b><span>km</span></span>
        <span class="s"><b>${d.up?"+"+d.up:"—"}</b><span>m ↑</span></span>
      </span>
      <span class="d-chev" aria-hidden="true">+</span>
    </button>
    <div class="d-detail"><div class="d-detail-in"><div class="d-detail-grid">
      <div><div class="lbl">Sleep</div><p>${d.sleep}</p></div>
      <div><div class="lbl">Eat</div><p>${d.eat}</p></div>
      <div><div class="lbl">Field note</div><p>${d.note}</p></div>
    </div></div></div>
  </article>`;
}
const list = document.getElementById("dayList");
list.innerHTML = ACTS.map(a=>`<div class="act">
  <div class="act-head reveal"><h3><i>${a.no}</i>${a.title}</h3><p>${a.desc}</p><span class="range num">${a.range}</span></div>
  ${DAYS.filter(d=>d.n>=a.from&&d.n<=a.to).map(dayCard).join("")}
</div>`).join("");
list.addEventListener("click", e=>{
  const head = e.target.closest(".day-head");
  if(!head) return;
  const day = head.closest(".day");
  head.setAttribute("aria-expanded", day.classList.toggle("open"));
});
document.getElementById("filters").addEventListener("click", e=>{
  const chip = e.target.closest(".fchip"); if(!chip) return;
  document.querySelectorAll(".fchip").forEach(c=>c.classList.remove("on"));
  chip.classList.add("on");
  const f = chip.dataset.f;
  document.querySelectorAll(".day").forEach(d=>{
    d.classList.toggle("hidden", f!=="all" && !d.dataset.tags.split(" ").includes(f));
  });
  document.querySelectorAll(".act").forEach(a=>{
    a.style.display = a.querySelector(".day:not(.hidden)") ? "" : "none";
  });
});
const mq = document.getElementById("marqueeTrack");
const towns = ["Saint-Jean-Pied-de-Port","Roncesvalles","Pamplona","Puente la Reina","Estella","Logroño","Nájera","Burgos","Castrojeriz","Frómista","Carrión","Sahagún","León","Astorga","Ponferrada","Villafranca","O Cebreiro","Sarria","Portomarín","Melide","Arzúa","Santiago","Finisterre"];
mq.innerHTML = towns.map(t=>`<span>${t}</span><i>✦</i>`).join("").repeat(2);
const townsG = document.getElementById("towns");
townsG.innerHTML = TOWNS.map((t,i)=>`<circle class="town" data-i="${i}" cx="${t[0]}" cy="${t[1]}" r="3.2" />`).join("");
const routePath = document.getElementById("routePath");
const epiPath = document.getElementById("epiPath");
const rlen = routePath.getTotalLength();
routePath.style.strokeDasharray = rlen;
routePath.style.strokeDashoffset = rlen;
function buildElev(){
  const svg = document.getElementById("elev");
  const W=1100,H=340,padL=48,padR=20,padT=34,padB=40;
  const maxKm=840, maxAlt=1400;
  const X = km => padL + (km/maxKm)*(W-padL-padR);
  const Y = a => padT + (1-a/maxAlt)*(H-padT-padB);
  let g = "";
  for(let a=0;a<=maxAlt;a+=200){
    g += `<line x1="${padL}" y1="${Y(a)}" x2="${W-padR}" y2="${Y(a)}" class="gl"/><text x="${padL-8}" y="${Y(a)+4}" text-anchor="end" font-size="10" class="ax">${a} m</text>`;
  }
  for(let km=0;km<=800;km+=100){
    g += `<line x1="${X(km)}" y1="${padT}" x2="${X(km)}" y2="${H-padB}" class="gl"/><text x="${X(km)}" y="${H-padB+18}" text-anchor="middle" font-size="10" class="ax">${km} km</text>`;
  }
  const bands = [[0,91,"Pyrenees & Navarra",""],[91,292,"La Rioja → Burgos",""],[292,473,"Meseta & León",""],[473,635,"Bierzo",""],[635,769,"Galicia",""],[769,840,"Epilogue",""]];
  bands.forEach(b=>{
    g += `<rect x="${X(b[0])}" y="${padT}" width="${X(b[1])-X(b[0])}" height="${H-padT-padB}" class="band" opacity="0.05"/>`;
    g += `<text x="${(X(b[0])+X(b[1]))/2}" y="${padT+14}" text-anchor="middle" font-size="10" font-weight="600" letter-spacing="1.5" class="bl">${b[2].toUpperCase()}</text>`;
  });
  const pts = ELEV.map(p=>X(p[0]).toFixed(1)+","+Y(p[1]).toFixed(1));
  const line = "M"+pts.join(" L");
  g += `<path id="elevArea" d="${line} L${X(840)},${Y(0)} L${X(0)},${Y(0)} Z" class="earea"/>`;
  g += `<path id="elevLine" d="${line}" class="eline"/>`;
  Object.keys(DAY_LABELS).forEach(k=>{
    k = +k;
    const km = k===39 ? 832 : ELEV[k-1][0];
    const alt = k===39 ? 25 : ELEV[k-1][1];
    g += `<circle cx="${X(km)}" cy="${Y(alt)}" r="3.4" class="pk"/>`;
    g += `<text x="${X(km)}" y="${Y(alt)-10}" text-anchor="middle" font-size="10" font-weight="600" class="pl">${DAY_LABELS[k]}</text>`;
  });
  g += `<text x="${padL}" y="${H-6}" font-size="10" class="ax">Elevation profile · Saint-Jean-Pied-de-Port (140 m) → Finisterre (sea level) · cumulative km</text>`;
  svg.innerHTML = g;
  const el = document.getElementById("elevLine");
  const L = el.getTotalLength();
  el.style.strokeDasharray = L; el.style.strokeDashoffset = L;
}
buildElev();
function onScroll(){
  const h = document.documentElement;
  const p = h.scrollTop / (h.scrollHeight - h.clientHeight);
  document.getElementById("progress").style.width = (p*100)+"%";
  document.getElementById("topbar").classList.toggle("scrolled", h.scrollTop>10);
  const r = document.getElementById("route").getBoundingClientRect();
  const vh = innerHeight;
  let mp = (vh*0.85 - r.top) / (r.height*0.9);
  mp = Math.max(0, Math.min(1, mp));
  routePath.style.strokeDashoffset = rlen*(1-mp);
  epiPath.style.opacity = mp>0.97 ? 1 : 0;
  document.querySelectorAll(".town").forEach(c=>{
    const on = (+c.dataset.i/(TOWNS.length-1)) <= mp+0.02;
    c.classList.toggle("on", on);
  });
  const elev = document.getElementById("elev");
  if(elev.getBoundingClientRect().top < vh*0.9){
    const el = document.getElementById("elevLine");
    el.style.transition = "stroke-dashoffset 1.6s cubic-bezier(.4,0,.2,1)";
    el.style.strokeDashoffset = 0;
    const ea = document.getElementById("elevArea");
    ea.style.transition = "opacity 1.2s ease .4s"; ea.style.opacity = 0.10;
  }
}
addEventListener("scroll", onScroll, {passive:true});
onScroll();
const io = new IntersectionObserver(es=>{
  es.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add("in"); io.unobserve(en.target); } });
},{threshold:0.12, rootMargin:"0px 0px -6% 0px"});
document.querySelectorAll(".reveal").forEach((el,i)=>{
  el.style.transitionDelay = (i%4)*60+"ms";
  io.observe(el);
});
const navIO = new IntersectionObserver(es=>{
  es.forEach(en=>{
    if(en.isIntersecting){
      document.querySelectorAll("#topbar nav a").forEach(a=>a.classList.toggle("active", a.getAttribute("href")==="#"+en.target.id));
    }
  });
},{rootMargin:"-40% 0px -55% 0px"});
["compare","overview","route","days","practical","epilogue"].forEach(id=>navIO.observe(document.getElementById(id)));
const kmEl = document.getElementById("kmCount");
const t0 = performance.now();
function tick(t){
  const p = Math.min(1,(t-t0)/1400);
  kmEl.textContent = Math.round(780*(1-Math.pow(1-p,3)));
  if(p<1) requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

if (location.hostname === "spain.ethantam.dev") {
  const c = document.querySelector("link[rel=canonical]");
  if (c) c.setAttribute("href", "https://spain.ethantam.dev/");
  document.title = "The long way to Santiago · spain.ethantam.dev";
}
