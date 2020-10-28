const app = require('express')();
const logger = require('log4js').getLogger();
const proxy = require('http-proxy').createProxyServer(null);
const jwt = require("jsonwebtoken");
const replaceStream = require('replacestream');

logger.level = 'info';

let enableAuth;
let authSecret;
let authKey;

proxy.on('proxyRes', function(proxyRes, req, res, options) {
    if (proxyRes.statusCode==302){
        let jumpTo=proxyRes.headers['location']
        if (jumpTo.startsWith('http')){
            jumpTo=jumpTo.substr(jumpTo.substr(8).indexOf('/')+8)
            logger.log(jumpTo)
            proxyRes.headers['location']=jumpTo
        }
    }
});

function gogogo(first, second) {
    app.use(first, function (req, res, next) {
        // 鉴权
        let requestIp = req.ip;
        let requestUrl = req.originalUrl;
        if (enableAuth !== "false") {
            if (authSecret && authKey) {
                const token = req.cookies[authKey];
                if (token == null) {
                    logger.error(`[AUTH ERROR] IP [${requestIp}] 正在访问 ${requestUrl}`);
                    return res.sendStatus(401);
                }
                jwt.verify(token, authSecret, (err, user) => {
                    if (err) {
                        logger.error(`[INVALID USER] IP [${requestIp}] 正在访问 ${requestUrl}`);
                        return res.sendStatus(403);
                    }
                    logger.debug(`用户 [${user}] IP [${requestIp}] 正在访问 ${requestUrl}`);
                });
            } else {
                logger.error(`[NO SETTING] IP [${requestIp}] 正在访问 ${requestUrl}`);
                return res.sendStatus(401);
            }
        } else {
            logger.debug(`IP [${requestIp}] 正在访问 ${requestUrl}`);
        }

        proxy.web(req, res, {
            changeOrigin: true,
            target: second
        }, next);
    });
}

try {
    init();
} catch (error) {
    logger.error(error);
}

function init() {
    let arguments = process.env['PARAMS']||'{}';
    enableAuth=process.env['AUTH_ENABLE']||"true";
    authKey=process.env['AUTH_KEY']||"";
    authSecret=process.env['AUTH_SECRET']||"";
    arguments=JSON.parse(arguments)
    for (const first in arguments) {
        let second = arguments[first];
        logger.info(`注册 目的地址[${second}] 到 请求地址[${first}]`);

        try {
            gogogo(first, second);
        } catch (error) {
            logger.error(error);
        }
    }
}

let server = app.listen(8848, function () {
    logger.info('应用实例正在监听%s端口\n', server.address().port);
});