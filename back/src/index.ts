import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import redis from 'redis';


import config  from './config.json';
import packageFile from '../package.json';

let router = express.Router();
let app = express();
let redisClient = redis.createClient();
const userTTL = 100; //sec
const apiPrefix = '/api/'

router.use(express.static(__dirname + '/../public'));

router.get(apiPrefix+'info', (req, res) => {
    res.json({app: packageFile.name, version: packageFile.version})
})

router.get(apiPrefix+'auth/me', userData, (req: any, res) => {
    res.json({user: req.user});
})

router.post(apiPrefix+'auth/login', (req, res) => {
    if(!req.query.tfa_code){
        res.status(422);
        res.json({error: {id: -1,  comment: 'no field tfa_code'}});
    }
    if(req.query.tfa_code === '0000'){
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

router.get(apiPrefix+'auth/logout', (req, res) => {
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

app.use(cookieParser());
app.use(router);
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

redisClient.on('error', (err) => {
    console.error('Redis Error: ' + err);
});

app.listen(3000, function () {
    console.log('\n-----------------------');
    console.log(packageFile.name+' '+packageFile.version+' is ready\n');
    console.log(' http://localhost:3000/ \n\n');
});

// client.quit();
