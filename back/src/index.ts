import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import redis from 'redis';


import config  from './config.json';
import packageFile from '../package.json';

let router = express.Router();
let app = express();
app.use(cookieParser());
app.use(router);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
let redisClient = redis.createClient();
const userTTL = 100; //sec
const apiPrefix = '/api/'
const okStr = '[\x1b[32m Ok \x1b[0m]'
router.use(express.static(__dirname + '/../public'));

app.get(apiPrefix+'info', (req, res) => {
    res.json({app: packageFile.name, version: packageFile.version})
})

app.get(apiPrefix+'auth/me', userData, (req: any, res) => {
    res.json({user: req.user});
})

app.post(apiPrefix+'auth/login', (req, res) => {
    if(!req.body.tfa_code){
        res.status(422);
        res.json({error: {id: -1,  comment: 'no field tfa_code'}});
    }
    if(req.body.tfa_code === '0000'){
        const rand=()=>Math.random().toString(36).substr(2);
        const token = (rand()+rand()+rand()+rand()).substr(0,30);
        res.cookie('access-token', token)
        redisClient.set('token-'+token, '21', (setErr, setReplies) => {
            redisClient.expire('token-'+token, userTTL, (expErr, expReplies) => {
                if(!setErr &&  !expErr){
                    res.json({token: token, set: setReplies, exp: expReplies});
                }else{
                    res.status(403);
                    res.json({error: {id: -1,  comment: 'redis can not set token', set: setErr,  exp: expErr}});
                }
            });
        });
    }else{
        res.status(403);
        res.json({error: {id: -1,  comment: 'tfa_code not match'}});
    }
})

app.get(apiPrefix+'auth/logout', (req, res) => {
    const token = req.cookies['access-token'];
    redisClient.del('token-'+token, (err, replies) => {
        if(!err){
            res.json({logout: 'ok'});
        }else{
            res.json({error: err});
        }
    });
})


function userData (req: any, res: any, next: any) {
    const token = req.cookies['access-token'];
    redisClient.get('token-'+token, (err, userId) => {
        req.user = { authenticated: false};
        if(!err && userId){
            req.user = { authenticated: true, id: userId};
            redisClient.expire('token-'+token, userTTL, (expErr, expReplies) => {
                return next();
            });
        }else{
            res.status(403);
            return next();
        }

    });
}


redisClient.on('error', (err) => {
    console.error('\x1b[31m >> Redis Error: \x1b[0m', err);
});

redisClient.on('connect', (err) => {
    console.log(okStr, 'Redis connected');
});

app.listen(3000, () => {
    console.log('\n\x1b[43m-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-\x1b[0m');
    console.log(okStr, 'App starded');
    console.log(okStr, packageFile.name+' '+packageFile.version+' is ready HOST: \x1b[36mhttp://localhost:3000/\x1b[0m ');
});
