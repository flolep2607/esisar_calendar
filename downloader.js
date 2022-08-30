Date.prototype.addDays = function(days) {
    var date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
}
const CACHE_TIME = 10 * 60 * 1000;
const fs = require("fs");
const cache = require('memory-cache');
const fetch = require("node-fetch");
const icsparsesr = require("cal-parser");
const { resourceLimits } = require("worker_threads");
const regex_location = /([ABCD][0-9]+)/im;
const regex_summary = /([A-Z]+[0-9]+)/im;
const regex_classe = /([1-5])A/im;
const regex_matiere_spec = /([A-Z]{2}[0-9]{3})$/im;
const regex_finder = /(?:[0-9\-\ A-Z]*?)(?<year1>[1-5]A)M(?<matiere>[A-Z]+[0-9]+)_[0-9]{4}_S[0-9]+_(?<type1>CM|TD|TDM|TP|SOUTIEN IUT|SOUTIEN CPGE|SOUTIEN|PROJET|TP-MINIGROUPE|HA)_G(?<groupe1>[1-9]) (?<teacher1>[^\(\*]*)|(?<year2>[1-5]APP)-(?<type2>CM|TD|TDM|TP|SOUTIEN|PROJET|TP-MINIGROUPE|HA)(?<groupe2>[1-9]+)(?<teacher2>[^\(\*]*)|(?<year3>[1-5]A)/i;
const base64token = Buffer.from(`${process.env.EDT_USER}:${process.env.EDT_PASSWORD}`).toString('base64');
if(!process.env.EDT_USER || !process.env.EDT_PASSWORD){
    console.log("PAS D'IDENTIFIANTS");
    process.exit();
}
// console.log(`${process.env.EDT_USER}:${process.env.EDT_PASSWORD}`);
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
const make_data_modifs=(r,cache,res,blu,code,send=true)=>{
    return r.then(r => r.text())
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
                    if(!parsed.groups.matiere && regex_matiere_spec.exec(event.summary.value)){
                        parsed.groups.matiere=regex_matiere_spec.exec(event.summary.value)[0]
                    }
                    if(!parsed.groups.matiere){
                    // if(!regex_location.exec(event.description.value)){
                        console.log(event)
                        console.log({
                            id: event.uid.value,
                            start: event.dtstart.value,
                            end: event.dtend.value,
                            summary: regex_summary.exec(event.summary.value) ? regex_summary.exec(event.summary.value)[0] : event.summary.value.trim(),
                            location: regex_location.exec(event.location.value) ? regex_location.exec(event.location.value)[0] : null,
                            description: event.description.value,
                            classe: regex_classe.exec(event.description.value) ? regex_classe.exec(event.description.value)[0] : null,
                            year: year ? year.trim() : null,
                            teacher: teacher ? teacher.trim() : null,
                            type: type ? type.trim() : null,
                            groupe: groupe ? groupe.trim() : null,
                            classNames: (year ? year.trim() : "") + (type ? type.trim() : "") + (groupe ? groupe.trim() : "") + (regex_summary.exec(event.summary.value) ? regex_summary.exec(event.summary.value)[0] : ""),
                        })
                    }
                    return {
                        id: event.uid.value,
                        start: event.dtstart.value,
                        end: event.dtend.value,
                        summary: regex_summary.exec(event.summary.value) ? regex_summary.exec(event.summary.value)[0] : event.summary.value.trim(),
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
            let mindate=Number.MAX_SAFE_INTEGER;
            let maxdate=Number.MIN_SAFE_INTEGER ;
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
            });
            mindate=new Date(mindate);
            maxdate=new Date(maxdate);
            let result=[];
            for (var d = mindate; d <= maxdate; d.setDate(d.getDate() + 1)) {
                [[[8,15],[9,45]],[[10,00],[11,30]],[[13,00],[14,30]],[[14,45],[16,15]],[[16,30],[18,00]],[[18,15],[19,45]]].forEach(r=>{
                    console.log("r=>",r);
                    const start=new Date(mindate).setHours(r[0][0],r[0][1]);
                    const end=new Date(mindate).setHours(r[1][0],r[1][1]);
                    let salles_non_prises=salles.map(r=>r.toUpperCase());
                    data_to_send.forEach(e=>{
                        if(e.location && salles_non_prises.includes(e.location) && (e.start>=start&&e.start<=end || e.end>=start&&e.end<=end) ){
                            salles_non_prises.filter(m => m != e.location.toUpperCase());
                            // salles_prises.push(e.location.toLowerCase());
                        }
                    })
                    if(salles_non_prises.length>0){
                        // const salles_non_prises=salles.filter(e=>!salles_prises.includes(e.toLowerCase()));
                        result.push({
                            id: Math.random().toString(36).substring(7),
                            start: start,
                            end: end,
                            summary: salles_non_prises.join(" "),
                            location: null,
                            description: null,
                            raw: null
                        })
                    }
                })
            }
            data_to_send=result;
            // result=[];
            // let tmp=[]
            // console.log([mindate,maxdate]);
            // salles.forEach(salle=>{
            //     let horraires=[[mindate,maxdate]];
            //     for(data_elem of data_to_send){
            //         if(!data_elem.location || !data_elem.location.includes(salle)){continue}
            //         for(id in horraires){
            //             // console.log(id)
            //             if(horraires[id][0]<=data_elem.start && data_elem.start<=horraires[id][1]){
            //                 //console.log("UWU",horraires);
            //                 const min=horraires[id][0];
            //                 const max=horraires[id][1];
            //                 horraires[id]=[min,data_elem.start];
            //                 horraires.splice(id+1, 0, [data_elem.end,max]);
            //                 //console.log(salle,horraires[id][0],data_elem.start,horraires[id][1],horraires)
            //             }
            //         }
            //     }
            //     horraires.forEach(r=>{
            //         console.log(addMinutes(r[0],20),r[1])
            //         let previous=r[0];let next=r[1];
            //         if(previous.getHours()<8){previous.setHours(8,0,0)}
            //         if(next.getHours()>18){next.setHours(18,0,0)}
            //         if(previous.toDateString()!==next.toDateString()){
            //             if(addMinutes(previous,20)<new Date(previous.getFullYear(),previous.getMonth(),previous.getDay(),18)){
            //                 tmp.push({
            //                     start: previous,
            //                     end: new Date(previous.getFullYear(),previous.getMonth(),previous.getDay(),18),
            //                     location: salle,
            //                     title: salle
            //                 })
            //             }
            //             if(addMinutes(new Date(next.getFullYear(),next.getMonth(),next,8),20)<next){
            //                 tmp.push({
            //                     start: new Date(next.getFullYear(),next.getMonth(),next,8),
            //                     end: next,
            //                     location: salle,
            //                     title: salle
            //                 })
            //             }
            //             currentDate=new Date(previous.getFullYear(),previous.getMonth(),previous.getDay()+1,18);
            //             while (currentDate < next) {
            //                 tmp.push({
            //                     start: new Date(currentDate.getFullYear(),currentDate.getMonth(),currentDate.getDay(),8),
            //                     end: currentDate,
            //                     location: salle,
            //                     title: salle
            //                 })
            //                 currentDate = currentDate.addDays(1);
            //             }
            //         }else{
            //             if(addMinutes(previous,20)>=next){return}
            //             tmp.push({
            //                 start: previous,
            //                 end: next,
            //                 location: salle,
            //                 title: salle
            //             })
            //         }
            //     })
            // })
            // data_to_send=tmp;
        }
        //salles=[...new Set(data_to_send.filter(r=>r.type && (r.type.includes("TD") || r.type.includes("CM"))).map(r=>r.location).filter(t=>t!==null))]
        //console.log(salles);
        if(send){res.json(data_to_send);}
        cache.put(code, data_to_send, CACHE_TIME);//5minutes
    })
}
const downloader = (code, res, blu = true) => {
    const currentTime = new Date();
    let YEAR_now = currentTime.getFullYear();
    if (currentTime.getMonth() < 7) { YEAR_now = YEAR_now - 1; }
    let data_cached = cache.get(code);
    console.log(code);
    data_cached=false;
    if (!data_cached) {
        make_data_modifs(fetch(`https://edt.grenoble-inp.fr/directCal/${YEAR_now}-${YEAR_now + 1}//etudiant/esisar?resources=${code}`,
            // fetch(`https://edt.grenoble-inp.fr/directCal/${YEAR_now}-${YEAR_now+1}/etudiant/esisar?resources=${code}&startDay=31&startMonth=08&startYear=${YEAR_now-1}&endDay=10&endMonth=01&endYear=${YEAR_now+3}`,
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
            }), cache, res, blu, code).then(
                () => {
                    console.log('BIG QUERYY', `${YEAR_now}-${YEAR_now + 1}`)
                    make_data_modifs(
                        fetch(`https://edt.grenoble-inp.fr/directCal/${YEAR_now}-${YEAR_now + 1}/etudiant/esisar?resources=${code}&startDay=31&startMonth=08&startYear=${YEAR_now - 1}&endDay=10&endMonth=01&endYear=${YEAR_now + 3}`,
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
                        , cache, res, blu, code, false);
                });
        // .then(r => r.text())
        // .then(r => {
        //     const data = icsparsesr.parseString(r);
        //     let data_to_send;
        //     if(blu){
        //         data_to_send=data.events.map(event => {
        //             try {
        //                 let parsed = regex_finder.exec(event.description.value);
        //                 const year = parsed.groups.year1 || parsed.groups.year2 || parsed.groups.year3;
        //                 const teacher = parsed.groups.teacher1 || parsed.groups.teacher2;
        //                 const type = parsed.groups.type1 || parsed.groups.type2;
        //                 const groupe = parsed.groups.groupe1 || parsed.groups.groupe2;
        //                 return {
        //                     id: event.uid.value,
        //                     start: event.dtstart.value,
        //                     end: event.dtend.value,
        //                     summary: regex_summary.exec(event.summary.value) ? regex_summary.exec(event.summary.value)[0] : null,
        //                     location: regex_location.exec(event.location.value) ? regex_location.exec(event.location.value)[0] : null,
        //                     description: event.description.value,
        //                     classe: regex_classe.exec(event.description.value) ? regex_classe.exec(event.description.value)[0] : null,
        //                     year: year ? year.trim() : null,
        //                     teacher: teacher ? teacher.trim() : null,
        //                     type: type ? type.trim() : null,
        //                     groupe: groupe ? groupe.trim() : null,
        //                     code: code,
        //                     classNames: (year ? year.trim() : "") + (type ? type.trim() : "") + (groupe ? groupe.trim() : "") + (regex_summary.exec(event.summary.value) ? regex_summary.exec(event.summary.value)[0] : ""),
        //                     raw: event
        //                 }
        //             } catch (e) {
        //                 console.log("u", e);
        //                 console.log("!!", event);
        //             }
        //         })
        //     }else{
        //         let mindate=Number.MAX_SAFE_INTEGER;let maxdate=Number.MIN_SAFE_INTEGER ;
        //         data_to_send=data.events.map(event => {
        //             try {
        //                 if(mindate>new Date(event.dtstart.value)){mindate=new Date(event.dtstart.value)}
        //                 if(maxdate<new Date(event.dtend.value)){maxdate=new Date(event.dtend.value)}
        //                 return {
        //                     id: event.uid.value,
        //                     start: new Date(event.dtstart.value),
        //                     end: new Date(event.dtend.value),
        //                     location: regex_location.exec(event.location.value) ? regex_location.exec(event.location.value)[0] : null,
        //                     raw: event
        //                 }
        //             } catch (e) {
        //                 console.log("u", e);
        //                 console.log("!!", event);
        //             }
        //         });
        //         mindate=new Date(mindate);
        //         maxdate=new Date(maxdate);
        //         let result=[];
        //         for (var d = mindate; d <= maxdate; d.setDate(d.getDate() + 1)) {
        //             [[[8,15],[9,45]],[[10,00],[11,30]],[[13,00],[14,30]],[[14,45],[16,15]],[[16,30],[18,00]],[[18,15],[19,45]]].forEach(r=>{
        //                 console.log("r=>",r);
        //                 const start=new Date(mindate).setHours(r[0][0],r[0][1]);
        //                 const end=new Date(mindate).setHours(r[1][0],r[1][1]);
        //                 let salles_non_prises=salles.map(r=>r.toUpperCase());
        //                 data_to_send.forEach(e=>{
        //                     if(e.location && salles_non_prises.includes(e.location) && (e.start>=start&&e.start<=end || e.end>=start&&e.end<=end) ){
        //                         salles_non_prises.filter(m => m != e.location.toUpperCase());
        //                         // salles_prises.push(e.location.toLowerCase());
        //                     }
        //                 })
        //                 if(salles_non_prises.length>0){
        //                     // const salles_non_prises=salles.filter(e=>!salles_prises.includes(e.toLowerCase()));
        //                     result.push({
        //                         id: Math.random().toString(36).substring(7),
        //                         start: start,
        //                         end: end,
        //                         summary: salles_non_prises.join(" "),
        //                         location: null,
        //                         description: null,
        //                         raw: null
        //                     })
        //                 }
        //             })
        //         }
        //         data_to_send=result;




        //         // result=[];
        //         // let tmp=[]
        //         // console.log([mindate,maxdate]);
        //         // salles.forEach(salle=>{
        //         //     let horraires=[[mindate,maxdate]];
        //         //     for(data_elem of data_to_send){
        //         //         if(!data_elem.location || !data_elem.location.includes(salle)){continue}
        //         //         for(id in horraires){
        //         //             // console.log(id)
        //         //             if(horraires[id][0]<=data_elem.start && data_elem.start<=horraires[id][1]){
        //         //                 //console.log("UWU",horraires);
        //         //                 const min=horraires[id][0];
        //         //                 const max=horraires[id][1];
        //         //                 horraires[id]=[min,data_elem.start];
        //         //                 horraires.splice(id+1, 0, [data_elem.end,max]);
        //         //                 //console.log(salle,horraires[id][0],data_elem.start,horraires[id][1],horraires)
        //         //             }
        //         //         }
        //         //     }
        //         //     horraires.forEach(r=>{
        //         //         console.log(addMinutes(r[0],20),r[1])
        //         //         let previous=r[0];let next=r[1];
        //         //         if(previous.getHours()<8){previous.setHours(8,0,0)}
        //         //         if(next.getHours()>18){next.setHours(18,0,0)}
        //         //         if(previous.toDateString()!==next.toDateString()){
        //         //             if(addMinutes(previous,20)<new Date(previous.getFullYear(),previous.getMonth(),previous.getDay(),18)){
        //         //                 tmp.push({
        //         //                     start: previous,
        //         //                     end: new Date(previous.getFullYear(),previous.getMonth(),previous.getDay(),18),
        //         //                     location: salle,
        //         //                     title: salle
        //         //                 })
        //         //             }
        //         //             if(addMinutes(new Date(next.getFullYear(),next.getMonth(),next,8),20)<next){
        //         //                 tmp.push({
        //         //                     start: new Date(next.getFullYear(),next.getMonth(),next,8),
        //         //                     end: next,
        //         //                     location: salle,
        //         //                     title: salle
        //         //                 })
        //         //             }
        //         //             currentDate=new Date(previous.getFullYear(),previous.getMonth(),previous.getDay()+1,18);
        //         //             while (currentDate < next) {
        //         //                 tmp.push({
        //         //                     start: new Date(currentDate.getFullYear(),currentDate.getMonth(),currentDate.getDay(),8),
        //         //                     end: currentDate,
        //         //                     location: salle,
        //         //                     title: salle
        //         //                 })
        //         //                 currentDate = currentDate.addDays(1);
        //         //             }
        //         //         }else{
        //         //             if(addMinutes(previous,20)>=next){return}
        //         //             tmp.push({
        //         //                 start: previous,
        //         //                 end: next,
        //         //                 location: salle,
        //         //                 title: salle
        //         //             })
        //         //         }
        //         //     })
        //         // })
        //         // data_to_send=tmp;
        //     }
        //     //salles=[...new Set(data_to_send.filter(r=>r.type && (r.type.includes("TD") || r.type.includes("CM"))).map(r=>r.location).filter(t=>t!==null))]
        //     //console.log(salles);
        //     res.json(data_to_send);
        //     cache.put(code, data_to_send, CACHE_TIME);//5minutes
        // })
    } else {
        res.json(data_cached);
    }
}
const downloaderics=(code,res)=>{
    const currentTime = new Date();
    let YEAR_now=currentTime.getFullYear();
    if(currentTime.getMonth()<7){YEAR_now=YEAR_now-1;}
    fetch(`https://edt.grenoble-inp.fr/directCal/${YEAR_now}-${YEAR_now+1}//etudiant/esisar?resources=${code}`,
    // fetch(`https://edt.grenoble-inp.fr/directCal/${YEAR_now}-${YEAR_now+1}/etudiant/esisar?resources=${code}&startDay=31&startMonth=08&startYear=${YEAR_now-1}&endDay=10&endMonth=01&endYear=${YEAR_now+3}`,
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
            }).then(r=>{
                r.headers.forEach((v, n) => res.setHeader(n, v));
                r.body.pipe(res)
            });
}

module.exports = {
    downloader,
    downloaderics
}









// B141

// D030
// C060
// C061
// C004
