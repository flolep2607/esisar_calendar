const express = require('express');
const app = express();
const fs = require("fs");
const api = express.Router();
const apicache = require("apicache");
const { 
    downloaderics,
    downloader 
} = require("./downloader.js");
let cache = apicache.options({
    enabled:true
  }).middleware

const SALLES="9756,2432,2101,2895,2336,1814,1660,2706,2295,3098,3096,9757,15186,1796,1797,2543";
app.get('/', (req, res) => {
    res.sendFile("index.html", { root: __dirname });
});
api.use(cache('5 minutes'))
api.get("/ics/:code", (req, res) => { // cache 5 minutes cache(5*60*1000)
    downloaderics(req.params.code,res);
})
api.get("/json/:code", (req, res) => { // cache 5 minutes
    if(req.params.code=="salles"){
        // fs.readFile("./classes.json", "utf8", (err, data) => {
        //     if (err) throw err;
        //     // data=JSON.parse(data);
        //     // const query=data.map(c=>c.code);
            
        // });
        downloader(SALLES,res,false);
    }else{
        downloader(req.params.code,res);
    }
})
api.get("/json", (req, res) => { // cache 5 minutes
    downloader(req.params.code,res);
})
api.get("/classes", (_, res) => { // cache 5 minutes
    fs.readFile("./classes.json", "utf8", (err, data) => {
        if (err) throw err;
        res.json(JSON.parse(data));
    });
});

api.get("/salles", (_, res) => { // cache 5 minutes
    fs.readFile("./classes.json", "utf8", (err, data) => {
        if (err) throw err;
        downloader(SALLES,res,false);
    });
});

app.use('/api', api);
app.listen(process.env.PORT || 8080, () => {
    console.log(`http://localhost:${process.env.PORT || 8080}`)
});
