Date.prototype.addDays = function(days) {
    var date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
}
const fs = require("fs");
const cache = require('memory-cache');
const fetch = require("node-fetch");
const icsparsesr = require("cal-parser");
const { resourceLimits } = require("worker_threads");
const regex_location = /([ABCD][0-9]+)/im;
const regex_summary = /([A-Z]+[0-9]+)/im;
const regex_classe = /([1-5])A/im;
const regex_finder = /(?<year1>[1-5]A)M(?<matiere>[A-Z]+[0-9]+)_[0-9]{4}_S[0-9]+_(?<type1>CM|TD|TDM|TP|SOUTIEN|PROJET|TP-MINIGROUPE|HA)_G(?<groupe1>[1-9]) (?<teacher1>[^\(\*]*)|(?<year2>[1-5]APP)-(?<type2>CM|TD|TDM|TP|SOUTIEN|PROJET|TP-MINIGROUPE|HA)(?<groupe2>[1-9]+)(?<teacher2>[^\(\*]*)|(?<year3>[1-5]A)/i;
const base64token = Buffer.from(`${process.env.EDT_USER}:${process.env.EDT_PASSWORD}`).toString('base64');
console.log(`${process.env.EDT_USER}:${process.env.EDT_PASSWORD}`);
const salles = [
    'A048', 
    'B040',
    'A166', 
    'A049', 
    'B044',
    'B042',
    'C080', 
    'C060',
    'A046', 
    'A042',
    'B148', 
    'C065', 
    'D030',
    'B152'
]
const addMinutes=(date, minutes)=> {
    return new Date(date.getTime() + minutes*60000);
}
const downloader = (code, res,blu=true) => {
    let data_cached = cache.get(code);
    console.log(code);
    if (!data_cached) {
        fetch(`https://edt.grenoble-inp.fr/directCal/2021-2022/esisar/etudiant/jsp/custom/modules/plannings/direct_cal.jsp?resources=${code}`,
            {
                "headers": {
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                    "accept-language": "fr,fr-FR;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
                    "sec-ch-ua": "\" Not A;Brand\";v=\"99\", \"Chromium\";v=\"98\", \"Microsoft Edge\";v=\"98\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "document",
                    "authorization": `Basic ${base64token}`, //user:password en base64
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-site": "none",
                    "sec-fetch-user": "?1",
                    "upgrade-insecure-requests": "1"
                },
                "referrerPolicy": "strict-origin-when-cross-origin",
                "body": null,
                "method": "GET"
            })
            .then(r => r.text())
            .then(r => {
                const data = icsparsesr.parseString(r);
                let data_to_send;
                if(blu){
                    data_to_send=data.events.map(event => {
                        try {
                            let parsed = regex_finder.exec(event.description.value);
                            const year = parsed.groups.year1 || parsed.groups.year2 || parsed.groups.year3;
                            const teacher = parsed.groups.teacher1 || parsed.groups.teacher2;
                            const type = parsed.groups.type1 || parsed.groups.type2;
                            const groupe = parsed.groups.groupe1 || parsed.groups.groupe2;
                            return {
                                id: event.uid.value,
                                start: event.dtstart.value,
                                end: event.dtend.value,
                                summary: regex_summary.exec(event.summary.value) ? regex_summary.exec(event.summary.value)[0] : null,
                                location: regex_location.exec(event.location.value) ? regex_location.exec(event.location.value)[0] : null,
                                description: event.description.value,
                                classe: regex_classe.exec(event.description.value) ? regex_classe.exec(event.description.value)[0] : null,
                                year: year ? year.trim() : null,
                                teacher: teacher ? teacher.trim() : null,
                                type: type ? type.trim() : null,
                                groupe: groupe ? groupe.trim() : null,
                                code: code,
                                classNames: (year ? year.trim() : "") + (type ? type.trim() : "") + (groupe ? groupe.trim() : "") + (regex_summary.exec(event.summary.value) ? regex_summary.exec(event.summary.value)[0] : ""),
                                raw: event
                            }
                        } catch (e) {
                            console.log("u", e);
                            console.log("!!", event);
                        }
                    })
                }else{
                    let mindate=Number.MAX_SAFE_INTEGER;let maxdate=Number.MIN_SAFE_INTEGER ;
                    data_to_send=data.events.map(event => {
                        try {
                            if(mindate>new Date(event.dtstart.value)){mindate=new Date(event.dtstart.value)}
                            if(maxdate<new Date(event.dtend.value)){maxdate=new Date(event.dtend.value)}
                            return {
                                id: event.uid.value,
                                start: new Date(event.dtstart.value),
                                end: new Date(event.dtend.value),
                                location: regex_location.exec(event.location.value) ? regex_location.exec(event.location.value)[0] : null,
                                raw: event
                            }
                        } catch (e) {
                            console.log("u", e);
                            console.log("!!", event);
                        }
                    })
                    result=[];
                    let tmp=[]
                    console.log([mindate,maxdate]);
                    salles.forEach(salle=>{
                        let horraires=[[mindate,maxdate]];
                        for(data_elem of data_to_send){
                            if(!data_elem.location || !data_elem.location.includes(salle)){continue}
                            for(id in horraires){
                                // console.log(id)
                                if(horraires[id][0]<=data_elem.start && data_elem.start<=horraires[id][1]){
                                    //console.log("UWU",horraires);
                                    const min=horraires[id][0];
                                    const max=horraires[id][1];
                                    horraires[id]=[min,data_elem.start];
                                    horraires.splice(id+1, 0, [data_elem.end,max]);
                                    //console.log(salle,horraires[id][0],data_elem.start,horraires[id][1],horraires)
                                }
                            }
                        }
                        horraires.forEach(r=>{
                            console.log(addMinutes(r[0],20),r[1])
                            let previous=r[0];let next=r[1];
                            if(previous.getHours()<8){previous.setHours(8,0,0)}
                            if(next.getHours()>18){next.setHours(18,0,0)}
                            if(previous.toDateString()!==next.toDateString()){
                                if(addMinutes(previous,20)<new Date(previous.getFullYear(),previous.getMonth(),previous.getDay(),18)){
                                    tmp.push({
                                        start: previous,
                                        end: new Date(previous.getFullYear(),previous.getMonth(),previous.getDay(),18),
                                        location: salle,
                                        title: salle
                                    })
                                }
                                if(addMinutes(new Date(next.getFullYear(),next.getMonth(),next,8),20)<next){
                                    tmp.push({
                                        start: new Date(next.getFullYear(),next.getMonth(),next,8),
                                        end: next,
                                        location: salle,
                                        title: salle
                                    })
                                }
                                currentDate=new Date(previous.getFullYear(),previous.getMonth(),previous.getDay()+1,18);
                                while (currentDate < next) {
                                    tmp.push({
                                        start: new Date(currentDate.getFullYear(),currentDate.getMonth(),currentDate.getDay(),8),
                                        end: currentDate,
                                        location: salle,
                                        title: salle
                                    })
                                    currentDate = currentDate.addDays(1);
                                }
                            }else{
                                if(addMinutes(previous,20)>=next){return}
                                tmp.push({
                                    start: previous,
                                    end: next,
                                    location: salle,
                                    title: salle
                                })
                            }
                        })
                    })
                    data_to_send=tmp;
                }
                //salles=[...new Set(data_to_send.filter(r=>r.type && (r.type.includes("TD") || r.type.includes("CM"))).map(r=>r.location).filter(t=>t!==null))]
                //console.log(salles);
                res.json(data_to_send);
                cache.put(code, data_to_send, 5 * 60 * 1000);//5minutes
            })
        } else {
            res.json(data_cached);
        }
}

module.exports = {
    downloader
}









// B141

// D030
// C060
// C061
// C004