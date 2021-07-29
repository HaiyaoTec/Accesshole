const match = require('./match').default
const pako = require('pako');

let app = require('express')();
let server
const logger = require('log4js').getLogger();
const cookieParser = require('cookie-parser');
let proxy = require('http-proxy').createProxyServer(null);
const jwt = require("jsonwebtoken");
const expressModifyResponse = require('express-modify-response');
const fetch = require('node-fetch');

logger.level = 'info';

let enableAuth;
let authRule;
let authSecret;
let authKey;
let basePath;
let router;
// 请求路由配置的url
let remoteRouterPath;
try {
    start();
    server = app.listen(8899, function () {
        logger.info('应用实例正在监听%s端口\n', 8899);
    });
} catch (error) {
    logger.error(error);
}

function testConfig() {
    router = {}
    authRule = {"includes": [], "excludes": []}
    enableAuth = "true"
    basePath = ""
    authKey = "token"
    authSecret = "sylas2020"
    remoteRouterPath = 'http://172.31.236.123:8080/accessHole/definitions'
}


function applyRoute() {
    for (const module in router) {
        let from
        if (basePath) {
            from = `/${basePath}/${module}`;
        } else {
            from = `/${module}`
        }
        let definition = router[module];
        if (definition.authInclude || definition.authExclude) {
            applyAuth(module, {
                includes: definition.authInclude,
                excludes: definition.authExclude
            });
        } else {
            applyAuth()
        }
        let to = definition.target;
        if (!from.endsWith("/")) {
            from = from + "/"
        }
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
            case "springBootAdmin":
                applyRedirectSpringBootAdmin(from)
                break
            case "kibana":
                applyRedirectKibana(from)
                break
        }

        if (!module) {
            applyProxy(module, to)
        }
        applyProxy(from, to);
    }
}

function start() {
    if (process.env['REMOTE_ROUTER']) {
        router = JSON.parse(process.env['ROUTERS'])
        enableAuth = process.env['AUTH_ENABLE'] || "true";
        authRule = JSON.parse(process.env['AUTH_RULE'] || '{"includes": [], "excludes":[]}')
        authKey = process.env['AUTH_KEY'] || "token";
        authSecret = process.env['AUTH_SECRET'] || "sylas2020";
        remoteRouterPath = process.env['REMOTE_ROUTER'] || 'http://127.0.0.1:8080'
        basePath = process.env['BASE_PATH'] || "service"

    } else {
        testConfig()
    }

    if (remoteRouterPath) {
        setInterval(() => {
            fetch(remoteRouterPath).then(async res => {
                    if (res) {
                        let newRouter = await res.json();
                        if (!newRouter) {
                            return
                        }
                        if (newRouter && newRouter.error) {
                            return;
                        }

                        if (JSON.stringify(newRouter) !== JSON.stringify(router)) {
                            router = newRouter
                            server.close(() => {
                                logger.info("发现新的路由，关闭已有路由")
                            })
                            proxy = require('http-proxy').createProxyServer(null);
                            app = require('express')();
                            applyPathFix()
                            app.use(cookieParser());
                            applyRoute();
                            server = app.listen(8899, function () {
                                logger.info('应用实例正在监听%s端口\n', 8899);
                            });
                        }
                    }
                }
            ).catch(e => {
                logger.error(e)
            })
        }, 10000);
    }
    applyPathFix()
    app.use(cookieParser());
    applyRoute();

}

function applyRedirectXxlJob(fromPath) {
    app.use(fromPath, expressModifyResponse(
        (req, res) => {
            if (res.getHeader('Content-Type') === undefined) return false
            if (res.getHeader('Content-Type').startsWith('text/html')) return true;
            if (res.getHeader('Content-Type').startsWith('text/css')) return true;
            if (res.getHeader('Content-Type').startsWith('application/javascript')) return true;
            if (res.statusCode === 302) return true
            return false;
        }, (req, res, body) => {
            return body.toString()
                .replace(/\/xxl-job-admin\/static/g, fromPath + "xxl-job-admin/static")
                .replace(/var base_url = '\/xxl-job-admin'/g, "var base_url = '" + fromPath + "xxl-job-admin'")
                .replace(/<a href="\/xxl-job-admin/g, "<a href=\"" + fromPath + "xxl-job-admin")
        }
    ))
}

function applyRedirectSpringBootAdmin(from) {
    app.use(from, expressModifyResponse(
        (req, res) => {
            if (res.getHeader('Content-Type') === undefined) return false
            if (res.getHeader('Content-Type').startsWith('text/html')) return true;
            if (res.statusCode === 302) return true
            return false;
        }, (req, res, body) => {
            // return body.toString()
            let bodyStr = body.toString()
            bodyStr = bodyStr.replace(/<base href="http:\/\/.*\/admin\//, `<base href="${from}admin/" />`)
            bodyStr = bodyStr.replace(/<base href="https:\/\/.*\/admin\//, `<base href="${from}admin/" />`)
            return bodyStr
        }
    ))
}

let kibanaUrls =
    [
        '/bundles/kbn-ui-shared-deps/kbn-ui-shared-deps.@elastic.js',
        '/bundles/kbn-ui-shared-deps/kbn-ui-shared-deps.js',
        '/built_assets/dlls/vendors_runtime.bundle.dll.js',
        '/built_assets/dlls/vendors_0.bundle.dll.js',
        '/built_assets/dlls/vendors_1.bundle.dll.js',
        '/built_assets/dlls/vendors_2.bundle.dll.js',
        '/built_assets/dlls/vendors_3.bundle.dll.js',
        '/bundles/commons.bundle.js',
        '/bundles/plugin/kibanaUtils/kibanaUtils.plugin.js',
        '/bundles/plugin/esUiShared/esUiShared.plugin.js',
        '/bundles/plugin/kibanaReact/kibanaReact.plugin.js',
        '/bundles/core.bundle.js',
        '/built_assets/dlls/vendors_0.style.dll.css',
        '/built_assets/dlls/vendors_1.style.dll.css',
        '/built_assets/dlls/vendors_2.style.dll.css',
        '/built_assets/dlls/vendors_3.style.dll.css',
        '/bundles/kbn-ui-shared-deps/kbn-ui-shared-deps.css',
        '/bundles/kbn-ui-shared-deps/kbn-ui-shared-deps.light.css',
        '/node_modules/@kbn/ui-framework/dist/kui_light.css',
        '/bundles/light_theme.style.css',
        '/bundles/commons.style.css',
        '/built_assets/css/plugins/visualizations/index.light.css',
        '/built_assets/css/plugins/vis_type_vega/index.light.css',
        '/built_assets/css/plugins/metrics/index.light.css',
        '/built_assets/css/plugins/timelion_vis/index.light.css',
        '/built_assets/css/plugins/tagcloud/index.light.css',
        '/built_assets/css/plugins/table_vis/index.light.css',
        '/built_assets/css/plugins/metric_vis/index.light.css',
        '/built_assets/css/plugins/markdown_vis/index.light.css',
        '/built_assets/css/plugins/vis_default_editor/index.light.css',
        '/built_assets/css/plugins/timelion/index.light.css',
        '/built_assets/css/plugins/tile_map/index.light.css',
        '/built_assets/css/plugins/newsfeed/index.light.css',
        '/built_assets/css/plugins/kibana_react/index.light.css',
        '/built_assets/css/plugins/kibana/index.light.css',
        '/built_assets/css/plugins/input_control_vis/index.light.css',
        '/built_assets/css/plugins/triggers_actions_ui/index.light.css',
        '/built_assets/css/plugins/lens/index.light.css',
        '/built_assets/css/plugins/cross_cluster_replication/index.light.css',
        '/built_assets/css/plugins/remoteClusters/index.light.css',
        '/built_assets/css/plugins/rollup/index.light.css',
        '/built_assets/css/plugins/index_lifecycle_management/np_ready/application/index.light.css',
        '/built_assets/css/plugins/canvas/style/index.light.css',
        '/built_assets/css/plugins/maps/index.light.css',
        '/built_assets/css/plugins/apm/index.light.css',
        '/built_assets/css/plugins/spaces/index.light.css',
        '/built_assets/css/plugins/monitoring/index.light.css',
        '/built_assets/css/core.light.css',
    ]
String.prototype.replaceAll = function (s1, s2) {
    return this.replace(new RegExp(s1, "gm"), s2);
}

const kibanaModifyUrls = [
    "/login",
    "/logout",
    "/bundles/app/core/bootstrap.js",
    "/bundles/commons.bundle.js",
    "/bundles/plugin/security/security.plugin.js",
]

function applyRedirectKibana(from) {
    app.use(from, expressModifyResponse(
        (req, res) => {
            if (res.getHeader('Content-Type') === undefined) return false
            if (res.getHeader('Content-Type').startsWith('text/html')) return true;
            if (res.getHeader('Content-Type').startsWith('application/javascript')) return true;
            if (res.statusCode === 302) return false
            return false;
        }, (req, res, body) => {

            // res.setHeader("Content-Security-Policy",`script-src 'unsafe-inline'`)
            if (kibanaModifyUrls.indexOf(req.path) === -1) {
                return body;
            }
            let data = pako.inflate(body)
            let bodyStr = data.reduce((acc, i) => acc += String.fromCharCode.apply(null, [i]), '');

            if (res.getHeader("content-type").startsWith("text/html")) {
                bodyStr = bodyStr.replace(`<script src="/bundles/app/core/bootstrap.js"></script>`,
                    `<script src="/service/kibana/bundles/app/core/bootstrap.js"></script>`)
                    .replace(/url\('/g, `url('/service/kibana`)
                    .replace(/href="/g, `href="/service/kibana`)
                    .replace("&quot;serverBasePath&quot;:&quot;&quot;", "&quot;serverBasePath&quot;:&quot;/service/kibana&quot;")
                    // .replace("&quot;serverBasePath&quot;:&quot;&quot;", "&quot;serverBasePath&quot;:&quot;/service/kibana&quot;")
                    .replace("/translations/en.json", "/service/kibana/translations/en.json")
                    .replace(/\/home\/admin/g, `/service/kibana/home/admin`)
                    // .replace(/&quot;elasticsearchUrl&quot;:&quot;(.*)&quot;/g, `&quot;elasticsearchUrl&quot;:&quot;/service/kibana&quot;`)
                    .replace("/app/kibana", `/service/kibana/app/kibana`)
                // .replace("window.__kbnCspNotEnforced__ = true;", ``)
                // .replace("<kbn-csp data=\"{&quot;strictCsp&quot;:false}\"></kbn-csp>", `<kbn-csp data=\"{&quot;strictCsp&quot;:true}\"></kbn-csp>`)

            } else if (res.getHeader("content-type").startsWith("application/javascript")) {
                kibanaUrls.forEach(i => {
                    bodyStr = bodyStr.replace(i, `/service/kibana${i}`)
                })
                // bodyStr = bodyStr.replace(/url\('/g, `url('/service/kibana`)
                bodyStr = bodyStr.replace(/addBasePath\("\/bundles\/plugin/g, `addBasePath("/service/kibana/bundles/plugin`)
                // bodyStr = bodyStr.replace("_defineProperty(this, \"serverBasePath\", void 0);", "_defineProperty(this, \"serverBasePath\", \"/service/kibana\");")
                // bodyStr = bodyStr.replace("window.location.assign(\"\".concat(this.logoutUrl", "window.location.assign(\"\".concat(\"/service/kibana\"+this.logoutUrl")
                bodyStr = bodyStr.replace("request=this.createRequest(fetchOptions);",
                    `fetchOptions.path="/service/kibana"+fetchOptions.path;request=this.createRequest(fetchOptions);`)

            }
            return pako.gzip(bodyStr, {to: 'string'});
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

function applyAuth(module, rules) {
    if (enableAuth) {
        app.use(`/${basePath}/${module}`, function (req, res, next) {
            if (req.url.indexOf(".css") !== -1 || req.url.indexOf(".js") !== -1) {
                next()
                return
            }
            // 鉴权
            let requestIp = req.ip;
            let requestUrl = req.originalUrl;
            logger.debug(`IP [${requestIp}] 正在访问 ${requestUrl}`);
            if (rules && enableAuth !== "false" && match(rules, requestUrl)) {
                return doAuth(req, res, requestIp, requestUrl, next);
            } else {
                next();
            }
        });
    }
}

//
// function getRealUrl(req, to) {
//     let uri = Uri.parse(to)
//     if (req.url.indexOf(".js") === -1 && req.url.indexOf(".css") === -1) {
//         return to
//     } else {
//         return uri.protocol + "//" + uri.host
//     }
// }

function applyProxy(fromPath, to) {
    app.use(fromPath, function (req, res, next) {
        proxy.web(req, res, {
            changeOrigin: true,
            target: to
        }, next);
    })
}

function doAuth(req, res, requestIp, requestUrl, next) {
    if (authSecret && authKey && req.cookies) {
        const token = req.cookies[authKey];
        if (token == null) {
            logger.error(`[No Permission] IP [${requestIp}] 正在访问 ${requestUrl}`);
            return res.redirect(getRealLogin())

        }
        jwt.verify(token, authSecret, (err, user) => {
            if (err) {
                logger.error(`[Invalid Token] IP [${requestIp}] 正在访问 ${requestUrl}`);
                return res.redirect(getRealLogin())

            }
            logger.debug(`用户 [${user}] IP [${requestIp}] 正在访问 ${requestUrl}`);
            req.headers['access-payload'] = user.payload
            next()
        });
    } else {
        logger.error(`[No Auth Info] IP [${requestIp}] 正在访问 ${requestUrl}`);
        return res.redirect(getRealLogin())

    }
}

function applyPathFix() {

    proxy.on('proxyRes', function (proxyRes, req, res, options) {

        // debug message
        // let body = [];
        // proxyRes.on('data', function (chunk) {
        //     body.push(chunk);
        // });
        // proxyRes.on('end', function () {
        //     body = Buffer.concat(body).toString();
        //     console.log("res from proxied server:", body);
        // });
        try {
            if (proxyRes.statusCode === 302) {
                let jumpTo = proxyRes.headers['location']
                if (jumpTo.startsWith('http')) {
                    jumpTo = jumpTo.substr(jumpTo.substr(8).indexOf('/') + 8)
                }
                proxyRes.headers['location'] = req.baseUrl + jumpTo
            }
            if (proxyRes.statusCode === 403) {
                res.redirect(getRealLogin())
            }
        } catch (e) {
            logger.error(e)
        }

    });
}

function getRealLogin() {
    if (basePath) {
        return `/${basePath}/login/console/login`;
    } else {
        return "/login/console/login"
    }
}

