const app = require('express')();
const logger = require('log4js').getLogger();
const cookieParser = require('cookie-parser');
const proxy = require('http-proxy').createProxyServer(null);
const jwt = require("jsonwebtoken");
const expressModifyResponse = require('express-modify-response');

logger.level = 'info';

let enableAuth;
let authSecret;
let authKey;
let basePath;
let mapper;

try {
    start();
    app.listen(8899, function () {
        logger.info('应用实例正在监听%s端口\n', 8899);
    });
} catch (error) {
    logger.error(error);
}

function testRouter() {
    return '{"rabbitmq":"http://172.26.5.152:15672/","nacos":"http://172.25.1.152:8848/","xxl-job":"http://172.26.5.154:8080/", "sentinel":"http://172.25.12.246:8080/"}'
}

function start() {
    let routers = process.env['ROUTERS'] || testRouter();
    enableAuth = process.env['AUTH_ENABLE'] || "false";
    authKey = process.env['AUTH_KEY'] || "token";
    authSecret = process.env['AUTH_SECRET'] || "senna2020";
    basePath = process.env['BASE_PATH'] || "service";
    mapper = JSON.parse(routers)

    app.use(cookieParser());
    applyAuth()
    applyPathFix()
    for (const module in mapper) {
        const from = `/${basePath}/${module}/`
        let to = mapper[module];
        logger.info(`注册 请求地址[${from}] 到 目的地址[${to}]`);

        switch (module) {
            case "xxl-job":
                applyRedirectXxlJob(from);
                break
            case "nacos":
                applyRedirectNacos(from);
                break
            case "rabbitmq":
                applyRedirectRabbitMq(from);
                break
            case "sentinel":
                applyRedirectSentinel(from);
                break
        }
        applyProxy(from, to)
    }
}

function applyRedirectXxlJob(fromPath) {
    app.use(fromPath, expressModifyResponse(
        (req, res) => {
            if (res.getHeader('Content-Type') === undefined) return false
            if (res.getHeader('Content-Type').startsWith('text/html')) return true;
            if (res.getHeader('Content-Type').startsWith('text/css')) return true;
            if (res.getHeader('Content-Type').startsWith('application/javascript')) return true;
            return false;
        }, (req, res, body) => {
            return body.toString()
                .replace(/\/xxl-job-admin\/static/g, fromPath + "xxl-job-admin/static")
                .replace(/var base_url = '\/xxl-job-admin'/g, "var base_url = '" + fromPath + "xxl-job-admin'")
                .replace(/<a href="\/xxl-job-admin/g, "<a href=\"" + fromPath + "xxl-job-admin")
        }
    ))
}

function applyRedirectRabbitMq(fromPath) {
    app.use(fromPath, expressModifyResponse(
        (req, res) => {
            if (res.getHeader('Content-Type') === undefined) return false
            if (res.getHeader('Content-Type').startsWith('text/html')) return true;
            if (res.getHeader('Content-Type').startsWith('text/css')) return true;
            if (res.getHeader('Content-Type').startsWith('application/javascript')) return true;
            if (res.getHeader('Content-Type').startsWith('application/octet-stream')) return true;
            return false;
        }, (req, res, body) => {
            return body.toString()
        }
    ))
}

function applyRedirectNacos(fromPath) {
    let relativePath = fromPath.substring(1)
    app.use(fromPath, expressModifyResponse(
        (req, res) => {
            if (res.getHeader('Content-Type') === undefined) return false
            if (res.getHeader('Content-Type').startsWith('text/html')) return true;
            if (res.getHeader('Content-Type').startsWith('text/css')) return true;
            if (res.getHeader('Content-Type').startsWith('application/javascript')) return true;
            return false;
        }, (req, res, body) => {
            return body.toString()
                .replace(/\/nacos\/console-fe/g, fromPath + "nacos/console-fe")
        }
    ))
}


function applyRedirectSentinel(fromPath) {
    app.use(fromPath, expressModifyResponse(
        (req, res) => {
            if (res.getHeader('Content-Type') === undefined) return false
            if (res.getHeader('Content-Type').startsWith('text/html')) return true;
            if (res.getHeader('Content-Type').startsWith('text/css')) return true;
            if (res.getHeader('Content-Type').startsWith('application/javascript')) return true;
            return false;
        }, (req, res, body) => {
            return body.toString()
                .replace(/.\/lib/g, fromPath + "lib")
                .replace(/.\/dist/g, fromPath + "dist")
                .replace(/app\/views/g, fromPath + "app\/views")
                .replace(/app\/scripts/g, fromPath + "app\/scripts")
                .replace(/\(\{url:"\//g, "({url:\"" + fromPath)
                .replace(/\(\{url:"app/g, "({url:\"" + fromPath + "app")
                .replace(/..\/..\/assets\/img\/sentinel-logo.png/g, fromPath + "assets/img/sentinel-logo.png")
        }
    ))
}

function applyAuth() {
    if (enableAuth) {
        app.use(function (req, res, next) {
            // 鉴权
            let requestIp = req.ip;
            let requestUrl = req.originalUrl;
            logger.debug(`IP [${requestIp}] 正在访问 ${requestUrl}`);

            if (enableAuth !== "false") {
                if (authSecret && authKey && req.cookies) {
                    const token = req.cookies[authKey];
                    if (token == null) {
                        logger.error(`[No Permission] IP [${requestIp}] 正在访问 ${requestUrl}`);
                        return res.sendStatus(401);
                    }
                    jwt.verify(token, authSecret, (err, user) => {
                        if (err) {
                            logger.error(`[Invalid Token] IP [${requestIp}] 正在访问 ${requestUrl}`);
                            return res.sendStatus(403);
                        }
                        logger.debug(`用户 [${user}] IP [${requestIp}] 正在访问 ${requestUrl}`);
                    });
                } else {
                    logger.error(`[No Auth Info] IP [${requestIp}] 正在访问 ${requestUrl}`);
                    return res.sendStatus(401);
                }
            }
            next()
        });
    }
}

function applyProxy(fromPath, to) {
    app.use(fromPath, function (req, res, next) {
        proxy.web(req, res, {
            changeOrigin: true,
            target: to
        }, next);
    })
}

function applyPathFix() {
    // 一点点修补，主要为了解决 rabbitmq 在没有结尾 / 的时候转发错误的问题
    proxy.on('proxyReq', function (proxyReq, req, res, options) {
        if (req.originalUrl === req.baseUrl) {
            res.redirect(req.originalUrl + '/')
        }
    });
    proxy.on('proxyRes', function (proxyRes, req, res, options) {
        if (proxyRes.statusCode === 302) {
            let jumpTo = proxyRes.headers['location']
            if (jumpTo.startsWith('http')) {
                jumpTo = jumpTo.substr(jumpTo.substr(8).indexOf('/') + 8)
            }
            proxyRes.headers['location'] = req.baseUrl + jumpTo
        }
    });
}

