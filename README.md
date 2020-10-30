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
AUTH_ENABLE=false
BASE_PATH=service
ROUTERS={"rabbitmq":"http://172.26.5.152:15672/","nacos":"http://172.25.1.152:8848/","xxl-job":"http://172.26.5.154:8080/","sentinel":"http://172.25.12.246:8080/"}
```

### 使用
注意 `nacos`, `xxl-job`, 'sentinel', 'rabbitmq' 几个中间件经过特殊出路，所以他们的转发需要使用这几个固定的 key

之后直接访问, 将被转发到内网对应服务
+ http://127.0.0.1:8080/service/rabbitmq/  =>  http://172.26.5.152:15672/
+ http://127.0.0.1:8080/service/nacos/nacos/  =>  http://172.25.1.152:8848/nacos/
+ http://127.0.0.1:8080/service/sentinel/  =>  http://172.25.12.246:8080/
+ http://127.0.0.1:8080/service/xxl-job/xxl-job-admin/  =>  http://172.26.5.154:8080/xxl-job-admin/

### License
[MIT](https://github.com/JinuoTec/Accesshole/blob/master/LICENSE.md)
