# Accesshole
Accesshole 是一个内网代理服务，可以将内网的服务暴露到外网，并加上身份认证。  
接入后可以直接在管理后台访问 XXL-Job, Nacos, Sentinel, Rabbitmq 以及一大批应用组件。  
比如：
```
https://admin.sample.com/service/nacos
https://admin.sample.com/service/xxl-job
https://admin.sample.com/service/custom
```

### Docker安装
```
docker pull jude95/accesshole
```

### 配置

创建容器时添加环境变量:
```
AUTH_SECRET=${JWT secret}
AUTH_KEY=token
AUTH_RULE={"includes": [], "excludes":["^\/service\/admin"]}
AUTH_ENABLE=false
BASE_PATH=service
ROUTERS={"rabbitmq":"http://172.26.5.152:15672/","nacos":"http://172.25.1.152:8848/","xxl-job":"http://172.26.5.154:8080/","sentinel":"http://172.25.12.246:8080/"}
```
`AUTH_RULE` 表示只对满足指定规则的 url 使用认证. `include` 对正则匹配的URL进行认证. `exclude` 对正则不匹配的URL进行认证. 留空则不生效.
`AUTH_RULE` 是对 PATH 部分进行匹配，不包括 host。比如 `/service/nacos/login`


### 使用
注意 `nacos`, `xxl-job`, `sentinel`, `rabbitmq` 几个中间件经过特殊处理，所以他们的转发需要使用这几个固定的 key

之后直接访问, 将被转发到内网对应服务
+ http://127.0.0.1:8080/service/rabbitmq/  =>  http://172.26.5.152:15672/
+ http://127.0.0.1:8080/service/nacos/nacos/  =>  http://172.25.1.152:8848/nacos/
+ http://127.0.0.1:8080/service/sentinel/  =>  http://172.25.12.246:8080/
+ http://127.0.0.1:8080/service/xxl-job/xxl-job-admin/  =>  http://172.26.5.154:8080/xxl-job-admin/

### 认证
当认证功能开启时，会对所有请求进行拦截认证，读取 `Cookie` 中的 AUTH_KEY 字段内容，使用 AUTH_SECRET 进行 JWT 校验。  
如果校验成功，将 payload 的内容填充到请求头的 `access-payload` 字段中。

### License
[MIT](https://github.com/JinuoTec/Accesshole/blob/master/LICENSE.md)
