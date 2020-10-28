# Accesshole
+ 内网服务请求代理

占用端口: 8848

### 当前支持的服务
* nacos
* xxl-job-admin
* rabbitmq
持续测试新增...

### 使用方式
创建容器时添加环境变量:  
* AUTH_SECRET=JWT secret  
* AUTH_KEY=JWT token在cookies里面的key  
* AUTH_ENABLE=false|true  
* PARAMS={"/rabbitmq":"http://172.26.5.152:15672/","/nacos":"http://172.25.1.152:8848/nacos/","/xxl-job-admin":"http://172.26.5.154:8080/xxl-job-admin/"}