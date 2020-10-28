FROM node:12-alpine
WORKDIR /usr/src/app
COPY *.js ./
COPY package.json ./
RUN ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo 'Asia/Shanghai' >/etc/timezone \
    && npm set registry https://registry.npm.taobao.org/ \
    && npm install
EXPOSE 8848
ENTRYPOINT node index.js